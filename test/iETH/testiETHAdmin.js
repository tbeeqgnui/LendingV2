const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  increaseBlock,
  fixtureDefault,
  getiTokenCurrentData,
  getBlock,
} = require("../helpers/fixtures.js");

const zeroAddress = ethers.constants.AddressZero;

let iToken, iUSDT, iETH, controller, interestRateModel;
let underlying, USDT;
let users, user1, user2, user3, owner;
let oracle;
let iTokenDecimals, iUSDTDecimals;
let actualiTokenMintAmount, actualiUSDTMintAmount;

describe("iETH Admin", function () {
  const rawMintAmount = ethers.BigNumber.from("500000");

  async function init() {
    ({
      controller: controller,
      owner: owner,
      iUSDx: iToken,
      USDx: underlying,
      iUSDT: iUSDT,
      iETH: iETH,
      USDT: USDT,
      interestRateModel: interestRateModel,
      accounts: users,
      flashloanExecutor: flashloanExecutor,
      flashloanExecutorFailure: flashloanExecutorFailure,
      priceOracle: oracle,
    } = await loadFixture(fixtureDefault));
    [user1, user2, user3] = users;
    await controller
      .connect(user1)
      .enterMarkets([iToken.address, iUSDT.address]);
    await controller
      .connect(user2)
      .enterMarkets([iToken.address, iUSDT.address]);
    await controller.connect(user3).enterMarkets([iUSDT.address]);
    iTokenDecimals = await iToken.decimals();
    actualiTokenMintAmount = rawMintAmount.mul(
      ethers.BigNumber.from("10").pow(iTokenDecimals)
    );
    iUSDTDecimals = await iUSDT.decimals();
    actualiUSDTMintAmount = rawMintAmount.mul(
      ethers.BigNumber.from("10").pow(iUSDTDecimals)
    );
    await iToken.connect(user1).mint(user1.address, actualiTokenMintAmount);
    await iToken.connect(user2).mint(user2.address, actualiTokenMintAmount);
    await iUSDT.connect(user1).mint(user1.address, actualiUSDTMintAmount);
    await iUSDT.connect(user2).mint(user2.address, actualiUSDTMintAmount);
    await iUSDT.connect(user3).mint(user3.address, actualiUSDTMintAmount);

    await iETH
      .connect(user1)
      .mint(user1.address, { value: ethers.utils.parseEther("200") });
    await user2.sendTransaction({
      to: underlying.address,
      value: ethers.utils.parseEther("200"),
    });
    await underlying.transferEthOut(
      iETH.address,
      ethers.utils.parseEther("200")
    );
  }

  describe("Test iETH all scenarios for _withdrawReserves", async function () {
    it("IETH-RESV-0: Initialize and check data", async function () {
      await init();

      await iETH.connect(user3).borrow(ethers.utils.parseEther("200"));

      // mine block to accrue interest.
      await increaseBlock(1000);
      await iETH.updateInterest();

      let data = await getiTokenCurrentData(iETH);
      expect(await iETH.totalReserves()).to.equal(data.totalReserves);
      expect(await iETH.totalBorrows()).to.equal(data.totalBorrows);
      expect(await iETH.borrowIndex()).to.equal(data.borrowIndex);
      expect(await iETH.accrualBlockNumber()).to.equal(data.accrualBlockNumber);
    });

    it("IETH-RESV-1: Should revert when caller is not the owner", async function () {
      let data = await getiTokenCurrentData(iETH);
      await expect(
        iETH.connect(user2)._withdrawReserves(data.totalReserves)
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    it("IETH-RESV-2: Should revert due to too much to withdraw", async function () {
      await expect(
        iETH._withdrawReserves(
          (await iETH.getCash()).add(ethers.utils.parseUnits("1", "wei"))
        )
      ).to.be.revertedWith(
        "_withdrawReserves: Invalid withdraw amount and do not have enough cash!"
      );

      await expect(
        iETH._withdrawReserves(
          (
            await getiTokenCurrentData(iETH, 1)
          ).totalReserves.add(ethers.utils.parseUnits("1", "wei"))
        )
      ).to.be.revertedWith(
        "_withdrawReserves: Invalid withdraw amount and do not have enough cash!"
      );
    });

    it("IETH-RESV-3: Should withdraw reserve correctly", async function () {
      data = await getiTokenCurrentData(iETH, 1);
      let withdrawAmount = ethers.utils.parseUnits("1", "wei");
      await expect(() =>
        iETH._withdrawReserves(withdrawAmount)
      ).to.changeEtherBalance(owner, withdrawAmount);

      expect(await iETH.totalReserves()).to.equal(
        data.totalReserves.sub(withdrawAmount)
      );

      data = await getiTokenCurrentData(iETH, 1);
      await expect(() =>
        iETH._withdrawReserves(data.totalReserves)
      ).to.changeEtherBalance(owner, data.totalReserves);

      expect(await iETH.totalReserves()).to.equal(
        ethers.utils.parseUnits("0", "wei")
      );
    });
  });

  describe("Test iETH all scenarios for _setInterestRateModel", async function () {
    it("IETH-SIRM-0: Should revert due to not an interest rate model", async function () {
      const MockInterestRateModel = await ethers.getContractFactory(
        "MockInterestRateModel"
      );
      const mockInterestRateModel = await MockInterestRateModel.deploy();
      await mockInterestRateModel.deployed();

      await expect(
        iETH.connect(owner)._setInterestRateModel(mockInterestRateModel.address)
      ).to.be.revertedWith(
        "_setInterestRateModel: This is not the rate model contract!"
      );
    });
  });

  describe("Test iETH all scenarios for initialize", async function () {
    it("IETH-INIT-0: Should revert due to Initialize again", async function () {
      await expect(
        iETH
          .connect(user2)
          .initialize(
            "iETH",
            "iETH",
            controller.address,
            interestRateModel.address
          )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });
});
