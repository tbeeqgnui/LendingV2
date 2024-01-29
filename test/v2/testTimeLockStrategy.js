const chai = require("chai");
const { expect } = chai;
const { BigNumber, utils } = require("ethers");
const { ethers } = require("hardhat");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const {
  fixtureV2,
  getCurrentTime,
  increaseTime,
  loadFixture,
} = require("../helpers/fixtures.js");

const { MAX } = require("../helpers/utils.js");

describe("Time Lock Strategy", function () {
  let controllerV2, USDx, iUSDx, USDT, iUSDT, iETH, timeLock, timeLockStrategy;
  let owner, accounts, user1, deployer, whitelistUser;
  let minSingleLimit, midSingleLimit, minDailyLimit, midDailyLimit;

  async function getCurrentDailyAmount(asset) {
    const DAY = 86400; // in seconds
    const currentTime = Math.floor(Date.now() / 1000);
    const assetData = await timeLockStrategy.assetData(asset);

    if (currentTime - Number(assetData.dailyStartTime) < DAY) {
      return assetData.currentDailyAmount;
    } else {
      return utils.parseEther("0");
    }
  }

  async function executeWithDelaying(callData) {
    expect(callData.amount).to.gt(callData.lowerSingleLimit);
    expect(callData.amount).to.lt(callData.upperSingleLimit);
    expect(
      callData.amount.add(await getCurrentDailyAmount(callData.asset.address))
    ).to.gt(callData.lowerDailyLimit);
    expect(
      callData.amount.add(await getCurrentDailyAmount(callData.asset.address))
    ).to.lt(callData.upperDailyLimit);

    const beforeLockedFundsId = await timeLock.agreementCount();

    if (Number(callData.expectDelayedBlocks.toString()) == 0) {
      // No delays
      await expect(() =>
        callData.asset.connect(callData.caller)[callData.func](...callData.args)
      ).to.changeTokenBalance(
        callData.underlying,
        callData.caller,
        callData.amount
      );

      const afterLockedFundsId = await timeLock.agreementCount();
      expect(afterLockedFundsId).to.eq(beforeLockedFundsId);
    } else {
      // Will delay
      await expect(
        callData.asset.connect(callData.caller)[callData.func](...callData.args)
      )
        .to.emit(timeLock, `AgreementCreated`)
        .withNamedArgs({ agreementId: beforeLockedFundsId });

      const afterLockedFundsId = await timeLock.agreementCount();
      expect(afterLockedFundsId).to.eq(beforeLockedFundsId.add(1));
      const lockedFundsDetails = await timeLock.getAgreement(
        beforeLockedFundsId
      );
      expect(lockedFundsDetails.tokenAmounts).to.eq(callData.amount);

      const currentTime = await getCurrentTime();
      // Has not released.
      expect(currentTime).to.lt(lockedFundsDetails.releaseTime);
      // So can not get locked funds.
      await expect(
        timeLock.connect(callData.caller).claim([beforeLockedFundsId])
      ).to.be.revertedWith("Release time not reached");

      // Mine some blocks to reach the released time.
      const shouldMineSeconds = lockedFundsDetails.releaseTime.sub(currentTime);
      await increaseTime(shouldMineSeconds.toNumber());

      // Claim the locked funds
      await expect(() =>
        timeLock.connect(callData.caller).claim([beforeLockedFundsId])
      ).to.changeTokenBalance(
        callData.underlying,
        callData.caller,
        callData.amount
      );
    }
  }

  beforeEach(async function () {
    ({
      controllerV2,
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
    whitelistUser = accounts[5];
    const mintTokenAmount = utils.parseEther("1000000");
    const mintETHAmount = utils.parseEther("1000");
    // Get some free token
    await USDx.mint(deployer.address, mintTokenAmount);
    // Deposit some token, so users can borrow later.
    await iUSDx.connect(deployer).mint(deployer.address, mintTokenAmount);
    await iETH
      .connect(deployer)
      .mint(deployer.address, { value: mintETHAmount });

    // Use1 deposits token and use it as collateral
    await iUSDx.connect(user1).mint(user1.address, mintTokenAmount);
    await controllerV2.connect(user1).enterMarkets([iUSDx.address]);
    // Whitelist user deposits token and use it as collateral
    await iUSDx
      .connect(whitelistUser)
      .mint(whitelistUser.address, mintTokenAmount);
    await controllerV2.connect(whitelistUser).enterMarkets([iUSDx.address]);

    // Set iUSDx limit config.
    minSingleLimit = utils.parseEther("10000");
    midSingleLimit = utils.parseEther("50000");

    minDailyLimit = utils.parseEther("100000");
    midDailyLimit = utils.parseEther("200000");
    await timeLockStrategy._setAssetLimitConfig(iUSDx.address, {
      minSingleLimit: minSingleLimit,
      midSingleLimit: midSingleLimit,
      minDailyLimit: minDailyLimit,
      midDailyLimit: midDailyLimit,
    });

    // Set extra config for the whitelist user
    await timeLockStrategy._setWhitelistExtraConfig(
      iUSDx.address,
      whitelistUser.address,
      {
        minSingleLimit: minSingleLimit,
        midSingleLimit: midSingleLimit,
        minDailyLimit: minDailyLimit,
        midDailyLimit: midDailyLimit,
      }
    );
  });

  describe("initialize", function () {
    // Should revert when try to initialize twice
    it("0. TLSTRT-INTL-0", async function () {
      await expect(
        timeLockStrategy.initialize(
          controllerV2.address,
          1, // _minSingleWaitSeconds
          1, // _midSingleWaitSeconds
          1, // _maxSingleWaitSeconds
          1, // _minDailyWaitSeconds
          1, // _midDailyWaitSeconds
          1 // _maxDailyWaitSeconds
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("Admin functions", function () {
    // iETH limit config.
    const iEthMinSingleLimit = utils.parseEther("100");
    const iEthMidSingleLimit = utils.parseEther("500");

    const iEthMinDailyLimit = utils.parseEther("1000");
    const iEthMidDailyLimit = utils.parseEther("2000");
    // Should set asset limit config by owner account
    it("1. TLSTRT-SALC-0", async function () {
      await timeLockStrategy._setAssetLimitConfig(iETH.address, {
        minSingleLimit: iEthMinSingleLimit,
        midSingleLimit: iEthMidSingleLimit,
        minDailyLimit: iEthMinDailyLimit,
        midDailyLimit: iEthMidDailyLimit,
      });

      const iEthLimitConfigs = await timeLockStrategy.assetLimitConfig(
        iETH.address
      );
      expect(iEthLimitConfigs.minSingleLimit).to.eq(iEthMinSingleLimit);
      expect(iEthLimitConfigs.midSingleLimit).to.eq(iEthMidSingleLimit);
      expect(iEthLimitConfigs.minDailyLimit).to.eq(iEthMinDailyLimit);
      expect(iEthLimitConfigs.midDailyLimit).to.eq(iEthMidDailyLimit);

      const iEthData = await timeLockStrategy.assetData(iETH.address);
      expect(iEthData.currentDailyAmount).to.be.eq(0);
      expect(iEthData.dailyStartTime).to.be.eq(await getCurrentTime());
    });

    // Should revert when set asset limit by ordinary user
    it("2. TLSTRT-SALC-1", async function () {
      await expect(
        timeLockStrategy.connect(user1)._setAssetLimitConfig(iETH.address, {
          minSingleLimit: iEthMinSingleLimit,
          midSingleLimit: iEthMidSingleLimit,
          minDailyLimit: iEthMinDailyLimit,
          midDailyLimit: iEthMidDailyLimit,
        })
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    // Should revert when set limit config for an invalid asset
    it("3. TLSTRT-SALC-2", async function () {
      await expect(
        timeLockStrategy._setAssetLimitConfig(user1.address, {
          minSingleLimit: iEthMinSingleLimit,
          midSingleLimit: iEthMidSingleLimit,
          minDailyLimit: iEthMinDailyLimit,
          midDailyLimit: iEthMidDailyLimit,
        })
      ).to.be.revertedWith("Invalid asset!");
    });

    // Should set asset limit config for whitelist user by owner account
    it("4. TLSTRT-SWLEC-0", async function () {
      await timeLockStrategy._setWhitelistExtraConfig(
        iETH.address,
        whitelistUser.address,
        {
          minSingleLimit: iEthMinSingleLimit,
          midSingleLimit: iEthMidSingleLimit,
          minDailyLimit: iEthMinDailyLimit,
          midDailyLimit: iEthMidDailyLimit,
        }
      );

      const iEthWhitelistLimitConfigs = await timeLockStrategy.whitelistExtra(
        iETH.address,
        whitelistUser.address
      );
      expect(iEthWhitelistLimitConfigs.minSingleLimit).to.eq(
        iEthMinSingleLimit
      );
      expect(iEthWhitelistLimitConfigs.midSingleLimit).to.eq(
        iEthMidSingleLimit
      );
      expect(iEthWhitelistLimitConfigs.minDailyLimit).to.eq(iEthMinDailyLimit);
      expect(iEthWhitelistLimitConfigs.midDailyLimit).to.eq(iEthMidDailyLimit);
    });

    // Should revert when set asset limit for whitelist user by ordinary user
    it("5. TLSTRT-SWLEC-1", async function () {
      await expect(
        timeLockStrategy
          .connect(user1)
          ._setWhitelistExtraConfig(iETH.address, whitelistUser.address, {
            minSingleLimit: iEthMinSingleLimit,
            midSingleLimit: iEthMidSingleLimit,
            minDailyLimit: iEthMinDailyLimit,
            midDailyLimit: iEthMidDailyLimit,
          })
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });

    // Should revert when set limit config for whitelist user with an invalid asset
    it("6. TLSTRT-SWLEC-2 ", async function () {
      await expect(
        timeLockStrategy._setWhitelistExtraConfig(
          user1.address,
          whitelistUser.address,
          {
            minSingleLimit: iEthMinSingleLimit,
            midSingleLimit: iEthMidSingleLimit,
            minDailyLimit: iEthMinDailyLimit,
            midDailyLimit: iEthMidDailyLimit,
          }
        )
      ).to.be.revertedWith("Invalid asset!");
    });
  });

  describe("General User", function () {
    // Should delay by min single and min daily waiting blocks
    it("1. TLSTRT-CCLTLP-0", async function () {
      const borrowAmount = utils.parseEther("1");
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          user1.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.minSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.minDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      await executeWithDelaying({
        caller: user1,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: 0,
        upperSingleLimit: minSingleLimit,
        lowerDailyLimit: 0,
        upperDailyLimit: minDailyLimit,
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by min single and mid daily waiting blocks
    it("2. TLSTRT-CCLTLP-1", async function () {
      // Precondition
      await iUSDx.connect(user1).borrow(minDailyLimit);
      const currentDailyAmount = await getCurrentDailyAmount(iUSDx.address);
      expect(currentDailyAmount).to.be.eq(minDailyLimit);

      const borrowAmount = BigNumber.from("1"); // 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          user1.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.minSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.midDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      await executeWithDelaying({
        caller: user1,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: 0,
        upperSingleLimit: minSingleLimit,
        lowerDailyLimit: minDailyLimit,
        upperDailyLimit: midDailyLimit,
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by min single and max daily waiting blocks
    it("3. TLSTRT-CCLTLP-2", async function () {
      // Precondition
      await iUSDx.connect(user1).borrow(midDailyLimit);
      const currentDailyAmount = await getCurrentDailyAmount(iUSDx.address);
      expect(currentDailyAmount).to.be.eq(midDailyLimit);

      const borrowAmount = BigNumber.from("1"); // exceed to 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          user1.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.minSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.maxDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      await executeWithDelaying({
        caller: user1,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: 0,
        upperSingleLimit: minSingleLimit,
        lowerDailyLimit: midDailyLimit,
        upperDailyLimit: MAX,
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by mid single and min daily waiting blocks
    it("4. TLSTRT-CCLTLP-3", async function () {
      const borrowAmount = minSingleLimit.add(BigNumber.from("1")); // exceed to 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          user1.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.midSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.minDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      await executeWithDelaying({
        caller: user1,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: minSingleLimit,
        upperSingleLimit: midSingleLimit,
        lowerDailyLimit: 0,
        upperDailyLimit: minDailyLimit,
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by mid single and mid daily waiting blocks
    it("5. TLSTRT-CCLTLP-4", async function () {
      // Precondition
      await iUSDx.connect(user1).borrow(minDailyLimit);
      const currentDailyAmount = await getCurrentDailyAmount(iUSDx.address);
      expect(currentDailyAmount).to.be.eq(minDailyLimit);

      const borrowAmount = minSingleLimit.add(BigNumber.from("1")); // exceed to 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          user1.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.midSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.midDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      await executeWithDelaying({
        caller: user1,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: minSingleLimit,
        upperSingleLimit: midSingleLimit,
        lowerDailyLimit: minDailyLimit,
        upperDailyLimit: midDailyLimit,
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by mid single and max daily waiting blocks
    it("6. TLSTRT-CCLTLP-5", async function () {
      // Precondition
      await iUSDx.connect(user1).borrow(midDailyLimit);
      const currentDailyAmount = await getCurrentDailyAmount(iUSDx.address);
      expect(currentDailyAmount).to.be.eq(midDailyLimit);

      const borrowAmount = minSingleLimit.add(BigNumber.from("1")); // exceed to 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          user1.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.midSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.maxDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      await executeWithDelaying({
        caller: user1,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: minSingleLimit,
        upperSingleLimit: midSingleLimit,
        lowerDailyLimit: midDailyLimit,
        upperDailyLimit: MAX,
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by max single and min daily waiting blocks
    it("7. TLSTRT-CCLTLP-6", async function () {
      const borrowAmount = midSingleLimit.add(BigNumber.from("1")); // exceed to 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          user1.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.maxSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.minDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      await executeWithDelaying({
        caller: user1,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: midSingleLimit,
        upperSingleLimit: MAX,
        lowerDailyLimit: 0,
        upperDailyLimit: minDailyLimit,
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by max single and mid daily waiting blocks
    it("8. TLSTRT-CCLTLP-7", async function () {
      // Precondition
      await iUSDx.connect(user1).borrow(minDailyLimit);
      const currentDailyAmount = await getCurrentDailyAmount(iUSDx.address);
      expect(currentDailyAmount).to.be.eq(minDailyLimit);

      const borrowAmount = midSingleLimit.add(BigNumber.from("1")); // exceed to 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          user1.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.maxSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.midDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      await executeWithDelaying({
        caller: user1,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: midSingleLimit,
        upperSingleLimit: MAX,
        lowerDailyLimit: minDailyLimit,
        upperDailyLimit: midDailyLimit,
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by max single and max daily waiting blocks
    it("9. TLSTRT-CCLTLP-8", async function () {
      // Precondition
      await iUSDx.connect(user1).borrow(midDailyLimit);
      const currentDailyAmount = await getCurrentDailyAmount(iUSDx.address);
      expect(currentDailyAmount).to.be.eq(midDailyLimit);

      const borrowAmount = midSingleLimit.add(BigNumber.from("1")); // exceed to 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          user1.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.maxSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.maxDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      await executeWithDelaying({
        caller: user1,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: midSingleLimit,
        upperSingleLimit: MAX,
        lowerDailyLimit: midDailyLimit,
        upperDailyLimit: MAX,
        expectDelayedBlocks: delaySeconds,
      });
    });
  });

  describe("Whitelist User", function () {
    // Should delay by min single and min daily waiting blocks
    it("1. TLSTRT-CCLTLP-9", async function () {
      // Precondition
      await iUSDx.connect(whitelistUser).borrow(minDailyLimit);
      const currentDailyAmount = await getCurrentDailyAmount(iUSDx.address);
      expect(currentDailyAmount).to.be.eq(minDailyLimit);

      const borrowAmount = minSingleLimit.add(BigNumber.from("1")); // exceed to 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          whitelistUser.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.minSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.minDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      const whitelistUserMinSingleLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).minSingleLimit;
      const whitelistUserMinDailyLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).minDailyLimit;

      await executeWithDelaying({
        caller: whitelistUser,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: 0,
        upperSingleLimit: minSingleLimit.add(whitelistUserMinSingleLimit),
        lowerDailyLimit: 0,
        upperDailyLimit: minDailyLimit.add(whitelistUserMinDailyLimit),
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by min single and mid daily waiting blocks
    it("2. TLSTRT-CCLTLP-10", async function () {
      // Precondition
      const whitelistUserMinDailyLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).minDailyLimit;
      const totalBorrowedAmount = minDailyLimit.add(whitelistUserMinDailyLimit);
      await iUSDx.connect(whitelistUser).borrow(totalBorrowedAmount);
      const currentDailyAmount = await getCurrentDailyAmount(iUSDx.address);
      expect(currentDailyAmount).to.be.eq(totalBorrowedAmount);

      const borrowAmount = minSingleLimit.add(BigNumber.from("1")); // exceed to 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          whitelistUser.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.minSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.midDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      const whitelistUserMinSingleLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).minSingleLimit;
      const whitelistUserMidDailyLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).midDailyLimit;

      await executeWithDelaying({
        caller: whitelistUser,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: 0,
        upperSingleLimit: minSingleLimit.add(whitelistUserMinSingleLimit),
        lowerDailyLimit: minDailyLimit.add(whitelistUserMinDailyLimit),
        upperDailyLimit: midDailyLimit.add(whitelistUserMidDailyLimit),
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by min single and max daily waiting blocks
    it("3. TLSTRT-CCLTLP-11", async function () {
      // Precondition
      const whitelistUserMidDailyLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).midDailyLimit;
      const totalBorrowedAmount = midDailyLimit.add(whitelistUserMidDailyLimit);
      await iUSDx.connect(whitelistUser).borrow(totalBorrowedAmount);
      const currentDailyAmount = await getCurrentDailyAmount(iUSDx.address);
      expect(currentDailyAmount).to.be.eq(totalBorrowedAmount);

      const borrowAmount = minSingleLimit.add(BigNumber.from("1")); // exceed to 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          whitelistUser.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.minSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.maxDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      const whitelistUserMinSingleLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).minSingleLimit;

      await executeWithDelaying({
        caller: whitelistUser,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: 0,
        upperSingleLimit: minSingleLimit.add(whitelistUserMinSingleLimit),
        lowerDailyLimit: midDailyLimit.add(whitelistUserMidDailyLimit),
        upperDailyLimit: MAX,
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by mid single and min daily waiting blocks
    it("4. TLSTRT-CCLTLP-12", async function () {
      const whitelistUserMinSingleLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).minSingleLimit;
      const borrowAmount = minSingleLimit
        .add(whitelistUserMinSingleLimit)
        .add(1); // exceed to 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          whitelistUser.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.midSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.minDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      const whitelistUserMidSingleLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).midSingleLimit;
      const whitelistUserMinDailyLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).minDailyLimit;

      await executeWithDelaying({
        caller: whitelistUser,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: minSingleLimit.add(whitelistUserMinSingleLimit),
        upperSingleLimit: midSingleLimit.add(whitelistUserMidSingleLimit),
        lowerDailyLimit: 0,
        upperDailyLimit: minDailyLimit.add(whitelistUserMinDailyLimit),
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by mid single and mid daily waiting blocks
    it("5. TLSTRT-CCLTLP-13", async function () {
      // Precondition
      const whitelistUserMinDailyLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).minDailyLimit;
      const totalBorrowedAmount = minDailyLimit.add(whitelistUserMinDailyLimit);
      await iUSDx.connect(whitelistUser).borrow(totalBorrowedAmount);
      const currentDailyAmount = await getCurrentDailyAmount(iUSDx.address);
      expect(currentDailyAmount).to.be.eq(totalBorrowedAmount);

      const whitelistUserMinSingleLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).minSingleLimit;
      const borrowAmount = minSingleLimit
        .add(whitelistUserMinSingleLimit)
        .add(BigNumber.from("1")); // exceed to 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          whitelistUser.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.midSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.midDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      const whitelistUserMidSingleLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).midSingleLimit;
      const whitelistUserMidDailyLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).minDailyLimit;
      await executeWithDelaying({
        caller: whitelistUser,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: minSingleLimit.add(whitelistUserMinSingleLimit),
        upperSingleLimit: midSingleLimit.add(whitelistUserMidSingleLimit),
        lowerDailyLimit: minDailyLimit.add(whitelistUserMinDailyLimit),
        upperDailyLimit: midDailyLimit.add(whitelistUserMidDailyLimit),
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by mid single and max daily waiting blocks
    it("6. TLSTRT-CCLTLP-14", async function () {
      // Precondition
      const whitelistUserMidDailyLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).midDailyLimit;
      const totalBorrowedAmount = midDailyLimit.add(whitelistUserMidDailyLimit);
      await iUSDx.connect(whitelistUser).borrow(totalBorrowedAmount);
      const currentDailyAmount = await getCurrentDailyAmount(iUSDx.address);
      expect(currentDailyAmount).to.be.eq(totalBorrowedAmount);

      const whitelistUserMinSingleLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).minSingleLimit;
      const borrowAmount = minSingleLimit
        .add(whitelistUserMinSingleLimit)
        .add(BigNumber.from("1")); // exceed to 1 wei
      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          whitelistUser.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.midSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.maxDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      const whitelistUserMidSingleLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).midSingleLimit;
      await executeWithDelaying({
        caller: whitelistUser,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: minSingleLimit.add(whitelistUserMinSingleLimit),
        upperSingleLimit: midSingleLimit.add(whitelistUserMidSingleLimit),
        lowerDailyLimit: midDailyLimit.add(whitelistUserMidDailyLimit),
        upperDailyLimit: MAX,
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by max single and min daily waiting blocks
    it("7. TLSTRT-CCLTLP-15", async function () {
      const whitelistUserMidSingleLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).midSingleLimit;
      const borrowAmount = midSingleLimit
        .add(whitelistUserMidSingleLimit)
        .add(1); // exceed to 1 wei

      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          whitelistUser.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.maxSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.minDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      const whitelistUserMinDailyLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).minDailyLimit;
      await executeWithDelaying({
        caller: whitelistUser,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: midSingleLimit.add(whitelistUserMidSingleLimit),
        upperSingleLimit: MAX,
        lowerDailyLimit: 0,
        upperDailyLimit: minDailyLimit.add(whitelistUserMinDailyLimit),
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by max single and mid daily waiting blocks
    it("8. TLSTRT-CCLTLP-16", async function () {
      // Precondition
      const whitelistUserMinDailyLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).minDailyLimit;
      const totalBorrowedAmount = minDailyLimit.add(whitelistUserMinDailyLimit);
      await iUSDx.connect(whitelistUser).borrow(totalBorrowedAmount);
      const currentDailyAmount = await getCurrentDailyAmount(iUSDx.address);
      expect(currentDailyAmount).to.be.eq(totalBorrowedAmount);

      const whitelistUserMidSingleLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).midSingleLimit;
      const borrowAmount = midSingleLimit
        .add(whitelistUserMidSingleLimit)
        .add(1); // exceed to 1 wei

      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          whitelistUser.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.maxSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.midDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      const whitelistUserMidDailyLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).midDailyLimit;
      await executeWithDelaying({
        caller: whitelistUser,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: midSingleLimit.add(whitelistUserMidSingleLimit),
        upperSingleLimit: MAX,
        lowerDailyLimit: minDailyLimit.add(whitelistUserMinDailyLimit),
        upperDailyLimit: midDailyLimit.add(whitelistUserMidDailyLimit),
        expectDelayedBlocks: delaySeconds,
      });
    });

    // Should delay by max single and max daily waiting blocks
    it("9. TLSTRT-CCLTLP-17", async function () {
      // Precondition
      const whitelistUserMidDailyLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).midDailyLimit;
      const totalBorrowedAmount = midDailyLimit.add(whitelistUserMidDailyLimit);
      await iUSDx.connect(whitelistUser).borrow(totalBorrowedAmount);
      const currentDailyAmount = await getCurrentDailyAmount(iUSDx.address);
      expect(currentDailyAmount).to.be.eq(totalBorrowedAmount);

      const whitelistUserMidSingleLimit = (
        await timeLockStrategy.whitelistExtra(
          iUSDx.address,
          whitelistUser.address
        )
      ).midSingleLimit;
      const borrowAmount = midSingleLimit
        .add(whitelistUserMidSingleLimit)
        .add(1); // exceed to 1 wei

      const delaySeconds = (
        await timeLockStrategy.getDelayDetails(
          iUSDx.address,
          borrowAmount,
          whitelistUser.address
        )
      )._delaySeconds;
      // console.log("delaySeconds", delaySeconds.toString());
      const singleWaitSeconds = await timeLockStrategy.maxSingleWaitSeconds();
      const dailyWaitSeconds = await timeLockStrategy.maxDailyWaitSeconds();
      expect(delaySeconds).to.be.eq(singleWaitSeconds.add(dailyWaitSeconds));

      await executeWithDelaying({
        caller: whitelistUser,
        asset: iUSDx,
        underlying: USDx,
        func: "borrow",
        amount: borrowAmount,
        args: [borrowAmount],
        lowerSingleLimit: midSingleLimit.add(whitelistUserMidSingleLimit),
        upperSingleLimit: MAX,
        lowerDailyLimit: midDailyLimit.add(whitelistUserMidDailyLimit),
        upperDailyLimit: MAX,
        expectDelayedBlocks: delaySeconds,
      });
    });
  });
});
