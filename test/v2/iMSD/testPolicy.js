const chai = require("chai");
const { expect } = chai;
const { utils } = require("ethers");

const { solidity } = require("ethereum-waffle");

chai.use(solidity);

const { fixtureV2, loadFixture } = require("../../helpers/fixtures.js");
const { MAX } = require("../../helpers/utils.js");

let controllerV2,
  fixedInterestRateModel,
  USX,
  USDT,
  iUSDT,
  iMUSX,
  iETH,
  timeLock,
  timeLockStrategy;
let owner, accounts, user1;

describe("iMSDV2", function () {
  beforeEach(async function () {
    ({
      controllerV2,
      owner,
      accounts,
      fixedInterestRateModel,
      timeLock,
      timeLockStrategy,
      USDT,
      USX,
      iMUSX,
      iETH,
      iUSDT,
    } = await loadFixture(fixtureV2));

    user1 = accounts[1];

    // Set iMUSX limit config.
    const minSingleLimit = utils.parseEther("10000");
    const midSingleLimit = utils.parseEther("50000");

    const minDailyLimit = utils.parseEther("100000");
    const midDailyLimit = utils.parseEther("200000");
    await timeLockStrategy._setAssetLimitConfig(iMUSX.address, {
      minSingleLimit: minSingleLimit,
      midSingleLimit: midSingleLimit,
      minDailyLimit: minDailyLimit,
      midDailyLimit: midDailyLimit,
    });

    let eModeLTV = utils.parseEther("0.97"); // 97%
    let eModeLiquidationThreshold = utils.parseEther("0.98"); //98%

    // Add iMUSX to eMode 1: stable coin eMode
    await controllerV2._setEMode(
      iMUSX.address,
      1,
      eModeLTV,
      eModeLiquidationThreshold
    );
  });

  it("Mint USX in the eMode", async function () {
    const iMUSXDefaultBorrowRate =
      await fixedInterestRateModel.borrowRatesPerBlock(iMUSX.address);
    await fixedInterestRateModel._setBorrowRate(iMUSX.address, 0);
    expect(
      await fixedInterestRateModel.borrowRatesPerBlock(iMUSX.address)
    ).to.eq(0);

    const stableCoinEMode = 1;
    const supplyUSDTAmount = utils.parseUnits("1000", 6);
    const borrowUSXAmount = utils.parseEther("100");
    const iMUSXMarketDetails = await controllerV2.marketsV2(iMUSX.address);
    // Ensure iMUSX in the stable coin eMode.
    expect(iMUSXMarketDetails.eModeID).to.eq(stableCoinEMode);

    // Deposit some USDT
    await iUSDT.connect(user1).mint(user1.address, supplyUSDTAmount);
    // Use iUSDT as collateral
    await controllerV2.connect(user1).enterMarkets([iUSDT.address]);

    await iMUSX.connect(user1).borrow(borrowUSXAmount);
    let beforeUser1EquityDetails = await controllerV2.calcAccountEquity(
      user1.address
    );

    // Approve USX to iMUSX to repay
    await USX.connect(user1).approve(iMUSX.address, MAX);
    // Repay USX
    await iMUSX.connect(user1).repayBorrow(borrowUSXAmount);

    // Enter stable coin eMode
    await controllerV2.connect(user1).enterEMode(stableCoinEMode);
    expect(await controllerV2.accountsEMode(user1.address)).to.eq(
      stableCoinEMode
    );
    // Borrow USX under the stable coin eMode
    await iMUSX.connect(user1).borrow(borrowUSXAmount);

    let afterUser1EquityDetails = await controllerV2.calcAccountEquity(
      user1.address
    );

    const defaultCollateralFactor = await controllerV2.getLTV(iMUSX.address);
    const eModeCollateralFactor = await controllerV2.getEModeLTV(iMUSX.address);
    expect(afterUser1EquityDetails[2]).to.gt(beforeUser1EquityDetails[2]);
    expect(
      afterUser1EquityDetails[2]
        .div(eModeCollateralFactor)
        .mul(defaultCollateralFactor)
    ).to.eq(beforeUser1EquityDetails[2]);

    // Revert changes
    await fixedInterestRateModel._setBorrowRate(
      iMUSX.address,
      iMUSXDefaultBorrowRate
    );
  });
});
