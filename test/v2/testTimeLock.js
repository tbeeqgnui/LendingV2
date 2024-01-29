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

describe("Time Lock", function () {
  let controllerV2, USDx, iUSDx, USDT, iUSDT, iETH, timeLock, timeLockStrategy;
  let owner, accounts, user1, depositor, whitelistUser;
  let minSingleLimit,
    midSingleLimit,
    minDailyLimit,
    midDailyLimit,
    borrowAmount;

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

    depositor = accounts[10];
    user1 = accounts[0];
    whitelistUser = accounts[5];
    const mintTokenAmount = utils.parseEther("1000000");
    const mintETHAmount = utils.parseEther("1000");
    // Get some free token
    await USDx.mint(depositor.address, mintTokenAmount);
    // Deposit some token, so users can borrow later.
    await iUSDx.connect(depositor).mint(depositor.address, mintTokenAmount);
    await iETH
      .connect(depositor)
      .mint(depositor.address, { value: mintETHAmount });

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

    // Generate a delaying transaction
    const iUSDxLimitConfig = await timeLockStrategy.assetLimitConfig(
      iUSDx.address
    );
    borrowAmount = iUSDxLimitConfig.minSingleLimit.add(BigNumber.from("1"));
    const beforeLockedFundsId = await timeLock.agreementCount();
    await iUSDx.connect(user1).borrow(borrowAmount);
    const afterLockedFundsId = await timeLock.agreementCount();
    expect(afterLockedFundsId.sub(beforeLockedFundsId)).to.be.eq(1);
  });

  describe("initialize", function () {
    // Should revert when initialize twice
    it("1. TL-INTL-0", async function () {
      await expect(
        timeLock.initialize(controllerV2.address)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("createAgreement", function () {
    // Should revert when caller is not the controller
    it("1. TL-CRTAGMT-0", async function () {
      await expect(
        timeLock.connect(user1).createAgreement(
          iETH.address, // _asset
          100, // _tokenAmounts
          user1.address, // _beneficiary
          (await getCurrentTime()) + 10
        )
      ).to.be.revertedWith("Can only be called by controller!");
    });
  });

  describe("claim", function () {
    // Should revert when time lock is frozen
    it("1. TL-CLM-0", async function () {
      const agreementCount = await timeLock.agreementCount();
      // User1 has a locked fund, its id is 0;
      const lockedFundsId = 0;
      await timeLock.freezeClaim();
      expect(await timeLock.frozen()).to.be.true;

      await expect(timeLock.claim([lockedFundsId])).to.be.revertedWith(
        "TimeLock is frozen"
      );
    });

    // Now third party can claim on behalf of beneficiary
    it("2. TL-CLM-1", async function () {
      // User1 has a locked fund, its id is 0;
      const lockedFundsId = 0;
      const agreementsDetails = await timeLock.getAgreement(lockedFundsId);
      expect(agreementsDetails.beneficiary).to.be.eq(user1.address);

      const releaseTime = agreementsDetails.releaseTime;
      const currentTime = await getCurrentTime();
      // Mine blocks to reach releasing time.
      const shouldMineTime = agreementsDetails.releaseTime.sub(currentTime);
      await increaseTime(shouldMineTime.toNumber());

      await expect(timeLock.claim([lockedFundsId])).to.changeTokenBalances(
        USDx,
        [timeLock, user1],
        [borrowAmount.mul(-1), borrowAmount]
      );
    });

    // Should revert when funds does not be released
    it("3. TL-CLM-2", async function () {
      // User1 has a locked fund, its id is 0;
      const lockedFundsId = 0;
      const agreementsDetails = await timeLock.getAgreement(lockedFundsId);
      expect(agreementsDetails.beneficiary).to.be.eq(user1.address);

      await expect(
        timeLock.connect(user1).claim([lockedFundsId])
      ).to.be.revertedWith("Release time not reached");
    });

    // Should revert when funds is frozen
    it("4. TL-CLM-3", async function () {
      // User1 has a locked fund, its id is 0;
      const lockedFundsId = 0;
      let agreementsDetails = await timeLock.getAgreement(lockedFundsId);
      const releaseTime = agreementsDetails.releaseTime;
      expect(agreementsDetails.beneficiary).to.be.eq(user1.address);
      expect(agreementsDetails.isFrozen).to.be.false;

      const currentTime = await getCurrentTime();
      // Mine blocks to reach releasing time.
      const shouldMineTime = agreementsDetails.releaseTime.sub(currentTime);
      await increaseTime(shouldMineTime.toNumber());

      await timeLock.freezeAgreements([lockedFundsId]);
      agreementsDetails = await timeLock.getAgreement(lockedFundsId);
      expect(agreementsDetails.isFrozen).to.be.true;

      await expect(
        timeLock.connect(user1).claim([lockedFundsId])
      ).to.be.revertedWith("Agreement frozen");
    });
  });

  describe("freezeAgreements", function () {
    // Should freeze agreements
    it("1. TL-FRZAGMT-0", async function () {
      const freezeAgreementsId = [100, 101];
      for (let i = 0; i < freezeAgreementsId.length; i++) {
        let agreementIdDetails = await timeLock.getAgreement(
          freezeAgreementsId[i]
        );

        expect(agreementIdDetails.isFrozen).to.be.false;
      }

      await timeLock.freezeAgreements(freezeAgreementsId);
      for (let i = 0; i < freezeAgreementsId.length; i++) {
        let agreementIdDetails = await timeLock.getAgreement(
          freezeAgreementsId[i]
        );

        expect(agreementIdDetails.isFrozen).to.be.true;
      }
    });

    // Should revert when caller is not owner
    it("2. TL-FRZAGMT-1", async function () {
      await expect(
        timeLock.connect(user1).freezeAgreements([100])
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });
  });

  describe("unfreezeAgreements", function () {
    // Should unfreeze agreements
    it("1. TL-UFRZAGMT-0", async function () {
      const freezeAgreementsId = [100, 101];

      await timeLock.freezeAgreements(freezeAgreementsId);

      for (let i = 0; i < freezeAgreementsId.length; i++) {
        let agreementIdDetails = await timeLock.getAgreement(
          freezeAgreementsId[i]
        );

        expect(agreementIdDetails.isFrozen).to.be.true;
      }

      await timeLock.unfreezeAgreements(freezeAgreementsId);

      for (let i = 0; i < freezeAgreementsId.length; i++) {
        let agreementIdDetails = await timeLock.getAgreement(
          freezeAgreementsId[i]
        );

        expect(agreementIdDetails.isFrozen).to.be.false;
      }
    });

    // Should revert when caller is not owner
    it("2. TL-UFRZAGMT-1", async function () {
      await expect(
        timeLock.connect(user1).unfreezeAgreements([100])
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });
  });

  describe("releaseAgreements", function () {
    // Should release agreements
    it("1. TL-RLSAGMT-0", async function () {
      const lockedFundsId = 0;

      await expect(
        timeLock.connect(user1).claim([lockedFundsId])
      ).to.be.revertedWith("Release time not reached");

      await timeLock.releaseAgreements([lockedFundsId]);
      await timeLock.connect(user1).claim([lockedFundsId]);
    });

    // Should revert when caller is not owner
    it("2. TL-RLSAGMT-1", async function () {
      await expect(
        timeLock.connect(user1).releaseAgreements([100])
      ).to.be.revertedWith("onlyOwner: caller is not the owner");
    });
  });

  describe("freezeClaim", function () {
    // Should freeze all agreements
    it("1. TL-FRZAAGMT-0", async function () {
      let timeLockFrozen = await timeLock.frozen();
      expect(timeLockFrozen).to.be.false;

      await timeLock.freezeClaim();

      timeLockFrozen = await timeLock.frozen();
      expect(timeLockFrozen).to.be.true;
    });

    // Should revert when caller is not owner
    it("2. TL-FRZAAGMT-1", async function () {
      await expect(timeLock.connect(user1).freezeClaim()).to.be.revertedWith(
        "onlyOwner: caller is not the owner"
      );
    });
  });

  describe("unfreezeClaim", function () {
    // Should unfreeze all agreements
    it("1. TL-UFRZAAGMT-0", async function () {
      await timeLock.freezeClaim();

      let timeLockFrozen = await timeLock.frozen();
      expect(timeLockFrozen).to.be.true;

      await timeLock.unfreezeClaim();

      timeLockFrozen = await timeLock.frozen();
      expect(timeLockFrozen).to.be.false;
    });

    // Should revert when caller is not owner
    it("2. TL-UFRZAAGMT-1", async function () {
      await expect(timeLock.connect(user1).unfreezeClaim()).to.be.revertedWith(
        "onlyOwner: caller is not the owner"
      );
    });
  });
});
