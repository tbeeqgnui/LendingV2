const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const { deployMockContract } = require("@ethereum-waffle/mock-contract");

const {
  loadFixture,
  fixtureDefault,
  fixtureShortfall,
} = require("../helpers/fixtures.js");

const { setOraclePrices, parseTokenAmount } = require("../helpers/utils.js");

const Controller = require("../../artifacts/contracts/Controller.sol/Controller.json");

describe("Controller: Policy Hooks", function () {
  describe("beforeMint()/afterMint()", function () {
    it("CON-BMINT-1: Should be able check beforeMint()", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [other] = accounts;

      await controller.beforeMint(
        iUSDx.address,
        await other.getAddress(),
        utils.parseEther("1000")
      );
    });

    it("CON-BMINT-2: Should fail in beforeMint() with non-listed market", async function () {
      const { controller, owner, accounts } = await loadFixture(fixtureDefault);
      const [other] = accounts;

      await expect(
        controller.beforeMint(
          await owner.getAddress(),
          await other.getAddress(),
          utils.parseEther("1000")
        )
      ).to.be.revertedWith("Token has not been listed");
    });

    it("CON-BMINT-3: Should fail in beforeMint() if it reaches supply capacity", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [other] = accounts;
      let account = await other.getAddress();

      // Set iUSDx's supply capacity to 3000
      let capacity = utils.parseEther("3000");
      await controller._setSupplyCapacity(iUSDx.address, capacity);

      let amount = capacity.add(1);
      await expect(
        controller.callStatic.beforeMint(iUSDx.address, account, amount)
      ).to.be.revertedWith("Token supply capacity reached");
    });
  });

  describe("beforeRedeem()/afterRedeem()", function () {
    it("CON-BREDEEM-1: Should be able check beforeRedeem()", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [other] = accounts;

      await controller.beforeRedeem(
        iUSDx.address,
        await other.getAddress(),
        utils.parseEther("1000")
      );
    });

    it("CON-BREDEEM-2: Should fail in beforeRedeem() with non-listed market", async function () {
      const { controller, owner, accounts } = await loadFixture(fixtureDefault);
      const [other] = accounts;

      await expect(
        controller.beforeRedeem(
          await owner.getAddress(),
          await other.getAddress(),
          utils.parseEther("1000")
        )
      ).to.be.revertedWith("Token has not been listed");
    });

    it("CON-BREDEEM-3: Should succeed in beforeRedeem() if has not entered market", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [other] = accounts;

      await controller.beforeRedeem(
        iUSDx.address,
        await other.getAddress(),
        utils.parseEther("1001")
      );
    });

    it("CON-BREDEEM-4: Should revert in beforeRedeem() with some large redeem amount", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [other] = accounts;
      const account = await other.getAddress();

      let amount = utils.parseEther("1000");

      await iUSDx.connect(other).mint(account, amount);

      // User use iUSDx as collateral
      await controller.connect(other).enterMarkets([iUSDx.address]);
      await iUSDx.connect(other).borrow(amount.div(2));

      await expect(
        controller.callStatic.beforeRedeem(
          iUSDx.address,
          account,
          amount.div(2)
        )
      ).to.be.revertedWith("Account has some shortfall");
    });

    it("CON-BREDEEM-5: Should revert in beforeRedeem() with some drop of collateral assets", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(
        fixtureShortfall
      );

      // default shortfall drop collateral price to 0.5
      // equity = 1000 * 0.5 * 0.9 - 450 * 1 * 1 = 0
      await expect(
        controller.callStatic.beforeRedeem(
          iUSDx.address,
          await accounts[0].getAddress(),
          1
        )
      ).to.be.revertedWith("Account has some shortfall");
    });

    it.skip("CON-BREDEEM-6: Should revert in beforeRedeem() if token price is unavailable in controllerStock", async function () {
      const { controllerStock, iUSDx, mockPriceOracle, accounts } =
        await loadFixture(fixtureDefault);
      const [other] = accounts;
      let account = await other.getAddress();
      let amount = utils.parseEther("1000");

      // Use controllerStock
      await iUSDx._setController(controllerStock.address);

      // Use mock oracle
      await controllerStock._setPriceOracle(mockPriceOracle.address);

      // Now use iUSDx as collateral
      await iUSDx.connect(other).mint(account, amount);
      await controllerStock.connect(other).enterMarkets([iUSDx.address]);

      const signer = await ethers.provider.getSigner(iUSDx.address);

      // iUSDx Price is unavailable
      await setOraclePrices(mockPriceOracle, [iUSDx], [0]);

      await expect(
        controllerStock
          .connect(signer)
          .callStatic.beforeRedeem(
            iUSDx.address,
            await other.getAddress(),
            amount
          )
      ).to.be.revertedWith("Invalid price to calculate account equity");

      // iUSDx Price is invalid
      await setOraclePrices(mockPriceOracle, [iUSDx], [1], [false]);

      await expect(
        controllerStock
          .connect(signer)
          .callStatic.beforeRedeem(
            iUSDx.address,
            await other.getAddress(),
            amount
          )
      ).to.be.revertedWith("Invalid price to calculate account equity");
    });
  });

  describe("beforeBorrow()/afterBorrow()", function () {
    before(async function () {
      // beforeBorrow() is only allowed to be called by iUSDx
      // So impersonate it
      const { iUSDx } = await loadFixture(fixtureDefault);
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [iUSDx.address],
      });
    });

    it("CON-BBRW-1: Should be able check beforeBorrow()", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [other] = accounts;
      let account = await other.getAddress();
      const signer = await ethers.provider.getSigner(iUSDx.address);

      await iUSDx.connect(other).mint(account, utils.parseEther("1000"));
      await controller.connect(other).enterMarkets([iUSDx.address]);

      await controller
        .connect(signer)
        .callStatic.beforeBorrow(
          iUSDx.address,
          await other.getAddress(),
          utils.parseEther("10")
        );
    });

    it("CON-BBRW-2: Should fail in beforeBorrow() with non-listed market", async function () {
      const { controller, owner, accounts } = await loadFixture(fixtureDefault);
      const [other] = accounts;

      await expect(
        controller.beforeBorrow(
          await owner.getAddress(),
          await other.getAddress(),
          utils.parseEther("1000")
        )
      ).to.be.revertedWith("Token has not been listed");
    });

    it("CON-BBRW-3: Should fail in beforeBorrow() if token price is unavailable", async function () {
      const { controller, iUSDx, mockPriceOracle, accounts } =
        await loadFixture(fixtureDefault);
      const [other] = accounts;
      let account = await other.getAddress();
      let amount = utils.parseEther("1000");

      // Use mock oracle
      await controller._setPriceOracle(mockPriceOracle.address);

      // Now use iUSDx as collateral
      await iUSDx.connect(other).mint(account, amount);
      await controller.connect(other).enterMarkets([iUSDx.address]);

      const signer = await ethers.provider.getSigner(iUSDx.address);

      // iUSDx Price is unavailable
      await setOraclePrices(mockPriceOracle, [iUSDx], [0]);

      await expect(
        controller
          .connect(signer)
          .callStatic.beforeBorrow(
            iUSDx.address,
            await other.getAddress(),
            amount
          )
      ).to.be.revertedWith("Invalid price to calculate account equity");
    });

    it.skip("CON-BBRW-4: Should fail in beforeBorrow() if token price is unavailable in controllerStock", async function () {
      const { controllerStock, iUSDx, mockPriceOracle, accounts } =
        await loadFixture(fixtureDefault);
      const [other] = accounts;
      let account = await other.getAddress();
      let amount = utils.parseEther("1000");

      // Use controllerStock
      await iUSDx._setController(controllerStock.address);

      // Use mock oracle
      await controllerStock._setPriceOracle(mockPriceOracle.address);

      // Now use iUSDx as collateral
      await iUSDx.connect(other).mint(account, amount);
      await controllerStock.connect(other).enterMarkets([iUSDx.address]);

      const signer = await ethers.provider.getSigner(iUSDx.address);

      // iUSDx Price is invalid
      await setOraclePrices(mockPriceOracle, [iUSDx], [1], [false]);

      await expect(
        controllerStock
          .connect(signer)
          .callStatic.beforeBorrow(
            iUSDx.address,
            await other.getAddress(),
            amount
          )
      ).to.be.revertedWith("Invalid price to calculate account equity");
    });

    it("CON-BBRW-5: Should fail in beforeBorrow() if called by non-iToken for the 1st time", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [other] = accounts;
      let account = await other.getAddress();
      let amount = utils.parseEther("1000");

      // Now use iUSDx as collateral
      await iUSDx.connect(other).mint(account, amount);
      await controller.connect(other).enterMarkets([iUSDx.address]);

      await expect(
        controller.beforeBorrow(iUSDx.address, await other.getAddress(), amount)
      ).to.be.revertedWith("sender must be iToken");
    });

    it("CON-BBRW-6: Should fail in beforeBorrow() with some large borrow amount", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [other] = accounts;
      let account = await other.getAddress();
      let amount = utils.parseEther("1000");

      const signer = await ethers.provider.getSigner(iUSDx.address);

      // Have no asset as collateral yet
      await expect(
        controller
          .connect(signer)
          .callStatic.beforeBorrow(
            iUSDx.address,
            account,
            utils.parseEther("1")
          )
      ).to.be.revertedWith("Account has some shortfall");

      // Now use iUSDx as collateral
      await iUSDx.connect(other).mint(account, amount);
      await controller.connect(other).enterMarkets([iUSDx.address]);

      await expect(
        controller
          .connect(signer)
          .callStatic.beforeBorrow(
            iUSDx.address,
            await other.getAddress(),
            amount
          )
      ).to.be.revertedWith("Account has some shortfall");
    });

    it("CON-BBRW-7: Should fail in beforeBorrow() if it reaches borrow capacity", async function () {
      const { controller, iUSDx, mockPriceOracle, accounts } =
        await loadFixture(fixtureDefault);
      const [other] = accounts;
      let account = await other.getAddress();
      let amount = utils.parseEther("10000");

      // Now use iUSDx as collateral
      await iUSDx.connect(other).mint(account, amount);
      await controller.connect(other).enterMarkets([iUSDx.address]);

      // Set iUSDx's borrow capacity to 3000
      let capacity = utils.parseEther("3000");
      await controller._setBorrowCapacity(iUSDx.address, capacity);

      // Try to borrow 5000
      const signer = await ethers.provider.getSigner(iUSDx.address);
      await expect(
        controller
          .connect(signer)
          .callStatic.beforeBorrow(iUSDx.address, account, amount.div(2))
      ).to.be.revertedWith("Token borrow capacity reached");
    });

    after(async function () {
      // Stop impersonating iUSDx
      const { iUSDx } = await loadFixture(fixtureDefault);
      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [iUSDx.address],
      });
    });
  });

  describe("beforeRepayBorrow()/afterRepayBorrow()", function () {
    it("CON-BRPB-1: Should be able check beforeRepayBorrow()", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [other1, other2] = accounts;

      await controller.beforeRepayBorrow(
        iUSDx.address,
        await other1.getAddress(),
        await other2.getAddress(),
        utils.parseEther("1000")
      );
    });

    it("CON-BRPB-2: Should fail in beforeRepayBorrow() with non-listed market", async function () {
      const { controller, owner, accounts } = await loadFixture(fixtureDefault);
      const [other1, other2] = accounts;

      await expect(
        controller.beforeRepayBorrow(
          await owner.getAddress(),
          await other1.getAddress(),
          await other2.getAddress(),
          utils.parseEther("1000")
        )
      ).to.be.revertedWith("Token has not been listed");
    });

    it("CON-ARPB-1: Should fail in afterRepayBorrow() with non-listed market", async function () {
      const { controller, owner, accounts } = await loadFixture(fixtureDefault);
      const [other1, other2] = accounts;

      await expect(
        controller.afterRepayBorrow(
          await owner.getAddress(),
          await other1.getAddress(),
          await other2.getAddress(),
          utils.parseEther("1000")
        )
      ).to.be.revertedWith("Token has not been listed");
    });

    it("CON-ARPB-2: Should fail in afterRepayBorrow() when called by non-iToken", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [other1, other2] = accounts;

      await expect(
        controller.afterRepayBorrow(
          await iUSDx.address,
          await other1.getAddress(),
          await other2.getAddress(),
          utils.parseEther("1000")
        )
      ).to.be.revertedWith("sender must be iToken");
    });
  });

  describe("beforeLiquidateBorrow()/afterLiquidateBorrow()", function () {
    it("CON-BLQB-1: Should be able check beforeLiquidateBorrow()", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [other1, other2] = accounts;

      // User have not borrow any asset
      await expect(
        controller.callStatic.beforeLiquidateBorrow(
          iUSDx.address,
          iUSDx.address,
          await other1.getAddress(),
          await other2.getAddress(),
          utils.parseEther("1000")
        )
      ).to.be.revertedWith("Account does not have shortfall");
    });

    it("CON-BLQB-2: Should fail in beforeLiquidateBorrow() with non-listed market", async function () {
      const { controller, owner, accounts } = await loadFixture(fixtureDefault);
      const [other1, other2] = accounts;

      await expect(
        controller.beforeLiquidateBorrow(
          await owner.getAddress(),
          await owner.getAddress(),
          await other1.getAddress(),
          await other2.getAddress(),
          utils.parseEther("1000")
        )
      ).to.be.revertedWith("Tokens have not been listed");
    });

    it("CON-BLQB-3: Should return false in beforeLiquidateBorrow() with no shortfall borrower", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [other1, other2] = accounts;

      await controller.connect(other2).enterMarkets([iUSDx.address]);

      await expect(
        controller.callStatic.beforeLiquidateBorrow(
          iUSDx.address,
          iUSDx.address,
          await other1.getAddress(),
          await other2.getAddress(),
          utils.parseEther("1000")
        )
      ).to.be.revertedWith("Account does not have shortfall");
    });

    it("CON-BLQB-4: Should return correct value in beforeLiquidateBorrow() with some shortfall", async function () {
      // const {
      //   controller,
      //   iUSDx,
      //   iUSDT,
      //   accounts,
      //   mockPriceOracle,
      // } = await loadFixture(fixtureShortfall);

      const { controller, iUSDx, iUSDT, mockPriceOracle, accounts } =
        await loadFixture(fixtureDefault);

      const [user0, user1] = accounts;
      const account0 = await user0.getAddress();
      const account1 = await user1.getAddress();

      // Use mock oracle
      await controller._setPriceOracle(mockPriceOracle.address);

      let rawAmount = BigNumber.from("1000");
      const iUSDxDecimals = await iUSDx.decimals();
      const iUSDTDecimals = await iUSDT.decimals();
      let mintiUSDxAmount = rawAmount.mul(
        BigNumber.from(10).pow(iUSDxDecimals)
      );
      let mintiUSDTAmount = rawAmount.mul(
        BigNumber.from(10).pow(iUSDTDecimals)
      );
      let amount = mintiUSDxAmount;

      await iUSDx.connect(user0).mint(account0, amount);
      await iUSDT.connect(user1).mint(account1, mintiUSDTAmount);

      // User use iUSDx as collateral, and borrow some USDT
      await controller
        .connect(user0)
        .enterMarkets([iUSDx.address, iUSDT.address]);
      await iUSDT.connect(user0).borrow(mintiUSDTAmount.div(2).mul(9).div(10));
      borrowBalance = await iUSDT.borrowBalanceStored(account0);

      //console.log("Borrow Balance:", borrowBalance.toString());

      // USDx price drop to 0.5
      await setOraclePrices(mockPriceOracle, [iUSDx], [0.5]);

      // const [user0, user1] = accounts;
      // const account0 = await user0.getAddress();
      // const account1 = await user1.getAddress();

      // borrowBalance = (await iUSDT.borrowBalanceStored(account0));
      // console.log("Borrow Balance:", borrowBalance.toString());

      // equity = 1000 * 0.5 * 0.9 - 450 * 1 * 1 = 0
      await expect(
        controller.callStatic.beforeLiquidateBorrow(
          iUSDx.address,
          iUSDT.address,
          account1,
          account0,
          utils.parseEther("1000")
        )
      ).to.be.revertedWith("Account does not have shortfall");

      // USDx price drop to 0.3
      // equity = 1000 * 0.3 * 0.9 - 450 * 1 * 1 = -18
      await setOraclePrices(mockPriceOracle, [iUSDx], [0.3]);

      // Try to liquidate up to max repay amount borrow balance * 0.5
      borrowBalance = await iUSDT.callStatic.borrowBalanceStored(account0);
      let repay = borrowBalance.div(2);

      await controller.callStatic.beforeLiquidateBorrow(
        iUSDT.address,
        iUSDx.address,
        account1,
        account0,
        repay
      );

      // Now slightly more than max repay
      await expect(
        controller.callStatic.beforeLiquidateBorrow(
          iUSDT.address,
          iUSDx.address,
          account1,
          account0,
          repay.add(1)
        )
      ).to.be.revertedWith("Repay exceeds max repay allowed");
    });
  });

  describe("beforeSeize()/afterSeize()", function () {
    it("CON-BSZ-1: Should be able check beforeSeize()", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [other1, other2] = accounts;

      await controller.beforeSeize(
        iUSDx.address,
        iUSDx.address,
        await other1.getAddress(),
        await other2.getAddress(),
        utils.parseEther("1000")
      );
    });

    it("CON-BSZ-2: Should fail in beforeSeize() with non-listed market", async function () {
      const { controller, owner, accounts } = await loadFixture(fixtureDefault);
      const [other1, other2] = accounts;

      await expect(
        controller.beforeSeize(
          await owner.getAddress(),
          await owner.getAddress(),
          await other1.getAddress(),
          await other2.getAddress(),
          utils.parseEther("1000")
        )
      ).to.be.revertedWith("Tokens have not been listed");
    });

    it("CON-BSZ-3: Should fail in beforeSeize() with mismatched controller iToken", async function () {
      const { controller, owner, accounts, iUSDx, iUSDT } = await loadFixture(
        fixtureDefault
      );
      const [other1, other2] = accounts;

      let mockController = await deployMockContract(owner, Controller.abi);
      await mockController.mock.isController.returns(true);
      await iUSDT._setController(mockController.address);

      await expect(
        controller.beforeSeize(
          iUSDx.address,
          iUSDT.address,
          await other1.getAddress(),
          await other2.getAddress(),
          utils.parseEther("1000")
        )
      ).to.be.revertedWith(
        "Controller mismatch between Borrowed and Collateral"
      );
    });

    // it("Should fail in beforeSeize() with some large seize amount", async function () {
    //   const { controller, iUSDx, accounts } = await loadFixture(
    //     fixtureDefault
    //   );
    //   const [other1, other2] = accounts;

    //   await controller.connect(other2).enterMarkets([iUSDx.address]);

    //   await expect(
    //     controller.beforeSeize(
    //       iUSDx.address,
    //       iUSDx.address,
    //       await other1.getAddress(),
    //       await other2.getAddress(),
    //       utils.parseEther("1001")
    //     )
    //   ).to.be.revertedWith("Not enough liquidity");
    // });
  });

  describe("beforeTransfer()/afterTransfer()", function () {
    it("CON-BTRSF-1: Should be able check beforeTransfer()", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [account1, account2] = accounts;

      let amount = utils.parseEther("1000");
      await iUSDx.connect(account1).mint(await account1.getAddress(), amount);

      await controller.callStatic.beforeTransfer(
        iUSDx.address,
        await account1.getAddress(),
        await account2.getAddress(),
        amount
      );
    });

    it("CON-BTRSF-2: Should fail in beforeTransfer() with non-listed market", async function () {
      const { controller, owner, accounts } = await loadFixture(fixtureDefault);
      const [other1, other2] = accounts;

      await expect(
        controller.beforeTransfer(
          await owner.getAddress(),
          await other1.getAddress(),
          await other2.getAddress(),
          utils.parseEther("1000")
        )
      ).to.be.revertedWith("Token has not been listed");
    });

    it("CON-BTRSF-3: Should fail in beforeTransfer() with some large transfer amount", async function () {
      const { controller, iUSDx, iUSDT, accounts } = await loadFixture(
        fixtureDefault
      );
      const [account1, account2] = accounts;

      let rawAmount = BigNumber.from("1000");
      const iUSDxDecimals = await iUSDx.decimals();
      const iUSDTDecimals = await iUSDT.decimals();
      let mintiUSDxAmount = rawAmount.mul(
        BigNumber.from(10).pow(iUSDxDecimals)
      );
      let mintiUSDTAmount = rawAmount.mul(
        BigNumber.from(10).pow(iUSDTDecimals)
      );
      let amount = mintiUSDxAmount;
      await iUSDx.connect(account1).mint(await account1.getAddress(), amount);

      await iUSDT
        .connect(account2)
        .mint(await account1.getAddress(), mintiUSDTAmount);

      await controller.connect(account1).enterMarkets([iUSDx.address]);
      await iUSDT.connect(account1).borrow(mintiUSDTAmount.div(10));

      await expect(
        controller.callStatic.beforeTransfer(
          iUSDx.address,
          await account1.getAddress(),
          await account2.getAddress(),
          amount
        )
      ).to.be.revertedWith("Account has some shortfall");
    });

    it.skip("CON-BTRSF-4: Should fail in beforeTransfer() if account's any asset price is invalid in controllerStock", async function () {
      const { controllerStock, iUSDx, iUSDT, accounts, mockPriceOracle } =
        await loadFixture(fixtureDefault);
      const [account1, account2] = accounts;

      // Use controllerStock
      await iUSDx._setController(controllerStock.address);
      await iUSDT._setController(controllerStock.address);

      // Use mock oracle
      await controllerStock._setPriceOracle(mockPriceOracle.address);

      let rawAmount = BigNumber.from("1000");
      let mintiUSDxAmount = await parseTokenAmount(iUSDx, rawAmount);
      let mintiUSDTAmount = await parseTokenAmount(iUSDT, rawAmount);
      let amount = mintiUSDxAmount;

      await iUSDx
        .connect(account1)
        .mint(await account1.getAddress(), mintiUSDxAmount);

      await iUSDT
        .connect(account2)
        .mint(await account1.getAddress(), mintiUSDTAmount);

      await controllerStock.connect(account1).enterMarkets([iUSDx.address]);
      await iUSDT.connect(account1).borrow(mintiUSDTAmount.div(10));

      let caseArgs = [
        [
          [iUSDx, iUSDT],
          [1, 0],
          [true, true],
        ],
        [
          [iUSDx, iUSDT],
          [1, 1],
          [false, true],
        ],
        [
          [iUSDx, iUSDT],
          [0, 1],
          [true, true],
        ],
        [
          [iUSDx, iUSDT],
          [1, 1],
          [true, false],
        ],
      ];

      for (args of caseArgs) {
        await setOraclePrices(mockPriceOracle, ...args);
        await expect(
          controllerStock.beforeTransfer(
            iUSDx.address,
            await account1.getAddress(),
            await account2.getAddress(),
            amount
          )
        ).to.revertedWith("Invalid price to calculate account equity");
      }
    });
  });

  describe("beforeFlashloan()/afterFlashloan()", function () {
    it("Should be able check beforeFlashloan()", async function () {
      const { controller, iUSDx, accounts } = await loadFixture(fixtureDefault);
      const [account1, account2] = accounts;

      let amount = utils.parseEther("1000000000");

      await controller.callStatic.beforeFlashloan(
        iUSDx.address,
        await account1.getAddress(),
        amount
      );
    });

    it("Should fail in beforeFlashloan() with non-listed market", async function () {
      const { controller, owner, accounts } = await loadFixture(fixtureDefault);
      const [other1, other2] = accounts;

      let amount = utils.parseEther("1000000000");

      await expect(
        controller.beforeFlashloan(
          await owner.getAddress(),
          await other1.getAddress(),
          amount
        )
      ).to.be.revertedWith("Token has not been listed");
    });
  });
});
