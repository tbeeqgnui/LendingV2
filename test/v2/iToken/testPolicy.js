const chai = require("chai");
const { expect } = chai;
const { BigNumber, utils } = require("ethers");

const { solidity } = require("ethereum-waffle");

chai.use(solidity);

const {
  fixtureDefault,
  fixtureV2,
  getCurrentTime,
  getEthBalance,
  increaseBlock,
  increaseTime,
  loadFixture,
  upgradeToV2,
} = require("../../helpers/fixtures.js");

let controller,
  USDx,
  iUSDx,
  iMUSX,
  iETH,
  timeLock,
  timeLockStrategy,
  rewardDistributor;
let owner, accounts, user1, deployer;
let borrowUSDxUser, borrowETHUser, borrowUSXUser;

describe("Borrow/Withdraw delay", function () {
  before(async function () {
    ({
      controller,
      owner,
      accounts,
      iETH,
      iUSDx, // decimals: 18
      // iUSDT, // decimals: 6
      timeLock,
      timeLockStrategy,
      USDx,
      // USDT,
    } = await loadFixture(fixtureV2));

    deployer = accounts[10];
    user1 = accounts[0];
    const mintTokenAmount = utils.parseEther("100000");
    const mintETHAmount = utils.parseEther("1000");
    // Get some free token
    await USDx.mint(deployer.address, mintTokenAmount);
    // Deposit some token, so users can borrow later.
    await iUSDx.connect(deployer).mint(deployer.address, mintTokenAmount);
    await iETH
      .connect(deployer)
      .mint(deployer.address, { value: mintETHAmount });

    // Set iUSDx limit config.
    const minSingleLimit = utils.parseEther("10000");
    const midSingleLimit = utils.parseEther("50000");

    const minDailyLimit = utils.parseEther("100000");
    const midDailyLimit = utils.parseEther("200000");
    await timeLockStrategy._setAssetLimitConfig(iUSDx.address, {
      minSingleLimit: minSingleLimit,
      midSingleLimit: midSingleLimit,
      minDailyLimit: minDailyLimit,
      midDailyLimit: midDailyLimit,
    });

    // Set iETH limit config.
    const iEthMinSingleLimit = utils.parseEther("100");
    const iEthMidSingleLimit = utils.parseEther("500");

    const iEthMinDailyLimit = utils.parseEther("1000");
    const iEthMidDailyLimit = utils.parseEther("2000");
    await timeLockStrategy._setAssetLimitConfig(iETH.address, {
      minSingleLimit: iEthMinSingleLimit,
      midSingleLimit: iEthMidSingleLimit,
      minDailyLimit: iEthMinDailyLimit,
      midDailyLimit: iEthMidDailyLimit,
    });
  });
  it("Borrows ERC20 token but delays", async function () {
    const mintAmount = utils.parseEther("100000");

    const iUSDxLimitConfigs = await timeLockStrategy.assetLimitConfig(
      iUSDx.address
    );
    const borrowAmount = iUSDxLimitConfigs.minSingleLimit.add(1);

    // deposit -> enter market -> borrow
    await iUSDx.connect(user1).mint(user1.address, mintAmount);
    await controller.connect(user1).enterMarkets([iUSDx.address]);

    // Get new locked funds id.
    const lockedFundsId = await timeLock.agreementCount();
    await expect(iUSDx.connect(user1).borrow(borrowAmount))
      .to.emit(timeLock, `AgreementCreated`)
      .withNamedArgs({ agreementId: lockedFundsId });

    const lockedFundsDetails = await timeLock.getAgreement(lockedFundsId);
    expect(lockedFundsDetails.tokenAmounts).to.eq(borrowAmount);

    const currentTime = await getCurrentTime();

    // Has not released.
    expect(currentTime).to.lt(lockedFundsDetails.releaseTime);
    // So can not get locked funds.
    await expect(
      timeLock.connect(user1).claim([lockedFundsId])
    ).to.be.revertedWith("Release time not reached");

    // Increase some time to reach the released time.
    const shouldIncreaseTime = lockedFundsDetails.releaseTime.sub(currentTime);
    await increaseTime(shouldIncreaseTime.toNumber());

    // Claim the locked funds
    await expect(() =>
      timeLock.connect(user1).claim([lockedFundsId])
    ).to.changeTokenBalance(USDx, user1, borrowAmount);
  });

  it("Borrows ETH but delays", async function () {
    const mintAmount = utils.parseEther("1000");

    const iEthLimitConfigs = await timeLockStrategy.assetLimitConfig(
      iETH.address
    );
    const borrowAmount = iEthLimitConfigs.minSingleLimit.add(1);

    // deposit -> enter market -> borrow
    await iETH.connect(user1).mint(user1.address, { value: mintAmount });
    await controller.connect(user1).enterMarkets([iETH.address]);

    // Get new locked funds id.
    const lockedFundsId = await timeLock.agreementCount();
    await expect(iETH.connect(user1).borrow(borrowAmount))
      .to.emit(timeLock, `AgreementCreated`)
      .withNamedArgs({ agreementId: lockedFundsId });

    const lockedFundsDetails = await timeLock.getAgreement(lockedFundsId);
    expect(lockedFundsDetails.tokenAmounts).to.eq(borrowAmount);

    const currentTime = await getCurrentTime();

    // Has not released.
    expect(currentTime).to.lt(lockedFundsDetails.releaseTime);
    // So can not get locked funds.
    await expect(
      timeLock.connect(user1).claim([lockedFundsId])
    ).to.be.revertedWith("Release time not reached");

    // Increase some time to reach the released time.
    const shouldIncreaseTime = lockedFundsDetails.releaseTime.sub(currentTime);
    await increaseTime(shouldIncreaseTime.toNumber());

    // Claim the locked funds
    await expect(() =>
      timeLock.connect(user1).claim([lockedFundsId])
    ).to.changeEtherBalance(user1, borrowAmount);
  });
});

describe("Upgrade iToken contract to use timestamp", function () {
  async function depositETHAndBorrowAsset(executor, borrowAsset, borrowAmount) {
    const mintETHAmount = utils.parseEther("10000");
    // Deposit ETH
    await iETH
      .connect(executor)
      .mint(executor.address, { value: mintETHAmount });
    // Use ETH as collateral
    await controller.connect(executor).enterMarkets([iETH.address]);
    // Borrow asset
    await borrowAsset.connect(executor).borrow(borrowAmount);

    await borrowAsset.updateInterest();
    const beforeExchangeRate = await borrowAsset.exchangeRateStored();

    // Mine some new blocks and increase time.
    await increaseBlock(500);
    await increaseTime(500);

    await borrowAsset.updateInterest();
    const afterExchangeRate = await borrowAsset.exchangeRateStored();

    if (await borrowAsset.isiToken()) {
      expect(afterExchangeRate).to.gt(beforeExchangeRate);
    }
  }

  async function executeBorrow(data) {
    const base = BigNumber.from("10000");
    const executor = data.executor;
    const iToken = data.iToken;
    const underlying = data.underlying;
    const accrualTime = data.accrualTime;
    const expectUR = BigNumber.from(data.expectUR.toString());
    const expectAPY = BigNumber.from(data.expectAPY.toString());

    await iToken.updateInterest();

    const beforeTotalBorrows = await iToken.totalBorrows();
    const beforeTotalReserve = await iToken.totalReserves();
    const beforeCash = await iToken.getCash();

    let toExecuteAmount = expectUR
      .mul(beforeTotalBorrows.add(beforeCash).sub(beforeTotalReserve))
      .div(base)
      .sub(beforeTotalBorrows);

    let borrowMore = false;

    if (toExecuteAmount.gt(0)) {
      await iToken.connect(executor).borrow(toExecuteAmount);
      borrowMore = true;
    } else {
      // Only for iToken at now.
      toExecuteAmount = toExecuteAmount.mul(-1);
      await underlying
        .connect(executor)
        .approve(iToken.address, toExecuteAmount);
      await iToken.connect(executor).repayBorrow(toExecuteAmount);
    }

    const beforeExchangeRate = await iToken.exchangeRateStored();
    const beforeBorrowRate = await iToken.borrowRatePerUnit();
    const beforeBorrowIndex = await iToken.borrowIndex();
    const beforeUserBorrowAmount = await iToken.borrowBalanceStored(
      executor.address
    );

    await increaseTime(accrualTime);
    await iToken.updateInterest();
    const afterExchangeRate = await iToken.exchangeRateStored();
    const afterBorrowRate = await iToken.borrowRatePerUnit();
    const afterBorrowIndex = await iToken.borrowIndex();
    const afterUserBorrowDetails = await iToken.borrowSnapshot(
      executor.address
    );
    const afterUserBorrowAmount = await iToken.borrowBalanceStored(
      executor.address
    );

    const afterTotalBorrows = await iToken.totalBorrows();
    const afterTotalReserve = await iToken.totalReserves();

    expect(afterExchangeRate).to.gt(beforeExchangeRate);
    expect(afterBorrowRate).to.gt(beforeBorrowRate);
    expect(afterBorrowIndex).to.gte(beforeBorrowIndex);
    expect(afterUserBorrowAmount).to.gt(beforeUserBorrowAmount);
    expect(
      afterUserBorrowDetails[0]
        .mul(afterBorrowIndex)
        .div(afterUserBorrowDetails[1])
    ).to.be.closeTo(afterUserBorrowAmount, 100);

    expect(
      afterUserBorrowAmount.mul(base).div(beforeUserBorrowAmount).sub(base)
    ).to.be.closeTo(expectAPY, 1);
  }

  it("Make environment for V1", async function () {
    ({
      controller,
      owner,
      accounts,
      iETH,
      iUSDx, // decimals: 18
      iMUSX,
      rewardDistributor,
      USDx,
    } = await loadFixture(fixtureDefault));

    const depositor = accounts[18];
    const mintTokenAmount = utils.parseEther("100000");
    const mintETHAmount = utils.parseEther("10000");
    await iUSDx.connect(depositor).mint(depositor.address, mintTokenAmount);
    await iETH
      .connect(depositor)
      .mint(depositor.address, { value: mintETHAmount });

    borrowUSDxUser = accounts[10];
    borrowETHUser = accounts[11];
    borrowUSXUser = accounts[12];
    const borrowTokenAmount = mintTokenAmount.div(2);
    const borrowETHAmount = mintETHAmount.div(2);

    // Borrow USDx
    await depositETHAndBorrowAsset(borrowUSDxUser, iUSDx, borrowTokenAmount);
    // Borrow ETH
    await depositETHAndBorrowAsset(borrowETHUser, iETH, borrowETHAmount);
    // Borrow USX
    await depositETHAndBorrowAsset(borrowUSXUser, iMUSX, borrowETHAmount);
  });

  it("Update to V2", async function () {
    controller = await upgradeToV2({
      controller: controller,
      iETH: iETH,
      owner: owner,
      rewardDistributor: rewardDistributor,
    });

    iUSDx = new ethers.Contract(
      iUSDx.address,
      require("../../../artifacts/contracts/iTokenV2.sol/iTokenV2.json").abi,
      owner
    );

    await executeBorrow({
      executor: borrowUSDxUser,
      iToken: iUSDx,
      underlying: USDx,
      expectUR: 5000, // 50%
      accrualTime: 3600 * 24 * 365,
      expectAPY: 278, //2.78%
    });
  });
});
