const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const { fromRpcSig } = require("ethereumjs-util");
const ethSigUtil = require("eth-sig-util");
const Wallet = require("ethereumjs-wallet").default;

const { EIP712Domain, domainSeparator } = require("../helpers/eip712");

const { executeAndVerify } = require("../helpers/contractData.js");

const Permit = [
  { name: "owner", type: "address" },
  { name: "spender", type: "address" },
  { name: "chainId", type: "uint256" },
  { name: "value", type: "uint256" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
];

const {
  parseTokenAmount,
  formatTokenAmount,
  verifyOnlyOwner,
  setOraclePrices,
  deployProxy,
  rmul,
  rdiv,
  msdEquityPerBlock,
  calcMaxBorrowedAmount,
} = require("../helpers/utils.js");

const {
  deployFixedInterestRateModel,
  deployiMSD,
  deployMSDController,
  loadFixture,
  fixtureDefault,
  getChainId,
  getiTokenCurrentData,
  increaseBlock,
  increaseTime,
  deployLendingData,
  getBlock,
} = require("../helpers/fixtures.js");

const { getBorrowBalanceCurrent } = require("../helpers/currentData.js");
const { executeOperations } = require("../helpers/contractData.js");
const { zeroAddress } = require("../../config/commonConfig");
const BASE = ethers.utils.parseEther("1");
const AddressZero = ethers.constants.AddressZero;
const Zero = ethers.BigNumber.from("0");

describe("Test for MSD Controller", function () {
  let USX, iMUSX, USXS, msdController;
  let iUSDx;
  let accounts;
  let controller, fixedInterestRateModel;

  before(async function () {
    ({
      accounts,
      iMUSX,
      iUSDx,
      msdController,
      USX,
      USXS,
      controller,
      msdController,
      fixedInterestRateModel,
    } = await loadFixture(fixtureDefault));
    let user1 = accounts[1];
    await iUSDx
      .connect(user1)
      .mint(user1.address, ethers.utils.parseEther("900"));
    await controller.connect(user1).enterMarkets([iUSDx.address]);
  });

  describe("Test for MSD controller", function () {
    it("0-0. Should revert when try to call `initialize` again", async function () {
      // Has initialized contract, so there should be a contract owner.
      let currentOwner = await msdController.owner();
      expect(currentOwner).to.not.equal(AddressZero);
      // So try to call initialize again will fail.
      await expect(msdController.initialize()).to.be.revertedWith(
        "Initializable: contract is already initialized"
      );
    });

    it("0-1. Should revert when try to call `calcEquity` with a non-msd-token", async function () {
      // Use a non-msd-token
      let isiToken = await iUSDx.isiToken();
      expect(isiToken).to.equal(true);
      await expect(msdController.calcEquity(iUSDx.address)).to.be.revertedWith(
        "token is not a valid MSD token"
      );
    });

    // MSDControllerV2: All interest goes to iMSD reserve, calcEquity is not plausible any more
    it.skip("0-2. Should revert when try to call `calcEquity` with a non-support-msd-token", async function () {
      let beforeMinters = await msdController.getMSDMinters(USX.address);
      let earnings = (await msdController.msdTokenData(USX.address)).earning;
      // Before minting MSD token, there is no earnings.
      expect(earnings).to.equal("0");

      let borrower = accounts[1];
      // Supply token to mint msd token.
      await iMUSX.connect(borrower).borrow(ethers.utils.parseEther("30"));

      await increaseBlock(100);
      await increaseTime(100);
      // update msd token earnings.
      await iMUSX.connect(borrower).borrow(ethers.utils.parseEther("10"));

      earnings = (await msdController.msdTokenData(USX.address)).earning;
      // After minting MSD token, there will be earnings.
      expect(earnings).to.gt("0");

      await msdController._removeMinter(USX.address, iMUSX.address);
      let afterMinters = await msdController.getMSDMinters(USX.address);
      // console.log("after removing, minter is: ", minters.toString());
      expect(beforeMinters.length).to.gt(afterMinters.length);

      await increaseBlock(100);
      await increaseTime(100);
      await msdController.calcEquity(USX.address);

      // do not support this msd token, so will not accrued new interests.
      let afterEarnings = (await msdController.msdTokenData(USX.address))
        .earning;
      expect(afterEarnings).to.equal(earnings);

      // revert the changes.
      await msdController._addMinters(USX.address, [iMUSX.address]);
    });

    it("0-3. Should revert when call mint msdToken by a user account", async function () {
      await expect(
        msdController.mintMSD(USX.address, accounts[1].address, "100")
      ).to.be.revertedWith("onlyMinter: caller is not the token's minter");
    });

    it("0-4. Should revert when mint a non-supported MSD token", async function () {
      // deploy a new MSD token.
      let newMSDToken = await deployiMSD(
        "New MSD Token",
        "NMT",
        USX.address,
        controller.address,
        fixedInterestRateModel.address,
        msdController.address
      );

      await expect(
        msdController.mintMSD(
          newMSDToken.address,
          accounts[1].address,
          ethers.utils.parseEther("10")
        )
      ).to.be.revertedWith("token is not a valid MSD token");
    });

    it("0-5. Should revert when mint amount exceeds the borrow capacity with 1 wei.", async function () {
      let borrower = accounts[1];
      // set borrow capacity
      await controller._setBorrowCapacity(
        iMUSX.address,
        ethers.utils.parseEther("100")
      );
      // get details about iMSD token
      let market = await controller.markets(iMUSX.address);

      // calculate actual has mint amount with interests.
      let expectedData = await getiTokenCurrentData(iMUSX, 1);
      // get max borrow amount
      let availableToMint = market.borrowCapacity.sub(
        expectedData.totalBorrows
      );

      await iMUSX.connect(borrower).borrow(availableToMint);

      // mint for another 1 wei to exceed borrow capacity.
      await expect(
        iMUSX.connect(borrower).borrow(ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Token borrow capacity reached");
      // revert the changes.
      await controller._setBorrowCapacity(
        iMUSX.address,
        ethers.constants.MaxUint256
      );
    });

    it("0-6. Should revert when mint has been paused.", async function () {
      let borrower = accounts[1];
      let market = await controller.markets(iMUSX.address);
      expect(market.borrowPaused).to.equal(false);

      // pause the action of borrow
      await controller._setBorrowPaused(iMUSX.address, true);
      market = await controller.markets(iMUSX.address);
      expect(market.borrowPaused).to.equal(true);

      await expect(
        iMUSX.connect(borrower).borrow(ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Token borrow has been paused");

      // revert the changes.
      await controller._setBorrowPaused(iMUSX.address, false);
    });

    it("0-7. Should revert when MSD token is zero address", async function () {
      // Add USX into MSD Controller's token list.
      await expect(
        msdController._addMSD(
          AddressZero,
          [iMUSX.address, USXS.address],
          [ethers.constants.MaxUint256, ethers.constants.MaxUint256]
        )
      ).to.be.revertedWith("MSD token cannot be a zero address");
    });

    it("0-8. Should revert when a user tries to add MSD token", async function () {
      let user1 = accounts[0];
      // Add USX into MSD Controller's token list.
      await expect(
        msdController
          .connect(user1)
          ._addMSD(
            USX.address,
            [iMUSX.address, USXS.address],
            [ethers.constants.MaxUint256, ethers.constants.MaxUint256]
          )
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    it("0-10. Should revert when add zero address as a minter", async function () {
      // Add USX into MSD Controller's token list.
      await expect(
        msdController._addMinters(
          USX.address,
          [iMUSX.address, USXS.address, AddressZero],
          [
            ethers.constants.MaxUint256,
            ethers.constants.MaxUint256,
            ethers.constants.MaxUint256,
          ]
        )
      ).to.be.revertedWith("minter cannot be a zero address");
    });

    it("0-11. Should revert when add a non-MSD token", async function () {
      await expect(
        msdController._addMinters(
          iMUSX.address,
          [USX.address],
          [ethers.constants.MaxUint256]
        )
      ).to.be.revertedWith("token is not a valid MSD token");
    });

    it("0-12. Should revert when a user calls `_addMinters`", async function () {
      let user1 = accounts[0];
      await expect(
        msdController
          .connect(user1)
          ._addMinters(
            iMUSX.address,
            [USX.address],
            [ethers.constants.MaxUint256]
          )
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    it("0-13. Should revert when remove minter is zero address.", async function () {
      await expect(
        msdController._removeMinters(USX.address, [AddressZero])
      ).to.be.revertedWith("minter cannot be a zero address");
    });

    it("0-14. Should revert when remove minter of a non-msdToken", async function () {
      await expect(
        msdController._removeMinters(iUSDx.address, [iMUSX.address])
      ).to.be.revertedWith("token is not a valid MSD token");
    });

    it("0-15. Should revert when removes minter by a user account", async function () {
      await expect(
        msdController
          .connect(accounts[1])
          ._removeMinters(USX.address, [iMUSX.address])
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    it("0-16. Should revert when withdraw token is zero address", async function () {
      await expect(
        msdController._withdrawReserves(AddressZero, "123")
      ).to.be.revertedWith("token is not a valid MSD token");
    });

    it("0-17. Can withdraw reserve with 0", async function () {
      await msdController._withdrawReserves(USX.address, "0");
    });

    it("0-18. Should revert when withdraw reserves for a non-msd token", async function () {
      await expect(
        msdController._withdrawReserves(iMUSX.address, "123")
      ).to.be.revertedWith("token is not a valid MSD token");
    });

    it("0-19. Should revert when a user withdraws reserves", async function () {
      await expect(
        msdController.connect(accounts[1])._withdrawReserves(USX.address, "0")
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });
  });

  describe("Test for mint msdToken", function () {
    it("Should revert when call mint msdToken by a user account", async function () {
      await expect(
        msdController.mintMSD(USX.address, accounts[1].address, "100")
      ).to.be.revertedWith("onlyMinter: caller is not the token's minter");
    });
  });

  describe("Test for removing minter", function () {
    it("Should remove msdToken minter correctly", async function () {
      // Add USX into MSD Controller's token list firstly.
      await msdController._addMSD(
        USX.address,
        [iMUSX.address, USXS.address],
        [ethers.constants.MaxUint256, ethers.constants.MaxUint256]
      );
      // Remove a minter of the USX.
      await msdController._removeMinters(USX.address, [USXS.address]);
    });

    it("Should to remove an unexist minter of msdToken", async function () {
      await msdController._removeMinters(USX.address, [USXS.address]);
    });
  });

  describe("Test for common checks", function () {
    it("This controller is the msdToken controller", async function () {
      expect(await msdController.isMSDController()).to.equal(true);
    });

    it("Get all msdTokens", async function () {
      let allMSDTokens = await msdController.getAllMSDs();
      expect(allMSDTokens.length).to.equal(3);
    });
  });
});

describe("Test for iMSD token", function () {
  let iUSDx,
    iUSDT,
    USX,
    iMUSX,
    controller,
    msdController,
    priceOracle,
    interestRateModel,
    lendingData;
  let amount;
  let owner, borrower, payer, accounts;
  let borrowerAddr, payerAddr;
  let mockPriceOracle;
  let nonListediMSD, nonListedMSD;

  async function init() {
    ({
      USX,
      iMUSX,
      nonListediMSD,
      nonListedMSD,
      owner,
      accounts,
      iUSDx,
      iUSDT,
      controller,
      msdController,
      priceOracle,
      fixedInterestRateModel: interestRateModel,
      lendingData,
      mockPriceOracle,
    } = await loadFixture(fixtureDefault));
    await msdController._addMSD(
      USX.address,
      [iMUSX.address],
      [ethers.constants.MaxUint256]
    );
    await USX._addMinter(msdController.address);

    amount = await parseTokenAmount(USX, 1000);
    [borrower, payer] = accounts;

    borrowerAddr = await borrower.getAddress();
    payerAddr = await payer.getAddress();

    // Approve -1 to repay.
    await USX.connect(borrower).approve(
      iMUSX.address,
      ethers.constants.MaxUint256
    );

    await USX.connect(payer).approve(
      iMUSX.address,
      ethers.constants.MaxUint256
    );
  }

  it("init", async function () {
    await init();
    await iUSDx
      .connect(borrower)
      .mint(borrower.address, ethers.utils.parseEther("9000"));
    await controller.connect(borrower).enterMarkets([iUSDx.address]);
    await iMUSX.connect(borrower).borrow(ethers.utils.parseEther("10"));
    await iUSDx.connect(borrower).borrow(ethers.utils.parseEther("10"));
  });

  it("1-0. Should revert when try to call `initialize` again", async function () {
    // Has initialized contract, so there should be a contract owner.
    let currentOwner = await iMUSX.owner();
    expect(currentOwner).to.not.equal(AddressZero);
    // So try to call initialize again will fail.
    await expect(
      iMUSX.initialize(
        USX.address,
        "new iMSD token",
        "NMT",
        lendingData.address,
        interestRateModel.address,
        msdController.address
      )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("1-1. Can borrow 0 msd token", async function () {
    // deposit some asset as collateral to borrow.
    await iUSDx
      .connect(borrower)
      .mint(borrower.address, ethers.utils.parseEther("9000"));
    await controller.connect(borrower).enterMarkets([iUSDx.address]);
    let beforeTotalBorrows = await iMUSX.totalBorrows();
    let beforeUSXBalance = await USX.balanceOf(borrower.address);
    let beforeBorrowedAmount = await iMUSX.borrowBalanceStored(
      borrower.address
    );

    let expectedData = await getiTokenCurrentData(iMUSX, 1);

    await iMUSX.connect(borrower).borrow("0");

    let afterTotalBorrows = await iMUSX.totalBorrows();
    let afterUSXBalance = await USX.balanceOf(borrower.address);
    let afterBorrowedAmount = await iMUSX.borrowBalanceStored(borrower.address);

    expect(afterUSXBalance).to.equal(beforeUSXBalance);
    expect(afterTotalBorrows).to.equal(expectedData.totalBorrows);
    expect(beforeTotalBorrows.add(expectedData.interestAccumulated)).to.equal(
      afterTotalBorrows
    );
    expect(
      beforeBorrowedAmount
        .add(expectedData.interestAccumulated)
        .sub(afterBorrowedAmount)
    ).to.lt("100");
  });

  it("1-2. Should revert when the price of the borrowed asset is 0", async function () {
    await controller._setPriceOracle(mockPriceOracle.address);
    await setOraclePrices(mockPriceOracle, [iMUSX], [0]);

    let price = await mockPriceOracle.getUnderlyingPrice(iMUSX.address);
    expect(price).to.equal("0");

    await expect(iMUSX.connect(borrower).borrow("1")).to.be.revertedWith(
      "Invalid price to calculate account equity"
    );

    // revert changes
    await setOraclePrices(mockPriceOracle, [iMUSX], [1]);
    price = await mockPriceOracle.getUnderlyingPrice(iMUSX.address);
    expect(price).to.gt("0");
  });

  it("1-3. Can repay 0 msd token", async function () {
    let borrowAmount = ethers.utils.parseEther("50");
    await iMUSX.connect(borrower).borrow(borrowAmount);

    let borrowedAmount = await iMUSX.borrowBalanceStored(borrower.address);
    expect(borrowedAmount).to.gt(0);

    let beforeTotalBorrows = await iMUSX.totalBorrows();
    let beforeUSXBalance = await USX.balanceOf(borrower.address);
    let beforeBorrowedAmount = await iMUSX.borrowBalanceStored(
      borrower.address
    );

    let expectedData = await getiTokenCurrentData(iMUSX, 1);

    await iMUSX.connect(borrower).repayBorrow("0");

    let afterTotalBorrows = await iMUSX.totalBorrows();
    let afterUSXBalance = await USX.balanceOf(borrower.address);
    let afterBorrowedAmount = await iMUSX.borrowBalanceStored(borrower.address);

    expect(afterUSXBalance).to.equal(beforeUSXBalance);
    expect(afterTotalBorrows).to.equal(expectedData.totalBorrows);
    expect(beforeTotalBorrows.add(expectedData.interestAccumulated)).to.equal(
      afterTotalBorrows
    );
    expect(
      beforeBorrowedAmount
        .add(expectedData.interestAccumulated)
        .sub(afterBorrowedAmount)
    ).to.lt("100");
  });

  it("1-4. Can repay 0 msd token for others", async function () {
    await iMUSX.connect(borrower).borrow(amount);
    await USX.connect(borrower).transfer(payerAddr, amount);

    const action = {
      target: iMUSX,
      executor: borrower,
      func: "repayBorrowBehalf",
      args: [borrower.address, 0],
    };
    await executeAndVerify(action, [iMUSX], [borrower.address]);
  });

  it("1-5. Should revert when liquidate amount is 0", async function () {
    let market = await controller.markets(iUSDx.address);
    let oldCollateralFactor = market.collateralFactorMantissa;
    // set collateral factor as 0, so can liquidate account.
    await controller._setCollateralFactor(iUSDx.address, "0");
    let borrowerEquity = await controller.calcAccountEquity(borrower.address);

    expect(borrowerEquity[0]).to.equal("0");
    expect(borrowerEquity[1]).to.gt("0");
    await expect(
      iMUSX.connect(payer).liquidateBorrow(borrower.address, "0", iUSDx.address)
    ).to.be.revertedWith(
      "_liquidateBorrowInternal: Liquidate amount should be greater than 0!"
    );

    // revert changes
    await controller._setCollateralFactor(iUSDx.address, oldCollateralFactor);
  });

  it("1-6. Should revert when liquidate too much", async function () {
    let repayAmount = ethers.utils.parseEther("9000");
    await iUSDx.connect(payer).mint(payer.address, repayAmount);
    let market = await controller.markets(iUSDx.address);
    let oldCollateralFactor = market.collateralFactorMantissa;
    // set collateral factor as 0, so can liquidate account.
    await controller._setCollateralFactor(iUSDx.address, "0");
    let borrowerEquity = await controller.calcAccountEquity(borrower.address);

    expect(borrowerEquity[0]).to.equal("0");
    expect(borrowerEquity[1]).to.gt("0");

    await expect(
      iMUSX
        .connect(payer)
        .liquidateBorrow(borrower.address, repayAmount, iUSDx.address)
    ).to.be.revertedWith("Repay exceeds max repay allowed");

    // revert changes
    await controller._setCollateralFactor(iUSDx.address, oldCollateralFactor);
  });

  it("1-7. Should revert when asset price is 0", async function () {
    let market = await controller.markets(iUSDx.address);
    let oldCollateralFactor = market.collateralFactorMantissa;
    // set collateral factor as 0, so can liquidate account.
    await controller._setCollateralFactor(iUSDx.address, "0");
    let borrowerEquity = await controller.calcAccountEquity(borrower.address);

    expect(borrowerEquity[0]).to.equal("0");
    expect(borrowerEquity[1]).to.gt("0");

    // change borrowed asset price
    await setOraclePrices(mockPriceOracle, [iMUSX], [0]);
    let price = await mockPriceOracle.getUnderlyingPrice(iMUSX.address);
    expect(price).to.equal("0");

    await expect(
      iMUSX
        .connect(payer)
        .liquidateBorrow(borrower.address, BASE, iUSDx.address)
    ).to.be.revertedWith("Invalid price to calculate account equity");

    // revert changes
    await setOraclePrices(mockPriceOracle, [iMUSX], [1]);
    price = await mockPriceOracle.getUnderlyingPrice(iMUSX.address);
    expect(price).to.gt("0");

    // change collateral asset price
    await setOraclePrices(mockPriceOracle, [iUSDx], [0]);
    await expect(
      iMUSX
        .connect(payer)
        .liquidateBorrow(borrower.address, BASE, iUSDx.address)
    ).to.be.revertedWith("Invalid price to calculate account equity");

    // revert changes
    await setOraclePrices(mockPriceOracle, [iUSDx], [1]);
    price = await mockPriceOracle.getUnderlyingPrice(iUSDx.address);
    expect(price).to.gt("0");

    await controller._setCollateralFactor(iUSDx.address, oldCollateralFactor);
  });

  it("1-8. Should revert when paused liquidation", async function () {
    let market = await controller.markets(iUSDx.address);
    let oldCollateralFactor = market.collateralFactorMantissa;
    // set collateral factor as 0, so can liquidate account.
    await controller._setCollateralFactor(iUSDx.address, "0");
    let borrowerEquity = await controller.calcAccountEquity(borrower.address);

    expect(borrowerEquity[0]).to.equal("0");
    expect(borrowerEquity[1]).to.gt("0");

    // pause liquidation.
    await controller._setSeizePaused(true);
    await expect(
      iMUSX
        .connect(payer)
        .liquidateBorrow(borrower.address, BASE, iUSDx.address)
    ).to.be.revertedWith("Seize has been paused");

    // revert changes\
    await controller._setCollateralFactor(iUSDx.address, oldCollateralFactor);

    await controller._setSeizePaused(false);
  });

  it("1-9. Should revert when seize iMtoken", async function () {
    let market = await controller.markets(iUSDx.address);
    let oldCollateralFactor = market.collateralFactorMantissa;
    // set collateral factor as 0, so can liquidate account.
    await controller._setCollateralFactor(iUSDx.address, "0");
    let borrowerEquity = await controller.calcAccountEquity(borrower.address);

    expect(borrowerEquity[0]).to.equal("0");
    expect(borrowerEquity[1]).to.gt("0");
    await expect(
      iMUSX.connect(payer).seize(iUSDx.address, borrower.address, BASE)
    ).to.be.revertedWith("iMSD Token can not be seized");

    // revert changes
    await controller._setCollateralFactor(iUSDx.address, oldCollateralFactor);
  });

  it("1-10. Should revert when borrow iMSD token, but it is not listed", async function () {
    let borrowerEquity = await controller.calcAccountEquity(borrower.address);
    expect(borrowerEquity[0]).to.gt("0");

    await expect(
      nonListediMSD.connect(borrower).borrow(BASE)
    ).to.be.revertedWith("Token has not been listed");
  });

  it("1-11. Should revert when repay iMSD token, but it is not listed", async function () {
    await expect(
      nonListediMSD.connect(borrower).repayBorrow("0")
    ).to.be.revertedWith("Token has not been listed");
  });

  it("1-12. Should revert when repay borrow behalf iMSD token, but it is not listed", async function () {
    await expect(
      nonListediMSD.connect(borrower).repayBorrowBehalf(borrower.address, "0")
    ).to.be.revertedWith("Token has not been listed");
  });

  it("1-13. Should revert when liquidate, but borrowed asset is not listed", async function () {
    await expect(
      nonListediMSD
        .connect(payer)
        .liquidateBorrow(borrower.address, BASE, iUSDx.address)
    ).to.be.revertedWith("Tokens have not been listed");
  });

  it("1-14. Should revert when liquidate, but collateral asset is not listed", async function () {
    let market = await controller.markets(iUSDx.address);
    let oldCollateralFactor = market.collateralFactorMantissa;
    // set collateral factor as 0, so can liquidate account.
    await controller._setCollateralFactor(iUSDx.address, "0");
    let borrowerEquity = await controller.calcAccountEquity(borrower.address);

    expect(borrowerEquity[0]).to.equal("0");
    expect(borrowerEquity[1]).to.gt("0");
    await expect(
      iMUSX
        .connect(payer)
        .liquidateBorrow(borrower.address, BASE, nonListediMSD.address)
    ).to.be.revertedWith("Tokens have not been listed");

    // revert changes
    await controller._setCollateralFactor(iUSDx.address, oldCollateralFactor);
  });

  it.skip("1-16. Should revert when tries to borrow more but has borrowed max amount", async function () {
    let maxBorrowAmount = await lendingData.callStatic.getAccountBorrowData(
      iMUSX.address,
      borrower.address,
      BASE
    );
    console.log("maxBorrowAmount", maxBorrowAmount[2].toString());

    let currentData = await getiTokenCurrentData(iMUSX, 1);
    console.log("currentData", currentData.interestAccumulated.toString());

    await iMUSX
      .connect(borrower)
      .borrow(maxBorrowAmount[2].sub(currentData.interestAccumulated));

    // The maximum lent iToken, euqity and shortfall are all 0
    let redeemerEquityInfo = await controller.calcAccountEquity(
      borrower.address
    );
    expect(redeemerEquityInfo[0]).to.equal(0);
    expect(redeemerEquityInfo[1]).to.equal(0);
    expect(redeemerEquityInfo[2]).to.equal(redeemerEquityInfo[3]);

    await expect(iMUSX.connect(borrower).borrow("1")).to.be.revertedWith(
      "Account has some shortfall"
    );
  });

  it("1-15. Should accrued interests correctly", async function () {
    let totalBorrows = await iMUSX.totalBorrows();
    expect(totalBorrows).to.gt("0");

    let borrowAmount = ethers.utils.parseEther("10");

    let caseDetails = [
      {
        user: borrower,
        action: "borrow",
        asset: iMUSX,
        underlying: USX,
        amount: borrowAmount,
        isStableCoin: true,
        lendingData: lendingData,
        controller: controller,
        oracle: priceOracle,
        interestRateModel: interestRateModel,
        safeFactor: ethers.utils.parseEther("0.9"),
      },
      {
        user: borrower,
        action: "repay",
        asset: iMUSX,
        underlying: USX,
        amount: borrowAmount,
        isStableCoin: true,
        lendingData: lendingData,
        controller: controller,
        oracle: priceOracle,
        interestRateModel: interestRateModel,
        safeFactor: ethers.utils.parseEther("0.9"),
      },
      {
        user: payer,
        borrower: borrower,
        action: "repayBorrowBehalf",
        asset: iMUSX,
        underlying: USX,
        amount: borrowAmount,
        isStableCoin: true,
        lendingData: lendingData,
        controller: controller,
        oracle: priceOracle,
        interestRateModel: interestRateModel,
        safeFactor: ethers.utils.parseEther("0.9"),
      },
    ];

    await executeOperations(caseDetails);

    await iMUSX.connect(borrower).borrow(borrowAmount);
    let market = await controller.markets(iUSDx.address);
    let oldCollateralFactor = market.collateralFactorMantissa;
    // set collateral factor as 0, so can liquidate account.
    await controller._setCollateralFactor(iUSDx.address, "0");
    let borrowerEquity = await controller.calcAccountEquity(borrower.address);

    expect(borrowerEquity[0]).to.equal("0");
    expect(borrowerEquity[1]).to.gt("0");

    // use default oralce
    await controller._setPriceOracle(priceOracle.address);

    iMUSX.connect(payer).liquidateBorrow(borrower.address, BASE, iUSDx.address);

    caseDetails = [
      {
        user: payer,
        borrower: borrower,
        action: "liquidateBorrow",
        asset: iMUSX,
        collateral: iUSDx,
        underlying: USX,
        amount: BASE,
        isStableCoin: true,
        lendingData: lendingData,
        controller: controller,
        oracle: priceOracle,
        interestRateModel: interestRateModel,
        safeFactor: ethers.utils.parseEther("0.9"),
      },
    ];

    await executeOperations(caseDetails);
  });

  it("Should not be able to borrow with no collateral", async function () {
    await init();
    await expect(iMUSX.connect(borrower).borrow(amount)).to.be.revertedWith(
      "Account has some shortfall"
    );
  });

  it("0-9. Should be able to borrow after supply some collateral by mint some underlying", async function () {
    await iUSDx
      .connect(borrower)
      .mint(borrowerAddr, await parseTokenAmount(iUSDx, 10000));
    await controller.connect(borrower).enterMarkets([iUSDx.address]);

    // Initial total supply should be 0
    let totalSupply = await USX.totalSupply();
    expect(totalSupply).to.equal(0);

    await expect(() =>
      iMUSX.connect(borrower).borrow(amount)
    ).to.changeTokenBalance(USX, borrower, amount);

    // Now the total supply should be the borrow amount
    totalSupply = await USX.totalSupply();
    expect(totalSupply).to.equal(amount);
  });

  it("Should be able to repay borrow", async function () {
    let borrowBalanceCurrentNoRepay = await getBorrowBalanceCurrent(
      iMUSX,
      borrowerAddr,
      1
    );

    await expect(() =>
      iMUSX.connect(borrower).repayBorrow(amount)
    ).to.changeTokenBalance(USX, borrower, amount.mul(-1));

    let borrowBalanceCurrentRepaid = await iMUSX.borrowBalanceStored(
      borrowerAddr
    );
    expect(borrowBalanceCurrentNoRepay.sub(amount)).to.equal(
      borrowBalanceCurrentRepaid
    );

    // let borrowBalance = await iMUSX.borrowBalanceStored(borrowerAddr);
    // console.log(await formatTokenAmount(iMUSX, borrowBalance));

    // Repaid USX should be burned
    let underlying = await USX.balanceOf(iMUSX.address);
    expect(underlying).to.equal(0);

    // Now total supply should be 0
    let totalSupply = await USX.totalSupply();
    expect(totalSupply).to.equal(0);
  });

  it("Should be able to repay borrow behalf", async function () {
    await iMUSX.connect(borrower).borrow(amount);
    await USX.connect(borrower).transfer(payerAddr, amount);

    let borrowBalanceCurrentBefore = await getBorrowBalanceCurrent(
      iMUSX,
      borrowerAddr,
      1
    );

    await expect(() =>
      iMUSX.connect(payer).repayBorrowBehalf(borrowerAddr, amount)
    ).to.changeTokenBalance(USX, payer, amount.mul(-1));

    let borrowBalanceCurrentAfter = await iMUSX.borrowBalanceStored(
      borrowerAddr
    );
    expect(borrowBalanceCurrentBefore.sub(amount)).to.equal(
      borrowBalanceCurrentAfter
    );

    // Repaid USX should be burned
    let underlying = await USX.balanceOf(iMUSX.address);
    expect(underlying).to.equal(0);

    // Now total supply should be 0
    let totalSupply = await USX.totalSupply();
    expect(totalSupply).to.equal(0);
  });

  it("Should be able to liquidate borrow", async function () {
    let repayAmount = amount.div(10);

    await iMUSX.connect(borrower).borrow(amount);

    // iMUSX price increase will cause a shortfall
    await setOraclePrices(priceOracle, [iMUSX], [10]);

    // Payer does not hold any USX now, transfer some
    await USX.connect(borrower).transfer(payerAddr, repayAmount);

    await expect(() =>
      iMUSX
        .connect(payer)
        .liquidateBorrow(borrowerAddr, repayAmount, iUSDx.address)
    ).to.changeTokenBalance(USX, payer, repayAmount.mul(-1));

    // let borrowBalance = await iMUSX.borrowBalanceStored(borrowerAddr);
    // console.log(await formatTokenAmount(iMUSX, borrowBalance));

    // Liquidate incentive is 10%
    let seizedCollateral = await iUSDx.balanceOf(payerAddr);
    let expectSeized = (
      await parseTokenAmount(iMUSX, await formatTokenAmount(iMUSX, repayAmount))
    ).mul(11);
    expect(seizedCollateral).to.equal(expectSeized);

    // restore iMUSX price
    await setOraclePrices(priceOracle, [iMUSX], [1]);
  });

  it("Should not be able to seize", async function () {
    await iUSDT
      .connect(borrower)
      .mint(borrowerAddr, await parseTokenAmount(iUSDT, 1000));
    let borrowAmount = await parseTokenAmount(iUSDT, 1000);
    let repayAmount = borrowAmount.div(10);

    await iUSDT.connect(borrower).borrow(borrowAmount);

    // iMUSX price increase will cause a shortfall
    await setOraclePrices(priceOracle, [iMUSX], [10]);

    // Try to seize iMUSX
    await expect(
      iUSDT
        .connect(payer)
        .liquidateBorrow(borrowerAddr, repayAmount, iMUSX.address)
    ).to.revertedWith("iMSD Token can not be seized");

    // Try seize with iMUSX itself
    await expect(
      iMUSX
        .connect(payer)
        .liquidateBorrow(borrowerAddr, repayAmount, iMUSX.address)
    ).to.revertedWith("iMSD Token can not be seized");
  });

  it("Should be able to get borrowBalanceCurrent", async function () {
    let expected = await getBorrowBalanceCurrent(iMUSX, borrowerAddr, 1);

    // Do not use callStatic here, interest accumulation are based on blocks
    await iMUSX.borrowBalanceCurrent(borrowerAddr);
    let actual = await iMUSX.borrowBalanceStored(borrowerAddr);

    expect(actual).to.equal(expected);
  });

  it("Should be able to get totalBorrowsCurrent", async function () {
    let { totalBorrows: expected } = await getiTokenCurrentData(iMUSX, 1);

    // Do not use callStatic here, interest accumulation are based on blocks
    await iMUSX.totalBorrowsCurrent();
    let actual = await iMUSX.totalBorrows();

    expect(actual).to.equal(expected);
  });

  it("Should be able to get borrowRatePerUnit", async function () {
    let borrowRate = await interestRateModel.borrowRatesPerBlock(iMUSX.address);
    expect(await iMUSX.borrowRatePerUnit()).to.equal(borrowRate);
  });

  it("Reserve ratio should be fixed to 100%", async function () {
    const reserveRatio = ethers.utils.parseEther("1");
    let newReserveRatio = ethers.utils.parseEther("0.8");

    await verifyOnlyOwner(
      iMUSX, //contract
      "_setNewReserveRatio", // method
      [newReserveRatio], //args
      owner, // owner
      borrower, // non-owner
      "NewReserveRatio", // ownerEvent
      [reserveRatio, reserveRatio], // ownerEventArgs
      // ownerChecks
      async () => {
        expect(await iMUSX.reserveRatio()).to.equal(reserveRatio);
      },
      // nonownerChecks
      async () => {}
    );
  });

  it("Should set a new msdController", async function () {
    // Deploy a new msdController
    let newMSDController = await deployMSDController();
    await iMUSX._setMSDController(newMSDController.address);
    let currentMSDController = await iMUSX.msdController();
    expect(currentMSDController).to.equal(newMSDController.address);
  });

  it("Should not be set new msdController by a user account", async function () {
    let newMSDController = await deployMSDController();
    await expect(
      iMUSX.connect(accounts[1])._setMSDController(newMSDController.address)
    ).to.be.revertedWith("onlyOwner: caller is not the owner");
  });

  it("Should revert when set a non-msdController", async function () {
    await expect(iMUSX._setMSDController(iUSDx.address)).to.be.reverted;
  });
});

describe("Test for MSD token", function () {
  let USX, msdController;
  let priceOracle;
  let amount;
  let owner, accounts, user1;
  let ownerAddr, user1Addr, user2Addr;

  before(async function () {
    ({ USX, owner, accounts, msdController } = await loadFixture(
      fixtureDefault
    ));

    amount = await parseTokenAmount(USX, 1000);
    [user1, user2] = accounts;

    ownerAddr = await owner.getAddress();
    [user1Addr, user2Addr] = await Promise.all(
      [user1, user2].map(async (u) => await u.getAddress())
    );
  });

  it("2-0. Should revert when try to initialize again", async function () {
    let owner = await USX.owner();
    expect(owner).to.not.equal(zeroAddress);
    await expect(USX.initialize("new MSD", "NM", 18)).to.be.revertedWith(
      "Initializable: contract is already initialized"
    );
  });

  it("Should only allow owner to add minter", async function () {
    await verifyOnlyOwner(
      USX, //contract
      "_addMinter", // method
      [ownerAddr], //args
      owner, // owner
      user1, // non-owner
      "MinterAdded", // ownerEvent
      [ownerAddr] // ownerEventArgs
    );

    // Add again should be okay but no event
    await verifyOnlyOwner(
      USX, //contract
      "_addMinter", // method
      [ownerAddr], //args
      owner, // owner
      user1 // non-owner
    );
  });

  it("2-7. Should revert when remove minter is zero address.", async function () {
    await expect(USX._removeMinter(AddressZero)).to.be.revertedWith(
      "_removeMinter: _minter the zero address"
    );
  });

  it("Should only allow owner to remove minter", async function () {
    await verifyOnlyOwner(
      USX, //contract
      "_removeMinter", // method
      [ownerAddr], //args
      owner, // owner
      user1, // non-owner
      "MinterRemoved", // ownerEvent
      [ownerAddr] // ownerEventArgs
    );

    // Remove again should also be okay but no event
    await verifyOnlyOwner(
      USX, //contract
      "_removeMinter", // method
      [ownerAddr], //args
      owner, // owner
      user1 // non-owner
    );
  });

  it("2-5. Should only be minted by minter", async function () {
    await USX._addMinter(ownerAddr);

    // now owner is a minter
    await expect(() => USX.mint(user1Addr, amount)).to.changeTokenBalance(
      USX,
      user1,
      amount
    );

    await expect(USX.connect(user1).mint(user1Addr, amount)).to.be.revertedWith(
      "onlyMinter: caller is not minter"
    );
  });

  it("2-6. Should not add the zero address as the new minter", async function () {
    await expect(USX._addMinter(AddressZero)).to.be.revertedWith(
      "_addMinter: _minter the zero address"
    );
  });

  it("2-1. Can be burned", async function () {
    let amount = await parseTokenAmount(USX, 100);

    let totalSupplyBefore = await USX.totalSupply();

    await expect(() =>
      USX.connect(user1).burn(user1Addr, "0")
    ).to.changeTokenBalance(USX, user1, "0");

    await expect(() =>
      USX.connect(user1).burn(user1Addr, amount)
    ).to.changeTokenBalance(USX, user1, amount.mul(-1));

    let totalSupplyAfter = await USX.totalSupply();
    expect(totalSupplyBefore.sub(totalSupplyAfter)).to.equal(amount);
  });

  it("2-2. Should revert when not have enough approval", async function () {
    await USX.connect(user1).approve(user2Addr, "0");
    await expect(USX.connect(user2).burn(user1Addr, "100")).to.be.revertedWith(
      "SafeMath: subtraction overflow"
    );
  });

  it("2-3. Can be burned by others if approved", async function () {
    let amount = await parseTokenAmount(USX, 100);

    await USX.connect(user1).approve(user2Addr, amount);
    await expect(() =>
      USX.connect(user2).burn(user1Addr, amount)
    ).to.changeTokenBalance(USX, user1, amount.mul(-1));
  });

  it("2-4. Should revert when not a minter mints", async function () {
    await expect(USX.connect(user2).mint(user1Addr, "1000")).to.be.revertedWith(
      "onlyMinter: caller is not minter"
    );
  });

  it("Should be able to get minters", async function () {
    // MSDController and newly added owner
    expect(await USX.getMinters()).to.have.length(2);
    expect(await USX.getMinters()).to.have.members([
      ownerAddr,
      msdController.address,
    ]);
  });
});

describe("Fixed Rate Interest Model", function () {
  let interestRateModel, iMUSX, USXS;
  let owner, accounts, user1;
  let oldBorrowRate, borrowRate, oldSupplyRate, supplyRate;
  let iUSXSigner, USXSSigner;

  before(async function () {
    ({
      iMUSX,
      USXS,
      owner,
      accounts,
      fixedInterestRateModel: interestRateModel,
    } = await loadFixture(fixtureDefault));

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [iMUSX.address],
    });

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USXS.address],
    });

    iUSXSigner = await ethers.provider.getSigner(iMUSX.address);
    USXSSigner = await ethers.provider.getSigner(USXS.address);

    // 0.08 * 10 ** 18 / 2102400
    borrowRate = BigNumber.from(38051750380);

    // 0.06 * 10 ** 18 / 2102400
    supplyRate = BigNumber.from(28538812785);

    [user1] = accounts;

    oldBorrowRate = await interestRateModel.borrowRatesPerBlock(iMUSX.address);
    oldSupplyRate = await interestRateModel.supplyRatesPerBlock(USXS.address);
  });

  after(async function () {
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [iMUSX.address],
    });

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [USXS.address],
    });
  });

  beforeEach(async function () {
    ({
      iMUSX,
      USXS,
      owner,
      accounts,
      fixedInterestRateModel: interestRateModel,
    } = await loadFixture(fixtureDefault));
  });

  it("Should only allow owner to set borrow rate", async function () {
    await verifyOnlyOwner(
      interestRateModel, //contract
      "_setBorrowRate", // method
      [iMUSX.address, borrowRate], //args
      owner, // owner
      user1, // non-owner
      "BorrowRateSet", // ownerEvent
      [iMUSX.address, borrowRate], // ownerEventArgs
      // ownerChecks
      async () => {
        expect(
          await interestRateModel.connect(iUSXSigner).getBorrowRate(0, 0, 0)
        ).to.equal(borrowRate);
      },
      // nonownerChecks
      async () => {
        expect(
          await interestRateModel.connect(iUSXSigner).getBorrowRate(0, 0, 0)
        ).to.equal(oldBorrowRate);
      }
    );
  });

  it("Should only allow owner to set borrow rates", async function () {
    await verifyOnlyOwner(
      interestRateModel, //contract
      "_setBorrowRates", // method
      [[iMUSX.address], [borrowRate]], //args
      owner, // owner
      user1, // non-owner
      "BorrowRateSet", // ownerEvent
      [iMUSX.address, borrowRate], // ownerEventArgs
      // ownerChecks
      async () => {
        expect(
          await interestRateModel.connect(iUSXSigner).getBorrowRate(0, 0, 0)
        ).to.equal(borrowRate);
      },
      // nonownerChecks
      async () => {
        expect(
          await interestRateModel.connect(iUSXSigner).getBorrowRate(0, 0, 0)
        ).to.equal(oldBorrowRate);
      }
    );
  });

  it("Reserve ratio should be fixed to 100%", async function () {
    const reserveRatio = ethers.utils.parseEther("1");
    let newReserveRatio = ethers.utils.parseEther("0.8");

    await verifyOnlyOwner(
      iMUSX, //contract
      "_setNewReserveRatio", // method
      [newReserveRatio], //args
      owner, // owner
      user1, // non-owner
      "NewReserveRatio", // ownerEvent
      [reserveRatio, reserveRatio], // ownerEventArgs
      // ownerChecks
      async () => {
        expect(await iMUSX.reserveRatio()).to.equal(reserveRatio);
      },
      // nonownerChecks
      async () => {}
    );
  });

  it("Should only allow owner set supply rate", async function () {
    await verifyOnlyOwner(
      interestRateModel, //contract
      "_setSupplyRate", // method
      [USXS.address, supplyRate], //args
      owner, // owner
      user1, // non-owner
      "SupplyRateSet", // ownerEvent
      [USXS.address, supplyRate], // ownerEventArgs
      // ownerChecks
      async () => {
        expect(
          await interestRateModel.connect(USXSSigner).getSupplyRate(0, 0, 0, 0)
        ).to.equal(supplyRate);
      },
      // nonownerChecks
      async () => {
        expect(
          await interestRateModel.connect(USXSSigner).getSupplyRate(0, 0, 0, 0)
        ).to.equal(oldSupplyRate);
      }
    );
  });

  it("Should only allow owner set supply rates", async function () {
    await verifyOnlyOwner(
      interestRateModel, //contract
      "_setSupplyRates", // method
      [[USXS.address], [supplyRate]], //args
      owner, // owner
      user1, // non-owner
      "SupplyRateSet", // ownerEvent
      [USXS.address, supplyRate], // ownerEventArgs
      // ownerChecks
      async () => {
        expect(
          await interestRateModel.connect(USXSSigner).getSupplyRate(0, 0, 0, 0)
        ).to.equal(supplyRate);
      },
      // nonownerChecks
      async () => {
        expect(
          await interestRateModel.connect(USXSSigner).getSupplyRate(0, 0, 0, 0)
        ).to.equal(oldSupplyRate);
      }
    );
  });

  it("Should not allow to set rates > ratePerBlockMax", async function () {
    let invalidRate = utils.parseEther("0.001").add(1);

    await expect(
      interestRateModel._setSupplyRate(USXS.address, invalidRate)
    ).to.be.revertedWith("Supply rate invalid");

    await expect(
      interestRateModel._setBorrowRate(USXS.address, invalidRate)
    ).to.be.revertedWith("Borrow rate invalid");
  });
});

describe("MSD Integration", function () {
  let iUSDx,
    iUSDT,
    USX,
    iMUSX,
    USXS,
    controller,
    priceOracle,
    interestRateModel;
  let amount;
  let owner, borrower, payer, accounts;
  let borrowerAddr, payerAddr;
  let msdController;
  let iMUSXFlashMint, iMSDMiniPool, miniMinter;

  async function calculateExchangeRate(blockDelta) {
    let exchangeRate = await USXS.exchangeRateStored();
    let simpleInterestFactor = (
      await interestRateModel.supplyRatesPerBlock(USXS.address)
    ).mul(blockDelta);

    exchangeRate = exchangeRate.add(rmul(exchangeRate, simpleInterestFactor));

    return exchangeRate;
  }

  before(async function () {
    ({
      USX,
      iMUSX,
      USXS,
      owner,
      accounts,
      iUSDx,
      iUSDT,
      controller,
      priceOracle,
      fixedInterestRateModel: interestRateModel,
      msdController,
      iMUSXFlashMint,
      iMSDMiniPool,
      miniMinter,
    } = await loadFixture(fixtureDefault));

    amount = await parseTokenAmount(USX, 1000);
    [borrower, payer] = accounts;

    borrowerAddr = await borrower.getAddress();
    payerAddr = await payer.getAddress();

    // Approve -1
    await USX.connect(borrower).approve(
      iMUSX.address,
      ethers.constants.MaxUint256
    );

    await USX.connect(payer).approve(
      iMUSX.address,
      ethers.constants.MaxUint256
    );

    await controller.connect(borrower).enterMarkets([iUSDx.address]);

    // Supply token0 to borrow USX
    await iUSDx
      .connect(borrower)
      .mint(borrowerAddr, await parseTokenAmount(iUSDx, 10000));
    iMUSX.connect(borrower).borrow(amount);

    await USX.connect(borrower).approve(
      USXS.address,
      ethers.constants.MaxUint256
    );

    // await USXS
    //   .connect(borrower)
    //   .approve(USXS.address, ethers.constants.MaxUint256);
  });

  describe("MSDS", function () {
    it("Should be able to mint", async function () {
      await expect(() =>
        USXS.connect(borrower).mint(borrowerAddr, amount)
      ).to.changeTokenBalances(
        USXS,
        [borrower],
        // The first interest accrual, no block delta yet
        [rdiv(amount, await USXS.exchangeRateStored())]
      );
    });

    it("Should be able to redeem", async function () {
      await expect(() =>
        USXS.connect(borrower).redeem(borrowerAddr, amount)
      ).to.changeTokenBalances(
        USX,
        [borrower],
        [rmul(amount, await calculateExchangeRate(1))]
      );
    });

    it("Should be able to redeemUnderlying", async function () {
      await USXS.connect(borrower).mint(borrowerAddr, amount);
      await expect(() =>
        USXS.connect(borrower).redeemUnderlying(borrowerAddr, amount)
      ).to.changeTokenBalances(USX, [borrower], [amount]);
    });

    it("Check current underlying balance", async function () {
      let beforeBalance = await USXS.balanceOf(borrowerAddr);

      // mine some more blocks.
      await increaseBlock(100);
      await USXS.balanceOfUnderlyingCurrent(borrowerAddr);
      let currentExchangeRate = await USXS.exchangeRateStored();
      let afterUSXSBalance = await USXS.balanceOfUnderlyingStored(borrowerAddr);

      expect(beforeBalance.mul(currentExchangeRate)).to.equal(afterUSXSBalance);
    });

    it("Should supply/redeem when supply rate is 0", async function () {
      let user1 = accounts[0];
      let mintAmount = ethers.utils.parseEther("100");
      let withdrawAmount = ethers.utils.parseEther("50");

      // Records the original supply rate to restore data at the end.
      let originalSupplyRate = await USXS.supplyRatePerUnit();
      // Sets supply rate of MSDS as 0.
      await interestRateModel._setSupplyRate(USXS.address, 0);
      let supplyRate = await USXS.supplyRatePerUnit();
      expect(supplyRate).to.equal(0);

      // When supply rate is 0, records the totalSupply.
      let beforeTotalSupply = await USXS.totalSupply();
      let beforeExchangeRate = await USXS.callStatic.exchangeRateCurrent();

      // Try to mint
      await USXS.connect(user1).mint(user1.address, mintAmount);
      let afterTotalSupply = await USXS.totalSupply();
      // console.log("afterTotalSupply", afterTotalSupply.toString());
      // console.log("changed", (afterTotalSupply.sub(beforeTotalSupply)).toString());
      let afterExchangeRate = await USXS.callStatic.exchangeRateCurrent();

      expect(afterTotalSupply.sub(beforeTotalSupply)).to.equal(
        mintAmount.mul(BASE).div(beforeExchangeRate)
      );
      expect(afterExchangeRate).to.equal(beforeExchangeRate);

      // Try to redeem
      beforeTotalSupply = await USXS.totalSupply();
      beforeExchangeRate = await USXS.callStatic.exchangeRateCurrent();
      await USXS.connect(user1).redeem(user1.address, withdrawAmount);

      afterTotalSupply = await USXS.totalSupply();
      afterExchangeRate = await USXS.callStatic.exchangeRateCurrent();

      expect(beforeTotalSupply.sub(afterTotalSupply)).to.equal(withdrawAmount);
      expect(afterExchangeRate).to.equal(beforeExchangeRate);

      // Restore supply rate
      await interestRateModel._setSupplyRate(USXS.address, originalSupplyRate);
    });

    it("Check current exchange rate", async function () {
      // update exchange rate
      await USXS.exchangeRateCurrent();

      let mintBlocks = 100;
      let expectExchangeRate = await calculateExchangeRate(mintBlocks);

      await increaseBlock(mintBlocks - 1);
      await USXS.exchangeRateCurrent();
      let afterExchangeRate = await USXS.exchangeRateStored();

      expect(afterExchangeRate).to.equal(expectExchangeRate);
    });

    it("Should only allow owner to _setInterestRateModel", async function () {
      let newInterestModel = (await deployFixedInterestRateModel()).address;
      let oldInterestModel = await USXS.interestRateModel();

      await verifyOnlyOwner(
        USXS, //contract
        "_setInterestRateModel", // method
        [newInterestModel], //args
        owner, // owner
        borrower, // non-owner
        "NewInterestRateModel", // ownerEvent
        [oldInterestModel, newInterestModel], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(await USXS.interestRateModel()).to.equal(newInterestModel);
        },
        // nonownerChecks
        async () => {
          expect(await USXS.interestRateModel()).to.equal(oldInterestModel);
        }
      );

      // Restore it back
      await USXS._setInterestRateModel(oldInterestModel);
    });

    it("Should revert when set a non interest model", async function () {
      //
      await expect(USXS._setInterestRateModel(iUSDx.address)).to.be.reverted;
    });

    it("Should be able to get supplyRatePerUnit", async function () {
      let supplyRate = await interestRateModel.supplyRatesPerBlock(
        USXS.address
      );

      expect(await USXS.supplyRatePerUnit()).to.equal(supplyRate);
    });

    it("Should set a new msdController", async function () {
      // Deploy a new msdController
      let msdControllerAddress = USXS.msdController();
      let newMSDController = await deployMSDController();
      await USXS._setMSDController(newMSDController.address);
      let currentMSDController = await USXS.msdController();
      expect(currentMSDController).to.equal(newMSDController.address);

      // Restore old MSDController
      await USXS._setMSDController(msdControllerAddress);
    });

    it("Should not be set new msdController by a user account", async function () {
      let newMSDController = await deployMSDController();
      await expect(
        USXS.connect(accounts[0])._setMSDController(newMSDController.address)
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    it("Should revert when set a non-msdController", async function () {
      await expect(USXS._setMSDController(iUSDx.address)).to.be.reverted;
    });

    it("Check stored underlying balance", async function () {
      let beforeUSXSBalance = await USXS.balanceOfUnderlyingStored(
        borrowerAddr
      );
      // mine some more blocks.
      await increaseBlock(100);
      let afterUSXSBalance = await USXS.balanceOfUnderlyingStored(borrowerAddr);
      expect(beforeUSXSBalance).to.equal(afterUSXSBalance);
    });
  });

  describe("MSD Controller", function () {
    it("Should be able to get minters of a MSD token", async function () {
      // minters of address(0) should be a empty list
      expect(
        await msdController.getMSDMinters(ethers.constants.AddressZero)
      ).to.have.length(0);

      expect(await msdController.getMSDMinters(USX.address)).to.have.members([
        iMUSX.address,
        USXS.address,
        iMSDMiniPool.address,
      ]);
    });

    describe("Reserves", function () {
      it("Should have 0 as surplus", async function () {
        // Now calcEquity() will not call updateInterest() so equity should == 0
        let { 0: equity, 1: debt } = await msdController.callStatic.calcEquity(
          USX.address
        );

        expect(equity).to.equal(0);
      });

      it("Should not withdraw any reserve from MSD Controller", async function () {
        let withdrawAmount = 1;
        let { 0: equity, 1: debt } = await msdController.callStatic.calcEquity(
          USX.address
        );
        expect(withdrawAmount).to.gt(equity);

        await expect(
          msdController._withdrawReserves(USX.address, withdrawAmount)
        ).to.be.revertedWith("Token do not have enough reserve");
      });

      it("iMSD should have reserve and can be withdrawn", async function () {
        await iMUSX.updateInterest();
        let reserve = await iMUSX.totalReserves();
        // console.log(reserve.toString());
        expect(reserve).to.gt(0);

        await expect(iMUSX._withdrawReserves(reserve)).to.changeTokenBalance(
          USX,
          owner,
          reserve
        );
      });

      it("iMSD should hold no cash", async function () {
        expect(await iMUSX.getCash()).to.equal(0);
      });
    });
  });
});

describe("iMSD interest model", function () {
  let USX, iMUSX, USXS, controller, interestRateModel;
  let iUSDx;
  let accounts, user1;

  before(async function () {
    ({
      accounts,
      iMUSX,
      iUSDx,
      fixedInterestRateModel: interestRateModel,
      controller,
      USX,
      USXS,
    } = await loadFixture(fixtureDefault));

    user1 = accounts[0];
    let mintAmount = await parseTokenAmount(iUSDx, 10000);
    let borrowAmount = await parseTokenAmount(iUSDx, 1000);
    // Supply token0 to borrow USX
    await iUSDx.connect(user1).mint(user1.address, mintAmount);
    await controller.connect(user1).enterMarkets([iUSDx.address]);

    await iMUSX.connect(user1).borrow(borrowAmount);
    expect(await USX.balanceOf(user1.address)).to.equal(borrowAmount);

    // 0.05 * 10 ** 18 / 2102400
    let borrowRate = BigNumber.from(23782343987);
    await interestRateModel._setBorrowRate(iMUSX.address, borrowRate);
  });

  async function calcTotalBorrows(blockDelta) {
    let oldTotalBorrows = await iMUSX.totalBorrows();
    let simpleInterestFactor = (
      await interestRateModel.borrowRatesPerBlock(iMUSX.address)
    ).mul(blockDelta);
    let interestAccumulated = simpleInterestFactor
      .mul(oldTotalBorrows)
      .div(BASE);

    let newTotalBorrows = oldTotalBorrows.add(interestAccumulated);

    return newTotalBorrows;
  }

  it("Should set borrow rate to 0", async function () {
    let beforeBorrowRate = await interestRateModel.borrowRatesPerBlock(
      iMUSX.address
    );
    expect(beforeBorrowRate).to.be.gt(0);

    // after `_setBorrowRate`. only pass 1 block
    let expectTotalBorrows = await calcTotalBorrows(1);

    await interestRateModel._setBorrowRate(iMUSX.address, 0);
    let afterBorrowRate = await interestRateModel.borrowRatesPerBlock(
      iMUSX.address
    );
    expect(afterBorrowRate).to.equal(0);

    let afterTotalBorrow = await iMUSX.totalBorrows();
    expect(afterTotalBorrow).to.equal(expectTotalBorrows);
  });

  it("Can borrow/repay even though borrow rate is 0", async function () {
    let borrowAmount = await parseTokenAmount(iUSDx, 10);
    let repayAmount = await parseTokenAmount(iUSDx, 55);
    let beforeTotalBorrows = await iMUSX.totalBorrows();
    // after `_setBorrowRate`. only pass 1 block
    let expectTotalBorrows = await calcTotalBorrows(1);
    let actualTotalBorrows = expectTotalBorrows.add(borrowAmount);

    await expect(() =>
      iMUSX.connect(user1).borrow(borrowAmount)
    ).to.changeTokenBalance(USX, user1, borrowAmount);

    let afterTotalBorrow = await iMUSX.totalBorrows();
    expect(afterTotalBorrow).to.equal(actualTotalBorrows);
    expect(beforeTotalBorrows.add(borrowAmount)).to.equal(afterTotalBorrow);

    // after `borrow`. only pass 1 block
    expectTotalBorrows = await calcTotalBorrows(1);
    actualTotalBorrows = expectTotalBorrows.sub(repayAmount);
    beforeTotalBorrows = await iMUSX.totalBorrows();
    await USX.connect(user1).approve(
      iMUSX.address,
      ethers.constants.MaxUint256
    );
    await expect(() =>
      iMUSX.connect(user1).repayBorrow(repayAmount)
    ).to.changeTokenBalance(USX, user1, repayAmount.mul(-1));
    afterTotalBorrow = await iMUSX.totalBorrows();
    expect(afterTotalBorrow).to.equal(actualTotalBorrows);
    expect(beforeTotalBorrows.sub(repayAmount)).to.equal(afterTotalBorrow);
  });

  it("Should set supply rate to 0", async function () {
    await interestRateModel._setSupplyRate(
      iMUSX.address,
      BigNumber.from(28538812785)
    ); // 6%
    let beforeSupplyRate = await interestRateModel.supplyRatesPerBlock(
      iMUSX.address
    );
    expect(beforeSupplyRate).to.be.gt(0);

    await interestRateModel._setSupplyRate(iMUSX.address, 0);
    let afterSupplyRate = await interestRateModel.supplyRatesPerBlock(
      iMUSX.address
    );
    expect(afterSupplyRate).to.equal(0);
  });
});

describe("Test for MSD Controller", function () {
  let USX, iMUSX, USXS, msdController;
  let iUSDx;
  let accounts;

  before(async function () {
    ({ accounts, iMUSX, iUSDx, msdController, USX, USXS } = await loadFixture(
      fixtureDefault
    ));
  });

  describe("Test for mint msdToken", function () {
    it("Should revert when call mint msdToken by a user account", async function () {
      await expect(
        msdController.mintMSD(USX.address, accounts[1].address, "100")
      ).to.be.revertedWith("onlyMinter: caller is not the token's minter");
    });
  });

  describe("Test for adding MSD token", function () {
    it("Should not add zero address as a MSD token", async function () {
      // Add USX into MSD Controller's token list.
      await expect(
        msdController._addMSD(
          AddressZero,
          [iMUSX.address, USXS.address],
          [0, 0]
        )
      ).to.be.revertedWith("MSD token cannot be a zero address");
    });

    it("Should not add a MSD token with mismatch minters and caps length", async function () {
      await expect(
        msdController._addMSD(USX.address, [iMUSX.address, USXS.address], [0])
      ).to.be.revertedWith("Length of _minters and _mintCaps mismatch");

      await expect(
        msdController._addMSD(USX.address, [iMUSX.address], [0, 0])
      ).to.be.revertedWith("Length of _minters and _mintCaps mismatch");
    });
  });

  describe("Test for adding minter", function () {
    it("Should not add zero address as a minter", async function () {
      // Add USX into MSD Controller's token list.
      await expect(
        msdController._addMinters(
          USX.address,
          [iMUSX.address, USXS.address, AddressZero],
          [0, 0, 0]
        )
      ).to.be.revertedWith("minter cannot be a zero address");
    });

    it("Should not add minters with mismatch cap lengtg", async function () {
      await expect(
        msdController._addMinters(
          USX.address,
          [iMUSX.address, USXS.address],
          [0]
        )
      ).to.be.revertedWith("Length of _minters and _mintCaps mismatch");

      await expect(
        msdController._addMinters(USX.address, [iMUSX.address], [0, 0])
      ).to.be.revertedWith("Length of _minters and _mintCaps mismatch");
    });
  });

  describe("Test for removing minter", function () {
    it("Should remove msdToken minter correctly", async function () {
      // Add USX into MSD Controller's token list firstly.
      await msdController._addMSD(
        USX.address,
        [iMUSX.address, USXS.address],
        [ethers.constants.MaxUint256, ethers.constants.MaxUint256]
      );
      // Remove a minter of the USX.
      await msdController._removeMinters(USX.address, [USXS.address]);
    });

    it("Should revert when removing an unexist minter of msdToken", async function () {
      await expect(msdController._removeMinters(USX.address, [USXS.address]));
    });

    it("Should revert when removes minter by a user account", async function () {
      await expect(
        msdController
          .connect(accounts[1])
          ._removeMinters(USX.address, [iMUSX.address])
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    it("Should revert when remove minter of a non-msdToken", async function () {
      await expect(
        msdController._removeMinters(iUSDx.address, [iMUSX.address])
      ).to.be.revertedWith("token is not a valid MSD token");
    });

    it("Should revert when remove minter is zero address.", async function () {
      await expect(
        msdController._removeMinters(USX.address, [AddressZero])
      ).to.be.revertedWith("minter cannot be a zero address");
    });
  });

  describe("Test for common checks", function () {
    it("This controller is the msdToken controller", async function () {
      expect(await msdController.isMSDController()).to.equal(true);
    });

    it("Get all msdTokens", async function () {
      let allMSDTokens = await msdController.getAllMSDs();
      expect(allMSDTokens.length).to.equal(3);
    });
  });
});

describe("MSD token permit", async function () {
  const wallet = Wallet.generate();
  const owner = wallet.getAddressString();
  const value = 500;
  const maxDeadline = 999999999999;
  let version = "1";
  let iToken, USX, users, user1, user2, user3, spender, name, chainId;

  const buildData = (
    chainId,
    verifyingContract,
    nonce,
    deadline = maxDeadline
  ) => ({
    primaryType: "Permit",
    types: { EIP712Domain, Permit },
    domain: { name, version, chainId, verifyingContract },
    message: { owner, spender, chainId, value, nonce, deadline },
  });

  const init = async () => {
    ({ accounts: users, USX: USX } = await loadFixture(fixtureDefault));

    [user1, user2, user3] = users;
    spender = user1.address;
    name = await USX.name();
    chainId = await getChainId();
  };

  describe("Test all scenarios for permit", function () {
    it("Domain Separator is correct", async function () {
      await init();

      expect(await USX.DOMAIN_SEPARATOR()).to.equal(
        await domainSeparator(name, version, chainId, USX.address)
      );
    });

    it("Should permit correctly", async function () {
      await init();

      let originalNonce = await USX.nonces(owner);

      const data = buildData(
        chainId,
        USX.address,
        Number(originalNonce.toString())
      );
      const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), {
        data,
      });
      const { v, r, s } = fromRpcSig(signature);

      await USX.permit(owner, spender, value, maxDeadline, v, r, s);
      let currentNonce = await USX.nonces(owner);

      expect(currentNonce.sub(originalNonce)).to.equal(1);
      expect(await USX.allowance(owner, spender)).to.equal(value);
    });

    it("Should revert due to expired!", async function () {
      let currentNonce = await USX.nonces(owner);
      const expiredTime = 1;
      const data = buildData(
        chainId,
        USX.address,
        Number(currentNonce.toString()),
        expiredTime
      );
      const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), {
        data,
      });
      const { v, r, s } = fromRpcSig(signature);

      await expect(
        USX.permit(owner, spender, value, expiredTime, v, r, s)
      ).to.be.revertedWith("permit: EXPIRED!");
    });

    it("Should revert due to invalid signature", async function () {
      let currentNonce = await USX.nonces(owner);
      const data = buildData(
        chainId,
        USX.address,
        Number(currentNonce.toString())
      );
      const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), {
        data,
      });
      const { v, r, s } = fromRpcSig(signature);

      await expect(
        USX.permit(owner, USX.address, value, maxDeadline, v, r, s)
      ).to.be.revertedWith("permit: INVALID_SIGNATURE!");
    });
  });
});

describe("MSDS token permit", async function () {
  const wallet = Wallet.generate();
  const owner = wallet.getAddressString();
  const value = 500;
  const maxDeadline = 999999999999;
  let version = "1";
  let USXS, users, user1, user2, user3, spender, name, chainId;

  const buildData = (
    chainId,
    verifyingContract,
    nonce,
    deadline = maxDeadline
  ) => ({
    primaryType: "Permit",
    types: { EIP712Domain, Permit },
    domain: { name, version, chainId, verifyingContract },
    message: { owner, spender, chainId, value, nonce, deadline },
  });

  const init = async () => {
    ({ accounts: users, USXS: USXS } = await loadFixture(fixtureDefault));

    [user1, user2, user3] = users;
    spender = user1.address;
    name = await USXS.name();
    chainId = await getChainId();
  };

  describe("Test all scenarios for permit", function () {
    it("Domain Separator is correct", async function () {
      await init();

      expect(await USXS.DOMAIN_SEPARATOR()).to.equal(
        await domainSeparator(name, version, chainId, USXS.address)
      );
    });

    it("Should permit correctly", async function () {
      await init();

      let originalNonce = await USXS.nonces(owner);

      const data = buildData(
        chainId,
        USXS.address,
        Number(originalNonce.toString())
      );
      const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), {
        data,
      });
      const { v, r, s } = fromRpcSig(signature);

      await USXS.permit(owner, spender, value, maxDeadline, v, r, s);
      let currentNonce = await USXS.nonces(owner);

      expect(currentNonce.sub(originalNonce)).to.equal(1);
      expect(await USXS.allowance(owner, spender)).to.equal(value);
    });

    it("Should revert due to expired!", async function () {
      let currentNonce = await USXS.nonces(owner);
      const expiredTime = 1;
      const data = buildData(
        chainId,
        USXS.address,
        Number(currentNonce.toString()),
        expiredTime
      );
      const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), {
        data,
      });
      const { v, r, s } = fromRpcSig(signature);

      await expect(
        USXS.permit(owner, spender, value, expiredTime, v, r, s)
      ).to.be.revertedWith("permit: EXPIRED!");
    });

    it("Should revert due to invalid signature", async function () {
      let currentNonce = await USXS.nonces(owner);
      const data = buildData(
        chainId,
        USXS.address,
        Number(currentNonce.toString())
      );
      const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), {
        data,
      });
      const { v, r, s } = fromRpcSig(signature);

      await expect(
        USXS.permit(owner, USXS.address, value, maxDeadline, v, r, s)
      ).to.be.revertedWith("permit: INVALID_SIGNATURE!");
    });
  });
});

describe("MSD Controller V2", function () {
  let USX, iMUSX, USXS, msdController;
  let iUSDx;
  let accounts, owner, user1, borrower;
  let borrowerAddr;

  before(async function () {
    ({ owner, accounts, iMUSX, iUSDx, controller, msdController, USX, USXS } =
      await loadFixture(fixtureDefault));

    [user1, borrower] = accounts;

    borrowerAddr = await borrower.getAddress();

    await iUSDx
      .connect(borrower)
      .mint(borrowerAddr, await parseTokenAmount(iUSDx, 1000000000));

    await controller.connect(borrower).enterMarkets([iUSDx.address]);
  });

  describe("Mint Cap", function () {
    it("Should only allow owner to set minters' caps", async function () {
      const cap = await parseTokenAmount(USX, 1000);

      await verifyOnlyOwner(
        msdController, //contract
        "_setMintCaps", // method
        [USX.address, [iMUSX.address], [cap]], //args
        owner, // owner
        user1, // non-owner
        "NewMintCap", // ownerEvent
        [USX.address, iMUSX.address, ethers.constants.MaxUint256, cap], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(
            await msdController.mintCaps(USX.address, iMUSX.address)
          ).to.equal(cap);
        },
        // nonownerChecks
        async () => {
          expect(
            await msdController.mintCaps(USX.address, iMUSX.address)
          ).to.equal(ethers.constants.MaxUint256);
        }
      );
    });

    it("Should revert if the token is not MSD", async function () {
      const cap = await parseTokenAmount(USX, 1000);

      await expect(
        msdController._setMintCaps(iUSDx.address, [iUSDx.address], [cap])
      ).to.revertedWith("token is not a valid MSD token");
    });

    it("Should revert with mismatch minters and cap length", async function () {
      const cap = await parseTokenAmount(USX, 1000);

      await expect(
        msdController._setMintCaps(USX.address, [iMUSX.address], [cap, 0])
      ).to.revertedWith("Length of _minters and _mintCaps mismatch");

      await expect(
        msdController._setMintCaps(
          USX.address,
          [iMUSX.address, USXS.address],
          [cap]
        )
      ).to.revertedWith("Length of _minters and _mintCaps mismatch");
    });

    it("Should revert if the minter is not the MSD's minter", async function () {
      const cap = await parseTokenAmount(USX, 1000);

      await expect(
        msdController._setMintCaps(USX.address, [iUSDx.address], [cap])
      ).to.revertedWith("minter is not the token's minter");
    });

    it("Should be able to mint up to cap", async function () {
      // Initial total supply should be 0
      let totalSupply = await USX.totalSupply();
      expect(totalSupply).to.equal(0);

      const cap = await msdController.mintCaps(USX.address, iMUSX.address);
      await expect(() =>
        iMUSX.connect(borrower).borrow(cap)
      ).to.changeTokenBalance(USX, borrower, cap);

      // The increased interest might also stop more MSD being mint
      await expect(iMUSX.connect(borrower).borrow(1)).to.be.revertedWith(
        "Minter mint capacity reached"
      );
    });

    describe("MSDController Cap and Controller Cap", function () {
      beforeEach(async function () {
        ({
          owner,
          accounts,
          iMUSX,
          iUSDx,
          controller,
          msdController,
          USX,
          USXS,
        } = await loadFixture(fixtureDefault));

        [user1, borrower] = accounts;

        borrowerAddr = await borrower.getAddress();

        await iUSDx
          .connect(borrower)
          .mint(borrowerAddr, await parseTokenAmount(iUSDx, 1000000000));

        await controller.connect(borrower).enterMarkets([iUSDx.address]);
      });

      // Reset to default
      after(async function () {
        ({
          owner,
          accounts,
          iMUSX,
          iUSDx,
          controller,
          msdController,
          USX,
          USXS,
        } = await loadFixture(fixtureDefault));

        [user1, borrower] = accounts;

        borrowerAddr = await borrower.getAddress();

        await iUSDx
          .connect(borrower)
          .mint(borrowerAddr, await parseTokenAmount(iUSDx, 1000000000));

        await controller.connect(borrower).enterMarkets([iUSDx.address]);
      });

      async function setCaps(MSD, iMSD, msdControllerCap, controllerCap) {
        await msdController._setMintCaps(
          MSD.address,
          [iMSD.address],
          [msdControllerCap]
        );
        await controller._setBorrowCapacity(iMSD.address, controllerCap);
      }

      it("MSDController Cap = 0 and Controller Cap = 0", async function () {
        await setCaps(USX, iMUSX, "0", "0");

        // Controller's Cap get checked first
        await expect(iMUSX.connect(borrower).borrow(1)).to.be.revertedWith(
          "Token borrow capacity reached"
        );
      });

      it("50 = MSDController Cap < Controller Cap", async function () {
        const msdCap = await parseTokenAmount(iMUSX, "50");
        const conCap = await parseTokenAmount(iMUSX, "100");
        await setCaps(USX, iMUSX, msdCap, conCap);

        let amount = await parseTokenAmount(iMUSX, "50");
        await iMUSX.connect(borrower).borrow(amount);

        await expect(iMUSX.connect(borrower).borrow(1)).to.be.revertedWith(
          "Minter mint capacity reached"
        );

        // Borrow another 50 to reach the controller cap
        await expect(iMUSX.connect(borrower).borrow(amount)).to.be.revertedWith(
          "Token borrow capacity reached"
        );
      });

      it("MSDController Cap = Controller Cap = -1", async function () {
        const msdCap = ethers.constants.MaxUint256;
        const conCap = ethers.constants.MaxUint256;
        await setCaps(USX, iMUSX, msdCap, conCap);

        let balance = await iUSDx.balanceOf(borrowerAddr);

        // All borrower can borrow
        let amount = balance.mul(9).div(10);
        await iMUSX.connect(borrower).borrow(amount);

        await expect(iMUSX.connect(borrower).borrow(1)).to.be.revertedWith(
          "Account has some shortfall"
        );
      });

      it("MSDController Cap > Controller Cap = 50", async function () {
        const msdCap = await parseTokenAmount(iMUSX, "100");
        const conCap = await parseTokenAmount(iMUSX, "50");
        await setCaps(USX, iMUSX, msdCap, conCap);

        let amount = conCap;
        await iMUSX.connect(borrower).borrow(amount);

        // Controller's Cap get checked first
        await expect(iMUSX.connect(borrower).borrow(1)).to.be.revertedWith(
          "Token borrow capacity reached"
        );
      });

      it("MSDController Cap = Controller Cap = 100", async function () {
        const msdCap = await parseTokenAmount(iMUSX, "100");
        const conCap = await parseTokenAmount(iMUSX, "100");
        await setCaps(USX, iMUSX, msdCap, conCap);

        let amount = conCap;
        await iMUSX.connect(borrower).borrow(amount);

        // Controller's Cap get checked first
        await expect(iMUSX.connect(borrower).borrow(1)).to.be.revertedWith(
          "Token borrow capacity reached"
        );
      });
    });
  });

  describe("Minter Management", function () {
    before(async function () {
      msdController = await deployMSDController();
      await USX._addMinter(msdController.address);

      await iMUSX._setMSDController(msdController.address);
      await USXS._setMSDController(msdController.address);

      await USX.connect(borrower).approve(
        iMUSX.address,
        ethers.constants.MaxUint256
      );
      await USX.connect(borrower).approve(
        USXS.address,
        ethers.constants.MaxUint256
      );
    });

    it("Should have no MSD or minters initially", async function () {
      const MSDs = await msdController.getAllMSDs();
      expect(MSDs.length).to.equal(0);

      await expect(iMUSX.connect(borrower).borrow(1)).to.be.revertedWith(
        "token is not a valid MSD token"
      );
    });

    it("Should be able to add MSD without minters", async function () {
      await msdController._addMSD(USX.address, [], []);
      const MSDs = await msdController.getAllMSDs();
      expect(MSDs.length).to.equal(1);

      await expect(iMUSX.connect(borrower).borrow(1)).to.be.revertedWith(
        "onlyMinter: caller is not the token's minter"
      );
    });

    it("Should be able to add minters, then should be able to mint/burn", async function () {
      const msdCap = await parseTokenAmount(USX, "100");
      await msdController._addMinters(
        USX.address,
        [iMUSX.address, USXS.address],
        [msdCap, msdCap]
      );
      const minters = await msdController.getMSDMinters(USX.address);
      expect(minters.length).to.equal(2);

      // Should be able to mint/burn
      const amount = await parseTokenAmount(USX, "10");
      await iMUSX.connect(borrower).borrow(msdCap);
      await iMUSX.connect(borrower).repayBorrow(amount);

      // Should be able to mint/burn
      await USXS.connect(borrower).mint(borrowerAddr, amount);
      await USXS.connect(borrower).redeem(
        borrowerAddr,
        await USXS.balanceOf(borrowerAddr)
      );
    });

    it("Should be able to remove minter, then should not be able to mint", async function () {
      await msdController._removeMinters(USX.address, [iMUSX.address]);
      const minters = await msdController.getMSDMinters(USX.address);
      expect(minters.length).to.equal(1);

      // Should not be able to mint
      const amount = await parseTokenAmount(USX, "10");
      await expect(iMUSX.connect(borrower).borrow(amount)).to.be.revertedWith(
        "onlyMinter: caller is not the token's minter"
      );

      // Should be able to burn
      await iMUSX.connect(borrower).repayBorrow(amount);

      // The other minter should work
      await USXS.connect(borrower).mint(borrowerAddr, amount);
      await USXS.connect(borrower).redeem(
        borrowerAddr,
        await parseTokenAmount(USX, "1")
      );
    });

    it("Should be able to remove all minters, then should not be able to mint", async function () {
      await msdController._removeMinters(USX.address, [USXS.address]);
      const minters = await msdController.getMSDMinters(USX.address);
      expect(minters.length).to.equal(0);

      // Should not be able to mint
      const amount = await parseTokenAmount(USX, "1");
      await expect(
        USXS.connect(borrower).redeem(borrowerAddr, amount)
      ).to.be.revertedWith("onlyMinter: caller is not the token's minter");

      // Should be able to burn
      await iMUSX.connect(borrower).repayBorrow(amount);
      await USXS.connect(borrower).mint(borrowerAddr, amount);
    });
  });
});
