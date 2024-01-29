const { expect } = require("chai");
const { utils } = require("ethers");
const { ethers } = require("hardhat");

const {
  loadFixture,
  fixtureV2,
  deployiTokenAndSetConfigs,
  fixtureDefault,
} = require("../../helpers/fixtures.js");

const {
  upgradeProxy,
  verifyOnlyOwner,
  verifyNonlistediToken,
  deployProxy,
  deployProxyWithConstructor,
} = require("../../helpers/utils.js");

const { deployMockContract } = require("@ethereum-waffle/mock-contract");

describe("Controller V2 Admin", function () {
  let controllerV2, priceOracle;
  let USDx, iUSDx, iETH;
  let owner, user;

  const collateralFactor = utils.parseEther("0.9");
  const eModeLTV = utils.parseEther("0.93");
  const liquidationThreshold = utils.parseEther("0.92");
  const eModeLiqThreshold = utils.parseEther("0.95");
  const borrowFactor = utils.parseEther("1");
  const supplyCapacity = ethers.constants.MaxUint256;
  const borrowCapacity = ethers.constants.MaxUint256;
  const distributionFactor = utils.parseEther("1");
  const closeFactor = utils.parseEther("0.5");
  const liquidationIncentive = utils.parseEther("1.07");

  // DEBT_CEILING_DECIMALS = 2 => 1000000 means $10000
  const debtCeiling = 1000000;

  async function fixtureBeforeUpgradeCall() {
    const results = await loadFixture(fixtureDefault);

    // Load the v1 fixture
    const { controller, owner, iETH, rewardDistributor } = results;

    const extraImplicit = await (
      await ethers.getContractFactory("ControllerV2ExtraImplicit")
    ).deploy();
    await extraImplicit.deployed();

    const extraExplicit = await (
      await ethers.getContractFactory("ControllerV2ExtraExplicit")
    ).deploy();
    await extraExplicit.deployed();

    // upgrade the ControllerV2 implementation
    await upgradeProxy(
      controller.address,
      await ethers.getContractFactory("ControllerV2"),
      {
        unsafeAllowCustomTypes: true,
        constructorArgs: [extraImplicit.address, extraExplicit.address],
      }
    );
    const controllerV2 = new ethers.Contract(
      controller.address,
      require("../../../artifacts/contracts/interface/IController.sol/IController.json").abi,
      owner
    );

    // Deploy interest model V2 that calculates with seconds.
    const interestModelV2 = await (
      await ethers.getContractFactory("StablePrimaryInterestSecondModel")
    ).deploy();
    await interestModelV2.deployed();

    // Upgrade all iTokens, no interface change in iToken
    const iTokens = await controller.getAlliTokens();
    for (iToken of iTokens) {
      await upgradeProxy(
        iToken,
        iToken == iETH.address
          ? await ethers.getContractFactory("iETHV2")
          : await ethers.getContractFactory("iTokenV2"),
        {
          unsafeAllowCustomTypes: true,
        }
      );

      const iTokenInstance = new ethers.Contract(
        iToken,
        require("../../../artifacts/contracts/iTokenV2.sol/iTokenV2.json").abi,
        owner
      );

      // Upgrade interest model to V2.
      await iTokenInstance._setInterestRateModel(interestModelV2.address);
    }

    // Deploy reward distributor V3 that calculates with seconds.
    const rewardDistributorSecondV3 = await (
      await ethers.getContractFactory("RewardDistributorSecondV3")
    ).deploy();
    await rewardDistributorSecondV3.deployed();

    // Upgrade reward distributor to V3.
    await upgradeProxy(
      rewardDistributor.address,
      await ethers.getContractFactory("RewardDistributorSecondV3"),
      {
        unsafeAllowCustomTypes: true,
      }
    );

    return { ...results, controllerV2, extraImplicit, extraExplicit };
  }

  async function fixtureSetExtraLogic() {
    const results = await loadFixture(fixtureV2);

    const extraImplicit = await (
      await ethers.getContractFactory("ControllerV2ExtraImplicit")
    ).deploy();
    await extraImplicit.deployed();

    const extraExplicit = await (
      await ethers.getContractFactory("ControllerV2ExtraExplicit")
    ).deploy();
    await extraExplicit.deployed();

    return { ...results, extraImplicit, extraExplicit };
  }

  async function fixtureEModeBase() {
    const results = await loadFixture(fixtureV2);

    return { ...results };
  }

  describe("initialize", function () {
    let extraImplicit, extraExplicit;
    let newControllerV2;

    beforeEach(async function () {
      ({ controllerV2, owner, extraImplicit, extraExplicit } =
        await loadFixture(fixtureSetExtraLogic));

      const _newControllerV2 = await deployProxyWithConstructor(
        await ethers.getContractFactory("ControllerV2"),
        [extraImplicit.address, extraExplicit.address],
        {
          unsafeAllowCustomTypes: true,
          initializer: "initializeV2",
        },
        "",
        [extraImplicit.address, extraExplicit.address]
      );

      newControllerV2 = new ethers.Contract(
        _newControllerV2.address,
        require("../../../artifacts/contracts/interface/IController.sol/IController.json").abi,
        owner
      );
    });

    it("CONV2-INTLZ-0: Should only be initialized once", async function () {
      await expect(
        newControllerV2.initializeV2(
          extraImplicit.address,
          extraExplicit.address
        )
      ).to.revertedWith("Initializable: contract is already initialized");

      await expect(newControllerV2["initialize()"]()).to.revertedWith(
        "Initializable: contract is already initialized"
      );
    });

    it("CONV2-INTLZ-1: Should not be able to upgrade", async function () {
      await expect(
        newControllerV2._upgrade(extraImplicit.address, extraExplicit.address)
      ).to.revertedWith("_upgrade: Has been upgraded!");
    });

    it("CONV2-INTLZ-2: Should be able to set extra logics", async function () {
      const newExtraImplicit = await (
        await ethers.getContractFactory("ControllerV2ExtraImplicit")
      ).deploy();
      await newExtraImplicit.deployed();

      const newExtraExplicit = await (
        await ethers.getContractFactory("ControllerV2ExtraExplicit")
      ).deploy();
      await newExtraExplicit.deployed();

      await newControllerV2._setExtraImplicit(newExtraImplicit.address);
      await newControllerV2._setExtraExplicit(newExtraExplicit.address);
    });

    it("CONV2-INTLZ-3: Should be able to call extra logics", async function () {
      await newControllerV2._setLiquidationIncentive(utils.parseEther("1.08"));
      expect(await newControllerV2.isControllerExtraImplicit()).to.equal(true);
    });

    it("CONV2-INTLZ-4: Should be initialized in constructor", async function () {
      const controllerImpl = await (
        await ethers.getContractFactory("ControllerV2")
      ).deploy(extraImplicit.address, extraExplicit.address);
      await controllerImpl.deployed();

      await expect(controllerImpl["initialize()"]()).to.revertedWith(
        "Initializable: contract is already initialized"
      );

      await expect(
        controllerImpl._upgrade(extraImplicit.address, extraExplicit.address)
      ).to.revertedWith("_upgrade: Has been upgraded!");
    });
  });

  describe("_setExtraImplicit", function () {
    let extraImplicit, extraExplicit;
    let oldExtraImplicitAddress;

    beforeEach(async function () {
      ({
        controllerV2,
        owner,
        accounts: [user],
        iUSDx,
        extraImplicit,
        extraExplicit,
      } = await loadFixture(fixtureSetExtraLogic));

      oldExtraImplicitAddress = await controllerV2.extraImplicit();
    });

    it("CONV2-SXIMP-0: Should only called by owner", async function () {
      await verifyOnlyOwner(
        controllerV2, //contract
        "_setExtraImplicit", // method
        [extraImplicit.address], //args
        owner, // owner
        user, // non-owner
        "NewExtraImplicit", // ownerEvent
        [oldExtraImplicitAddress, extraImplicit.address], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(await controllerV2.extraImplicit()).to.eq(
            extraImplicit.address
          );
        },
        // nonownerChecks
        async () => {
          expect(await controllerV2.extraImplicit()).to.eq(
            oldExtraImplicitAddress
          );
        }
      );
    });
    it("CONV2-SXIMP-1: Should validate extra implicit address", async function () {
      await expect(
        controllerV2._setExtraImplicit(ethers.constants.AddressZero)
      ).to.revertedWith("_newExtraImplicit address invalid!");

      await expect(
        controllerV2._setExtraImplicit(oldExtraImplicitAddress)
      ).to.revertedWith("_newExtraImplicit address invalid!");
    });
    it("CONV2-SXIMP-2: Should validate extra implicit implementation", async function () {
      // The explicit revert reason will be returned only when isControllerExtraLogic() is false
      await expect(controllerV2._setExtraImplicit(owner.address)).to.be
        .reverted;
      await expect(controllerV2._setExtraImplicit(iUSDx.address)).to.be
        .reverted;
      await expect(controllerV2._setExtraImplicit(extraExplicit.address)).to.be
        .reverted;
    });
    it("CONV2-SXIMP-3: Should only get called after upgrade", async function () {
      const { controllerV2, extraImplicit } = await loadFixture(
        fixtureBeforeUpgradeCall
      );

      // Instead of `_upgrade`, call `_setExtraImplicit` directly
      await expect(
        controllerV2._setExtraImplicit(extraImplicit.address)
      ).to.revertedWith("_setExtraImplicit: Should upgrade first!");
    });
  });

  describe("_setExtraExplicit", function () {
    let extraImplicit, extraExplicit;
    let oldExtraExplicitAddress;

    beforeEach(async function () {
      ({
        controllerV2,
        owner,
        accounts: [user],
        iUSDx,
        extraExplicit,
        extraImplicit,
      } = await loadFixture(fixtureSetExtraLogic));

      oldExtraExplicitAddress = await controllerV2.extraExplicit();
    });

    it("CONV2-SXEXP-0: Should only called by owner", async function () {
      await verifyOnlyOwner(
        controllerV2, //contract
        "_setExtraExplicit", // method
        [extraExplicit.address], //args
        owner, // owner
        user, // non-owner
        "NewExtraExplicit", // ownerEvent
        [oldExtraExplicitAddress, extraExplicit.address], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(await controllerV2.extraExplicit()).to.eq(
            extraExplicit.address
          );
        },
        // nonownerChecks
        async () => {
          expect(await controllerV2.extraExplicit()).to.eq(
            oldExtraExplicitAddress
          );
        }
      );
    });
    it("CONV2-SXEXP-1: Should validate extra explicit address", async function () {
      await expect(
        controllerV2._setExtraExplicit(ethers.constants.AddressZero)
      ).to.revertedWith("_newExtraExplicit address invalid!");

      await expect(
        controllerV2._setExtraExplicit(oldExtraExplicitAddress)
      ).to.revertedWith("_newExtraExplicit address invalid!");
    });
    it("CONV2-SXEXP-2: Should validate extra explicit implementation", async function () {
      // The explicit revert reason will be returned only when isControllerExtraExplicit() is false
      await expect(controllerV2._setExtraExplicit(owner.address)).to.be
        .reverted;
      await expect(controllerV2._setExtraExplicit(iUSDx.address)).to.be
        .reverted;
      await expect(controllerV2._setExtraExplicit(extraImplicit.address)).to.be
        .reverted;
    });
    it("CONV2-SXEXP-3: Should only get called after upgrade", async function () {
      const { controllerV2, extraExplicit } = await loadFixture(
        fixtureBeforeUpgradeCall
      );

      // Instead of `_upgrade`, call `_setExtraExplicit` directly
      await expect(
        controllerV2._setExtraExplicit(extraExplicit.address)
      ).to.revertedWith("_setExtraExplicit: Should upgrade first!");
    });
  });

  describe("_upgrade", function () {
    let extraImplicit, extraExplicit;

    beforeEach(async function () {
      ({
        controllerV2,
        owner,
        accounts: [user],
        iUSDx,
        extraImplicit,
        extraExplicit,
      } = await loadFixture(fixtureBeforeUpgradeCall));
    });

    it("CONV2-UPGRD-0: Should only called by owner", async function () {
      await verifyOnlyOwner(
        controllerV2, //contract
        "_upgrade", // method
        [extraImplicit.address, extraExplicit.address], //args
        owner, // owner
        user, // non-owner
        "NewExtraImplicit", // ownerEvent
        [ethers.constants.AddressZero, extraImplicit.address], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(await controllerV2.extraImplicit()).to.eq(
            extraImplicit.address
          );
          expect(await controllerV2.extraExplicit()).to.eq(
            extraExplicit.address
          );
        },
        // nonownerChecks
        async () => {
          expect(await controllerV2.extraImplicit()).to.eq(
            ethers.constants.AddressZero
          );
          expect(await controllerV2.extraExplicit()).to.eq(
            ethers.constants.AddressZero
          );
        }
      );
    });

    it("CONV2-UPGRD-1: Should validate extra logic address", async function () {
      await expect(
        controllerV2._upgrade(
          ethers.constants.AddressZero,
          extraExplicit.address
        )
      ).to.revertedWith("_newExtraImplicit address invalid!");

      await expect(
        controllerV2._upgrade(
          extraImplicit.address,
          ethers.constants.AddressZero
        )
      ).to.revertedWith("_newExtraExplicit address invalid!");

      await expect(
        controllerV2._upgrade(
          ethers.constants.AddressZero,
          ethers.constants.AddressZero
        )
      ).to.revertedWith("_newExtraImplicit address invalid!");

      // Unreachable as only allowed _upgrade once
      // await controllerV2._upgrade(extraLogic.address);
      // await expect(controllerV2._upgrade(extraLogic.address)).to.revertedWith(
      //   "_newExtraLogic address invalid!"
      // );
    });

    it("CONV2-UPGRD-2: Should validate extra logic implementation", async function () {
      // The explicit revert reason will be returned only when isControllerExtraLogic() is false
      await expect(controllerV2._upgrade(owner.address, extraExplicit.address))
        .to.be.reverted;
      await expect(controllerV2._upgrade(iUSDx.address, extraExplicit.address))
        .to.be.reverted;
      await expect(
        controllerV2._upgrade(extraExplicit.address, extraExplicit.address)
      ).to.be.reverted;
      await expect(controllerV2._upgrade(extraImplicit.address, owner.address))
        .to.be.reverted;
      await expect(controllerV2._upgrade(extraImplicit.address, iUSDx.address))
        .to.be.reverted;
      await expect(
        controllerV2._upgrade(extraImplicit.address, extraImplicit.address)
      ).to.be.reverted;
    });

    it("CONV2-UPGRD-3: Should only upgrade once", async function () {
      await controllerV2._upgrade(extraImplicit.address, extraExplicit.address);
      await expect(
        controllerV2._upgrade(extraImplicit.address, extraExplicit.address)
      ).to.revertedWith("_upgrade: Has been upgraded!");
    });

    it("CONV2-UPGRD-4: Should initialized liquidation threshold of all markets", async function () {
      await controllerV2._upgrade(extraImplicit.address, extraExplicit.address);

      const alliTokens = await controllerV2.getAlliTokens();

      for (iToken of alliTokens) {
        // console.log(iToken);

        // This does not work, need to check how solidity handle mapping (address => uint256[])
        // const [collateralFactor, liquidationThreshold] =
        //   await controllerV2.marketCollateralFactor(iToken);

        const collateralFactor = await controllerV2.getLTV(iToken);

        const liquidationThreshold = await controllerV2.getLiquidationThreshold(
          iToken
        );

        const { collateralFactorMantissa } = await controllerV2.marketsV2(
          iToken
        );

        expect(collateralFactor).to.equal(collateralFactorMantissa);
        expect(liquidationThreshold).to.gt(collateralFactorMantissa);
      }
    });

    it("CONV2-UPGRD-5: Should initialized the default emode", async function () {
      await controllerV2._upgrade(extraImplicit.address, extraExplicit.address);
      expect(await controllerV2.getEModeLength()).to.equal(1);

      const { liquidationIncentive, closeFactor, label } =
        await controllerV2.eModes(0);

      const gLiquidationIncentive =
        await controllerV2.liquidationIncentiveMantissa();
      const gCloseFactor = await controllerV2.closeFactorMantissa();

      expect(liquidationIncentive).to.equal(gLiquidationIncentive);
      expect(closeFactor).to.equal(gCloseFactor);
      expect(label).to.equal("Default");
    });

    it("CONV2-UPGRD-6: Should revert in fallback before upgrade", async function () {
      await expect(
        controllerV2._setTimeLock(ethers.constants.AddressZero)
      ).to.revertedWith("No Extra Implicit address!");
    });

    it("CONV2-UPGRD-7: Should revert when explicitly delegatecall before upgrade", async function () {
      await expect(
        controllerV2._setCloseFactor(closeFactor)
      ).to.be.revertedWith("Address: delegate call to non-contract");
    });
  });

  // either address of timeLock and timeLockStrategy being zero, no delays
  // By default fixture the minSingleLimit is set to 1000
  async function verifyNoDelayAddressSet(user, iToken, underlying) {
    const amount = ethers.utils.parseEther("2000");
    await iToken.connect(user).mintForSelfAndEnterMarket(amount.mul(5));

    await expect(iToken.connect(user).borrow(amount)).to.changeTokenBalance(
      underlying,
      user,
      amount
    );

    await expect(
      iToken.connect(user).redeemUnderlying(user.address, amount)
    ).to.changeTokenBalance(underlying, user, amount);
  }

  describe("_setTimeLock", function () {
    let oldTimeLock;

    beforeEach(async function () {
      ({ controllerV2, owner, accounts, iUSDx, USDx, timeLock } =
        await loadFixture(fixtureV2));

      [user] = accounts;
      oldTimeLock = await controllerV2.timeLock();
    });

    it("CONV2-STMLK-0: Should only called by owner", async function () {
      const newTimeLock = ethers.constants.AddressZero;

      await verifyOnlyOwner(
        controllerV2, //contract
        "_setTimeLock", // method
        [newTimeLock], //args
        owner, // owner
        user, // non-owner
        "NewTimeLock", // ownerEvent
        [oldTimeLock, newTimeLock], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(await controllerV2.timeLock()).to.eq(newTimeLock);
        },
        // nonownerChecks
        async () => {
          expect(await controllerV2.timeLock()).to.eq(oldTimeLock);
        }
      );
    });

    it("CONV2-STMLK-1: Should validate time lock address", async function () {
      await expect(controllerV2._setTimeLock(oldTimeLock)).to.revertedWith(
        "_newTimeLock address invalid!"
      );

      const mockTimeLock = await deployMockContract(
        owner,
        require("../../../artifacts/contracts/DefaultTimeLock.sol/DefaultTimeLock.json")
          .abi
      );
      await mockTimeLock.mock.controller.returns(mockTimeLock.address);

      await expect(
        controllerV2._setTimeLock(mockTimeLock.address)
      ).to.revertedWith("_newTimeLock's controller mismatch!");
    });

    it("CONV2-STMLK-2: Time lock address can be zero", async function () {
      await controllerV2._setTimeLock(ethers.constants.AddressZero);

      await verifyNoDelayAddressSet(user, iUSDx, USDx);
    });
  });

  describe("_setTimeLockStrategy", function () {
    let oldTimeLockStrategy;

    beforeEach(async function () {
      ({ controllerV2, owner, accounts, iUSDx, timeLockStrategy } =
        await loadFixture(fixtureV2));

      [user] = accounts;
      oldTimeLockStrategy = await controllerV2.timeLockStrategy();
    });

    it("CONV2-STMLKSTR-0: Should only called by owner", async function () {
      const newTimeLockStrategy = ethers.constants.AddressZero;

      await verifyOnlyOwner(
        controllerV2, //contract
        "_setTimeLockStrategy", // method
        [newTimeLockStrategy], //args
        owner, // owner
        user, // non-owner
        "NewTimeLockStrategy", // ownerEvent
        [oldTimeLockStrategy, newTimeLockStrategy], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(await controllerV2.timeLockStrategy()).to.eq(
            newTimeLockStrategy
          );
        },
        // nonownerChecks
        async () => {
          expect(await controllerV2.timeLockStrategy()).to.eq(
            oldTimeLockStrategy
          );
        }
      );
    });

    it("CONV2-STMLKSTR-1: Should validate time lock strategy address", async function () {
      await expect(
        controllerV2._setTimeLockStrategy(oldTimeLockStrategy)
      ).to.revertedWith("_newTimeLockStrategy address invalid!");

      const mockTimeLockStrategy = await deployMockContract(
        owner,
        require("../../../artifacts/contracts/TimeLockStrategy.sol/TimeLockStrategy.json")
          .abi
      );
      await mockTimeLockStrategy.mock.controller.returns(
        mockTimeLockStrategy.address
      );

      await expect(
        controllerV2._setTimeLockStrategy(mockTimeLockStrategy.address)
      ).to.revertedWith("_newTimeLockStrategy's controller mismatch!");
    });

    it("CONV2-STMLKSTR-2: Time lock strategy address can be zero", async function () {
      await controllerV2._setTimeLockStrategy(ethers.constants.AddressZero);
      await verifyNoDelayAddressSet(user, iUSDx, USDx);
    });
  });

  describe("_addMarket", function () {
    beforeEach(async function () {
      ({ controllerV2, iUSDx } = await loadFixture(fixtureV2));
    });

    it("CONV2-ADDM-0: Should revert as Can not add market without specifying liquidation threshold", async function () {
      await expect(
        controllerV2._addMarket(
          iUSDx.address,
          collateralFactor,
          borrowFactor,
          supplyCapacity,
          borrowCapacity,
          distributionFactor
        )
      ).to.be.revertedWith("_addMarket() is deprecated, use _addMarketV2()!");
    });
  });

  async function fixtureBeforeAddMarket() {
    const results = await loadFixture(fixtureV2);

    const { controllerV2, controllerStock, interestRateModel, priceOracle } =
      results;

    // A normal token
    const { underlying: wstETH, iToken: iwstETH } =
      await deployiTokenAndSetConfigs(
        "wstETH",
        "wstETH",
        18,
        "dForce lending wstETH",
        "iwstETH",
        controllerV2,
        controllerStock,
        interestRateModel,
        priceOracle,
        false, // do not add to market
        "0.075",
        "0.0009",
        "0.1"
      );

    return { ...results, wstETH, iwstETH };
  }

  describe("_addMarketV2", function () {
    let iwstETH;
    let marketInfo;

    beforeEach(async function () {
      ({ controllerV2, owner, accounts, iwstETH, iUSDx } = await loadFixture(
        fixtureBeforeAddMarket
      ));

      [user] = accounts;

      marketInfo = {
        _iToken: iwstETH.address,
        _collateralFactor: collateralFactor,
        _borrowFactor: borrowFactor,
        _supplyCapacity: supplyCapacity,
        _borrowCapacity: borrowCapacity,
        _distributionFactor: distributionFactor,
        _eModeID: 0,
        _eModeLtv: 0,
        _eModeLiqThreshold: 0,
        _liquidationThreshold: liquidationThreshold,
        _debtCeiling: 0,
        _borrowableInIsolation: false,
      };
    });

    it("CONV2-ADDMV2-0: Should only called by owner", async function () {
      await verifyOnlyOwner(
        controllerV2, //contract
        "_addMarketV2", // method
        [marketInfo], //args
        owner, // owner
        user, // non-owner
        "MarketAdded", // ownerEvent
        [
          iwstETH.address,
          collateralFactor,
          borrowFactor,
          supplyCapacity,
          borrowCapacity,
          distributionFactor,
        ], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(await controllerV2.hasiToken(iwstETH.address)).to.eq(true);
        },
        // nonownerChecks
        async () => {
          expect(await controllerV2.hasiToken(iwstETH.address)).to.eq(false);
        }
      );
    });

    it("CONV2-ADDMV2-1: Should call the v1 logic, check a listed token", async function () {
      // Change the _iToken address
      marketInfo._iToken = iUSDx.address;

      await expect(controllerV2._addMarketV2(marketInfo)).to.be.revertedWith(
        "Token has already been listed"
      );
    });
    it("CONV2-ADDMV2-2: Should set the collateral factor and liquidation threshold", async function () {
      await controllerV2._addMarketV2(marketInfo);

      expect(await controllerV2.getLTV(iwstETH.address)).to.equal(
        collateralFactor
      );
      expect(
        await controllerV2.getLiquidationThreshold(iwstETH.address)
      ).to.equal(liquidationThreshold);

      // Also check emode is 0
      expect((await controllerV2.marketsV2(iwstETH.address)).eModeID).to.equal(
        0
      );
      expect(await controllerV2.getEModeLTV(iwstETH.address)).to.equal(0);
      expect(
        await controllerV2.getEModeLiquidationThreshold(iwstETH.address)
      ).to.equal(0);

      // debt ceiling
      expect(
        (await controllerV2.marketsV2(iwstETH.address)).debtCeiling
      ).to.equal(0);

      // borrowale in isolation
      expect(
        (await controllerV2.marketsV2(iwstETH.address)).borrowableInIsolation
      ).to.equal(false);
    });
    it("CONV2-ADDMV2-3: Should set the emode id, emode LTV and emode liquidation threshold", async function () {
      // Change the Emode config
      marketInfo._eModeID = 2; // ETH
      marketInfo._eModeLtv = eModeLTV;
      marketInfo._eModeLiqThreshold = eModeLiqThreshold;

      await controllerV2._addMarketV2(marketInfo);

      expect((await controllerV2.marketsV2(iwstETH.address)).eModeID).to.equal(
        2
      );
      expect(await controllerV2.getEModeLTV(iwstETH.address)).to.equal(
        eModeLTV
      );
      expect(
        await controllerV2.getEModeLiquidationThreshold(iwstETH.address)
      ).to.equal(eModeLiqThreshold);
    });
    it("CONV2-ADDMV2-4: Should set the debt ceiling", async function () {
      // Change the debt ceiling config
      marketInfo._debtCeiling = debtCeiling;

      await controllerV2._addMarketV2(marketInfo);

      expect(
        (await controllerV2.marketsV2(iwstETH.address)).debtCeiling
      ).to.equal(debtCeiling);
    });
    it("CONV2-ADDMV2-5: Should set the borrowable in isolation", async function () {
      // Change the debt ceiling config
      marketInfo._borrowableInIsolation = true;

      await controllerV2._addMarketV2(marketInfo);

      expect(
        (await controllerV2.marketsV2(iwstETH.address)).borrowableInIsolation
      ).to.equal(true);
    });
  });

  describe("_setCollateralFactor", function () {
    let oldCollateralFactor, newCollateralFactor;

    beforeEach(async function () {
      ({
        controllerV2,
        owner,
        iUSDx,
        accounts: [user],
      } = await loadFixture(fixtureV2));

      oldCollateralFactor = (await controllerV2.marketsV2(iUSDx.address))
        .collateralFactorMantissa;
      newCollateralFactor = ethers.utils.parseEther("0.88");
    });

    it("CONV2-SCLTFT-0: Should only called by owner", async function () {
      await verifyOnlyOwner(
        controllerV2, //contract
        "_setCollateralFactor", // method
        [iUSDx.address, newCollateralFactor], //args
        owner, // owner
        user, // non-owner
        "NewCollateralFactor", // ownerEvent
        [iUSDx.address, oldCollateralFactor, newCollateralFactor], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(
            (await controllerV2.marketsV2(iUSDx.address))
              .collateralFactorMantissa
          ).to.eq(newCollateralFactor);
        },
        // nonownerChecks
        async () => {
          expect(
            (await controllerV2.marketsV2(iUSDx.address))
              .collateralFactorMantissa
          ).to.eq(oldCollateralFactor);
        }
      );
    });

    it("CONV2-SCLTFT-1: Should call the v1 logic, check a non-list token ", async function () {
      await verifyNonlistediToken(controllerV2, "_setCollateralFactor", [
        newCollateralFactor,
      ]);
    });

    it("CONV2-SCLTFT-2: Should also set collateral factor 0", async function () {
      await controllerV2._setCollateralFactor(
        iUSDx.address,
        newCollateralFactor
      );

      expect(await controllerV2.getLTV(iUSDx.address)).to.equal(
        newCollateralFactor
      );
    });
    it("CONV2-SCLTFT-3: Should validate the collateral factor ≤ liquidation threshold", async function () {
      const liquidationThreshold = await controllerV2.getLiquidationThreshold(
        iUSDx.address
      );

      await expect(
        controllerV2._setCollateralFactor(
          iUSDx.address,
          liquidationThreshold.add(1)
        )
      ).to.be.revertedWith(
        "_validateCollateralFactor: Invalid collateral factor!"
      );
    });
  });

  describe("_setCloseFactor", function () {
    let oldCloseFactor, newCloseFactor;

    beforeEach(async function () {
      ({
        controllerV2,
        owner,
        accounts: [user],
      } = await loadFixture(fixtureV2));

      oldCloseFactor = await controllerV2.closeFactorMantissa();
      newCloseFactor = ethers.utils.parseEther("0.55");
    });

    it("CONV2-SCFT-0: Should only called by owner", async function () {
      await verifyOnlyOwner(
        controllerV2, //contract
        "_setCloseFactor", // method
        [newCloseFactor], //args
        owner, // owner
        user, // non-owner
        "NewCloseFactor", // ownerEvent
        [oldCloseFactor, newCloseFactor], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(await controllerV2.closeFactorMantissa()).to.eq(
            newCloseFactor
          );
        },
        // nonownerChecks
        async () => {
          expect(await controllerV2.closeFactorMantissa()).to.eq(
            oldCloseFactor
          );
        }
      );
    });
    it("CONV2-SCFT-1: Should call the v1 logic, check an invalid value", async function () {
      // 0.05- 0.9
      const invalidCloseFactor = ethers.utils.parseEther("0.04");

      await expect(
        controllerV2._setCloseFactor(invalidCloseFactor)
      ).to.be.revertedWith("Close factor invalid");
    });
    it("CONV2-SCFT-2: Should also set close factor for emode 0", async function () {
      await controllerV2._setCloseFactor(newCloseFactor);

      expect((await controllerV2.eModes(0)).closeFactor).to.equal(
        newCloseFactor
      );
    });
  });

  describe("_setLiquidationIncentive", function () {
    let oldLiquidationIncentive, newLiquidationIncentive;

    beforeEach(async function () {
      ({
        controllerV2,
        owner,
        accounts: [user],
      } = await loadFixture(fixtureV2));

      oldLiquidationIncentive =
        await controllerV2.liquidationIncentiveMantissa();
      newLiquidationIncentive = ethers.utils.parseEther("1.08");
    });

    it("CONV2-SLQDCTV-0: Should only called by owner", async function () {
      await verifyOnlyOwner(
        controllerV2, //contract
        "_setLiquidationIncentive", // method
        [newLiquidationIncentive], //args
        owner, // owner
        user, // non-owner
        "NewLiquidationIncentive", // ownerEvent
        [oldLiquidationIncentive, newLiquidationIncentive], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(await controllerV2.liquidationIncentiveMantissa()).to.eq(
            newLiquidationIncentive
          );
        },
        // nonownerChecks
        async () => {
          expect(await controllerV2.liquidationIncentiveMantissa()).to.eq(
            oldLiquidationIncentive
          );
        }
      );
    });
    it("CONV2-SLQDCTV-1: Should call the v1 logic, check an invalid value", async function () {
      // 1.0 - 1.5
      const invalidLiquidationIncentive = ethers.utils.parseEther("1.51");

      await expect(
        controllerV2._setLiquidationIncentive(invalidLiquidationIncentive)
      ).to.be.revertedWith("Liquidation incentive invalid");
    });
    it("CONV2-SLQDCTV-0: Should also set liquidation incentive for emode 0", async function () {
      await controllerV2._setLiquidationIncentive(newLiquidationIncentive);

      expect((await controllerV2.eModes(0)).liquidationIncentive).to.equal(
        newLiquidationIncentive
      );
    });
  });

  describe("Isolation Mode", function () {
    describe("_setDebtCeiling", function () {
      let oldDebtCeiling, newDebtCeiling;

      beforeEach(async function () {
        ({
          controllerV2,
          owner,
          accounts: [user],
          iUSDx,
          iARB,
        } = await loadFixture(fixtureV2));

        oldDebtCeiling = (await controllerV2.marketsV2(iARB.address))
          .debtCeiling;

        newDebtCeiling = oldDebtCeiling.mul(2);
      });

      it("CONV2-SETDTC-0: Should only called by owner", async function () {
        await verifyOnlyOwner(
          controllerV2, //contract
          "_setDebtCeiling", // method
          [iARB.address, newDebtCeiling], //args
          owner, // owner
          user, // non-owner
          "DebtCeilingChanged", // ownerEvent
          [iARB.address, oldDebtCeiling, newDebtCeiling], // ownerEventArgs
          // ownerChecks
          async () => {
            expect(
              (await controllerV2.marketsV2(iARB.address)).debtCeiling
            ).to.eq(newDebtCeiling);
          },
          // nonownerChecks
          async () => {
            expect(
              (await controllerV2.marketsV2(iARB.address)).debtCeiling
            ).to.eq(oldDebtCeiling);
          }
        );
      });

      it("CONV2-SETDTC-1: Should check the non-listed token", async function () {
        await verifyNonlistediToken(controllerV2, "_setDebtCeiling", [
          newDebtCeiling,
        ]);
      });

      it("CONV2-SETDTC-2: Should not change non-isolated to isolated", async function () {
        await expect(
          controllerV2._setDebtCeiling(iUSDx.address, newDebtCeiling)
        ).to.revertedWith("_setDebtCeiling: can not change to isolated!");
      });

      it("CONV2-SETDTC-3: Should be able to change isolated to non-isolated ", async function () {
        await controllerV2._setDebtCeiling(iARB.address, 0);

        const afterDebtCeiling = (await controllerV2.marketsV2(iARB.address))
          .debtCeiling;

        expect(afterDebtCeiling).to.eq(0);
      });

      it("CONV2-SETDTC-4: Should increase the corresponding debt ceiling", async function () {
        await controllerV2._setDebtCeiling(
          iARB.address,
          oldDebtCeiling.add(10000)
        );

        const afterDebtCeiling = (await controllerV2.marketsV2(iARB.address))
          .debtCeiling;

        expect(afterDebtCeiling).to.gt(oldDebtCeiling);
      });

      it("CONV2-SETDTC-4: Should decrease debt ceiling", async function () {
        await controllerV2._setDebtCeiling(
          iARB.address,
          oldDebtCeiling.sub(10000)
        );

        afterDebtCeiling = (await controllerV2.marketsV2(iARB.address))
          .debtCeiling;
        expect(oldDebtCeiling).to.gt(afterDebtCeiling);
        expect(afterDebtCeiling).to.gt(0);
      });

      it("CONV2-SETDTC-5: Should change from isolated to non-isolated, but not isolated again", async function () {
        await controllerV2._setDebtCeiling(iARB.address, 0);

        let marketDetails = await controllerV2.marketsV2(iARB.address);
        const beforeDebtCeilingAmount = marketDetails.debtCeiling;
        expect(beforeDebtCeilingAmount).to.eq(0);

        await expect(
          controllerV2._setDebtCeiling(iARB.address, 1000)
        ).to.revertedWith("_setDebtCeiling: can not change to isolated!");
      });
    });

    describe("_setBorrowableInIsolation", function () {
      let oldBorrowableInIsolation, newBorrowableInIsolation;

      beforeEach(async function () {
        ({
          controllerV2,
          owner,
          accounts: [user],
          iUSDx,
          iUSDC,
        } = await loadFixture(fixtureV2));

        oldBorrowableInIsolation = (await controllerV2.marketsV2(iUSDC.address))
          .borrowableInIsolation;

        newBorrowableInIsolation = false;
      });

      it("CONV2-SETBRWB-0: Should only called by owner", async function () {
        await verifyOnlyOwner(
          controllerV2, //contract
          "_setBorrowableInIsolation", // method
          [iUSDC.address, newBorrowableInIsolation], //args
          owner, // owner
          user, // non-owner
          "BorrowableInIsolationChanged", // ownerEvent
          [iUSDC.address, newBorrowableInIsolation], // ownerEventArgs
          // ownerChecks
          async () => {
            expect(
              (await controllerV2.marketsV2(iUSDC.address))
                .borrowableInIsolation
            ).to.eq(newBorrowableInIsolation);
          },
          // nonownerChecks
          async () => {
            expect(
              (await controllerV2.marketsV2(iUSDC.address))
                .borrowableInIsolation
            ).to.eq(oldBorrowableInIsolation);
          }
        );
      });

      it("CONV2-SETBRWB-1: Should check the non-listed token", async function () {
        await verifyNonlistediToken(controllerV2, "_setBorrowableInIsolation", [
          newBorrowableInIsolation,
        ]);
      });

      it("CONV2-SETBRWB-2: Should set the corresponding borrowable", async function () {
        let marketDetails = await controllerV2.marketsV2(iUSDx.address);
        let borrowale = marketDetails.borrowableInIsolation;
        expect(borrowale).to.eq(false);

        await controllerV2._setBorrowableInIsolation(iUSDx.address, true);

        marketDetails = await controllerV2.marketsV2(iUSDx.address);
        borrowale = marketDetails.borrowableInIsolation;
        expect(borrowale).to.eq(true);
      });
    });
  });

  describe("EMode", function () {
    let liquidationThreshold = utils.parseEther("0.95"); //95%
    let eModeLTV = utils.parseEther("0.97"); // 97%
    let eModeLiquidationThreshold = utils.parseEther("0.98"); //98%
    let eModeLiquidationIncentive = utils.parseEther("1.01"); // 1%
    let eModeCloseFactor = utils.parseEther("0.4"); // 40%
    let eModeLabel = "Test Category";

    const minEModeLiquidationIncentive = utils.parseEther("1.0");
    const maxEModeLiquidationIncentive = utils.parseEther("1.5");
    const minEModeCloseFactor = utils.parseEther("0.05");
    const maxEModeCloseFactor = utils.parseEther("0.9");

    async function verifyEModeLiquidationIncentiveValidation(
      func,
      remainningArgs,
      liquidationIncentiveArgIndex = 0
    ) {
      let eModeLiquidationIncentive;
      let args;

      eModeLiquidationIncentive = minEModeLiquidationIncentive.sub(1);
      args = [
        ...remainningArgs.slice(0, liquidationIncentiveArgIndex),
        eModeLiquidationIncentive,
        ...remainningArgs.slice(liquidationIncentiveArgIndex),
      ];

      await expect(controllerV2[func](...args)).to.be.revertedWith(
        "_validateEModeLiquidationIncentive: Invalid liquidation incentive!"
      );

      eModeLiquidationIncentive = maxEModeLiquidationIncentive.add(1);
      args = [
        ...remainningArgs.slice(0, liquidationIncentiveArgIndex),
        eModeLiquidationIncentive,
        ...remainningArgs.slice(liquidationIncentiveArgIndex),
      ];

      await expect(controllerV2[func](...args)).to.be.revertedWith(
        "_validateEModeLiquidationIncentive: Invalid liquidation incentive!"
      );
    }

    async function verifyEModeCloseFactorValidation(
      func,
      remainningArgs,
      closeFactorArgIndex = 0
    ) {
      let eModeCloseFactor;
      let args;

      eModeCloseFactor = minEModeCloseFactor.sub(1);
      args = [
        ...remainningArgs.slice(0, closeFactorArgIndex),
        eModeCloseFactor,
        ...remainningArgs.slice(closeFactorArgIndex),
      ];

      await expect(controllerV2[func](...args)).to.be.revertedWith(
        "_validateEModeCloseFactor: Invalid close factor!"
      );

      eModeCloseFactor = maxEModeCloseFactor.add(1);
      args = [
        ...remainningArgs.slice(0, closeFactorArgIndex),
        eModeCloseFactor,
        ...remainningArgs.slice(closeFactorArgIndex),
      ];

      await expect(controllerV2[func](...args)).to.be.revertedWith(
        "_validateEModeCloseFactor: Invalid close factor!"
      );
    }

    describe("_addEMode", function () {
      let oldEModeLength;

      beforeEach(async function () {
        ({
          controllerV2,
          owner,
          accounts: [user],
          iETH,
          iUSDx,
        } = await loadFixture(fixtureEModeBase));

        oldEModeLength = await controllerV2.getEModeLength();
      });

      it("CONV2-ADDE-0: Should only called by owner", async function () {
        // Has set the stable coin eMode config.
        // So there should be 3 eMode configs: Default & Stablecoin & ETH
        expect(oldEModeLength).to.eq(3);

        await verifyOnlyOwner(
          controllerV2, //contract
          "_addEMode", // method
          [eModeLiquidationIncentive, eModeCloseFactor, eModeLabel], //args
          owner, // owner
          user, // non-owner
          "EModeAdded", // ownerEvent
          [
            oldEModeLength,
            eModeLiquidationIncentive,
            eModeCloseFactor,
            eModeLabel,
          ], // ownerEventArgs
          // ownerChecks
          async () => {
            expect(await controllerV2.getEModeLength()).to.eq(
              oldEModeLength.add(1)
            );
          },
          // nonownerChecks
          async () => {
            expect(await controllerV2.getEModeLength()).to.eq(oldEModeLength);
          }
        );
      });

      it("CONV2-ADDE-1: Should revert when new liquidation incentive is invalid", async function () {
        await verifyEModeLiquidationIncentiveValidation("_addEMode", [
          eModeCloseFactor,
          eModeLabel,
        ]);
      });

      it("CONV2-ADDE-2: Should revert when new close factor is invalid", async function () {
        verifyEModeCloseFactorValidation(
          "_addEMode",
          [eModeLiquidationIncentive, eModeLabel],
          1
        );
      });

      it("CONV2-ADDE-3: Should add emode, length +1, corresponding liquidation incentive and close factor", async function () {
        await controllerV2._addEMode(
          eModeLiquidationIncentive,
          eModeCloseFactor,
          eModeLabel
        );

        const newEModeLength = await controllerV2.getEModeLength();
        expect(newEModeLength.sub(oldEModeLength)).to.eq(1);

        const { liquidationIncentive, closeFactor, label } =
          await controllerV2.eModes(oldEModeLength);
        expect(liquidationIncentive).to.equal(eModeLiquidationIncentive);
        expect(closeFactor).to.equal(eModeCloseFactor);
        expect(label).to.equal(eModeLabel);
      });
    });

    async function verifyEModeIDValidation(
      func,
      minEModeID,
      maxEModeID,
      remainningArgs,
      eModeIDArgIndex = 0
    ) {
      let eModeID;
      let args;

      eModeID = minEModeID.sub(1);
      args = [
        ...remainningArgs.slice(0, eModeIDArgIndex),
        eModeID,
        ...remainningArgs.slice(eModeIDArgIndex),
      ];

      await expect(controllerV2[func](...args)).to.be.revertedWith(
        "_validateEModeID: Invalid eMode ID!"
      );

      eModeID = maxEModeID.add(1);
      args = [
        ...remainningArgs.slice(0, eModeIDArgIndex),
        eModeID,
        ...remainningArgs.slice(eModeIDArgIndex),
      ];

      await expect(controllerV2[func](...args)).to.be.revertedWith(
        "_validateEModeID: Invalid eMode ID!"
      );
    }

    describe("_setEModeLiquidationIncentive", function () {
      const eModeID = 1;
      let oldLiquidationIncentive, newLiquidationIncentive;

      beforeEach(async function () {
        ({
          controllerV2,
          owner,
          accounts: [user],
        } = await loadFixture(fixtureEModeBase));

        ({ liquidationIncentive: oldLiquidationIncentive } =
          await controllerV2.eModes(eModeID));

        newLiquidationIncentive = utils.parseEther("1.0555");
      });

      it("CONV2-SETEMLQD-0: Should only called by owner", async function () {
        await verifyOnlyOwner(
          controllerV2, //contract
          "_setEModeLiquidationIncentive", // method
          [eModeID, newLiquidationIncentive], //args
          owner, // owner
          user, // non-owner
          "NewEModeLiquidationIncentive", // ownerEvent
          [eModeID, oldLiquidationIncentive, newLiquidationIncentive], // ownerEventArgs
          // ownerChecks
          async () => {
            expect(
              (await controllerV2.eModes(eModeID)).liquidationIncentive
            ).to.eq(newLiquidationIncentive);
          },
          // nonownerChecks
          async () => {
            expect(
              (await controllerV2.eModes(eModeID)).liquidationIncentive
            ).to.eq(oldLiquidationIncentive);
          }
        );
      });

      it("CONV2-SETEMLQD-1: Should validate emodeID", async function () {
        // emode 0 can not be set via emode
        const minEModeID = utils.parseUnits("1", 0);
        const maxEModeID = (await controllerV2.getEModeLength()).sub(1);

        await verifyEModeIDValidation(
          "_setEModeLiquidationIncentive",
          minEModeID,
          maxEModeID,
          [newLiquidationIncentive]
        );
      });

      it("CONV2-SETEMLQD-2: Should validate emode liquidation incentive", async function () {
        await verifyEModeLiquidationIncentiveValidation(
          "_setEModeLiquidationIncentive",
          [eModeID],
          1
        );
      });
    });

    describe("_setEModeCloseFactor", function () {
      const eModeID = 1;
      let oldCloseFactor, newCloseFactor;

      beforeEach(async function () {
        ({
          controllerV2,
          owner,
          accounts: [user],
        } = await loadFixture(fixtureEModeBase));

        ({ closeFactor: oldCloseFactor } = await controllerV2.eModes(eModeID));
        newCloseFactor = utils.parseEther("0.355");
      });

      it("CONV2-SETEMCF-0: Should only called by owner", async function () {
        await verifyOnlyOwner(
          controllerV2, //contract
          "_setEModeCloseFactor", // method
          [eModeID, newCloseFactor], //args
          owner, // owner
          user, // non-owner
          "NewEModeCloseFactor", // ownerEvent
          [eModeID, oldCloseFactor, newCloseFactor], // ownerEventArgs
          // ownerChecks
          async () => {
            expect((await controllerV2.eModes(eModeID)).closeFactor).to.eq(
              newCloseFactor
            );
          },
          // nonownerChecks
          async () => {
            expect((await controllerV2.eModes(eModeID)).closeFactor).to.eq(
              oldCloseFactor
            );
          }
        );
      });

      it("CONV2-SETEMCF-1: Should validate emodeID", async function () {
        // emode 0 can not be set via emode
        const minEModeID = utils.parseUnits("1", 0);
        const maxEModeID = (await controllerV2.getEModeLength()).sub(1);

        await verifyEModeIDValidation(
          "_setEModeCloseFactor",
          minEModeID,
          maxEModeID,
          [newCloseFactor]
        );
      });

      it("CONV2-SETEMCF-2: Should validate emode close factor", async function () {
        await verifyEModeCloseFactorValidation(
          "_setEModeCloseFactor",
          [eModeID],
          1
        );
      });
    });

    describe("_setEMode", function () {
      let oldEModeID, newEModeID;

      beforeEach(async function () {
        ({
          controllerV2,
          owner,
          accounts: [user],
          iUSDx,
        } = await loadFixture(fixtureEModeBase));

        oldEModeID = (await controllerV2.marketsV2(iUSDx.address)).eModeID;
        newEModeID = utils.parseUnits("1", 0); // stable coin
      });

      it("CONV2-SETE-0: Should only called by owner", async function () {
        await verifyOnlyOwner(
          controllerV2, //contract
          "_setEMode", // method
          [iUSDx.address, newEModeID, eModeLTV, eModeLiquidationThreshold], //args
          owner, // owner
          user, // non-owner
          "EModeChanged", // ownerEvent
          [iUSDx.address, oldEModeID, newEModeID], // ownerEventArgs
          // ownerChecks
          async () => {
            expect((await controllerV2.marketsV2(iUSDx.address)).eModeID).to.eq(
              newEModeID
            );
          },
          // nonownerChecks
          async () => {
            expect((await controllerV2.marketsV2(iUSDx.address)).eModeID).to.eq(
              oldEModeID
            );
          }
        );
      });

      it("CONV2-SETE-1: Should check the non-listed token", async function () {
        await verifyNonlistediToken(controllerV2, "_setEMode", [
          newEModeID,
          eModeLTV,
          eModeLiquidationThreshold,
        ]);
      });

      it("CONV2-SETE-2: Should validate emodeID", async function () {
        // emode 0 can not be set via emode
        const minEModeID = utils.parseUnits("1", 0);
        const maxEModeID = (await controllerV2.getEModeLength()).sub(1);

        await verifyEModeIDValidation(
          "_setEMode",
          minEModeID,
          maxEModeID,
          [iUSDx.address, eModeLTV, eModeLiquidationThreshold],
          1
        );
      });

      it("CONV2-SETE-3: Should only allow changed from 0 to non-0 emode", async function () {
        await controllerV2._setEMode(
          iUSDx.address,
          newEModeID,
          eModeLTV,
          eModeLiquidationThreshold
        );

        await expect(
          controllerV2._setEMode(
            iUSDx.address,
            newEModeID.add(1),
            eModeLTV,
            eModeLiquidationThreshold
          )
        ).to.be.revertedWith("_setEMode: Has set eMode id!");
      });

      it("CONV2-SETE-4: Should validate emode ltv", async function () {
        // [collateralFactor, emodeLiquidationThreshold]
        const minEModeLTV = (await controllerV2.marketsV2(iUSDx.address))
          .collateralFactorMantissa;
        const maxEModeLTV = eModeLiquidationThreshold;

        await expect(
          controllerV2._setEMode(
            iUSDx.address,
            newEModeID,
            minEModeLTV.sub(1),
            eModeLiquidationThreshold
          )
        ).to.be.revertedWith("_validateEModeLTV: Invalid LTV!");

        await expect(
          controllerV2._setEMode(
            iUSDx.address,
            newEModeID,
            maxEModeLTV.add(1),
            eModeLiquidationThreshold
          )
        ).to.be.revertedWith("_validateEModeLTV: Invalid LTV!");
      });

      it("CONV2-SETE-5: Should validate emode liquidation threshold", async function () {
        // [ltv, 1]
        const minEModeLT = eModeLTV;
        const maxEModeLT = utils.parseEther("1");

        // Unreachable as it will report emodeLTV < minEModeLT
        // await expect(
        //   controllerV2._setEMode(
        //     iUSDx.address,
        //     newEModeID,
        //     eModeLTV,
        //     minEModeLT.sub(1)
        //   )
        // ).to.be.revertedWith(
        //   "_validateLiquidationThreshold: Invalid liquidation threshold!"
        // );

        await expect(
          controllerV2._setEMode(
            iUSDx.address,
            newEModeID,
            eModeLTV,
            maxEModeLT.add(1)
          )
        ).to.be.revertedWith(
          "_validateLiquidationThreshold: Invalid liquidation threshold!"
        );
      });

      it("CONV2-SETE-6: Should set the asset’s emode", async function () {
        await controllerV2._setEMode(
          iUSDx.address,
          newEModeID,
          eModeLTV,
          eModeLiquidationThreshold
        );

        const iUSDxDetails = await controllerV2.marketsV2(iUSDx.address);
        expect(iUSDxDetails.eModeID).to.eq(newEModeID);
        expect(await controllerV2.getEModeLTV(iUSDx.address)).to.eq(eModeLTV);
        expect(
          await controllerV2.getEModeLiquidationThreshold(iUSDx.address)
        ).to.eq(eModeLiquidationThreshold);
      });
    });

    describe("_setEModeLTV", function () {
      let oldEModeLTV, newEModeLTV;

      beforeEach(async function () {
        ({
          controllerV2,
          owner,
          accounts: [user],
          iUSDx,
          iUSDT,
        } = await loadFixture(fixtureEModeBase));

        oldEModeLTV = await controllerV2.getEModeLTV(iUSDT.address);
        newEModeLTV = oldEModeLTV.add(utils.parseEther("0.005"));
      });

      it("CONV2-SETEMLTV-0: Should only called by owner", async function () {
        await verifyOnlyOwner(
          controllerV2, //contract
          "_setEModeLTV", // method
          [iUSDT.address, newEModeLTV], //args
          owner, // owner
          user, // non-owner
          "NewEModeLTV", // ownerEvent
          [iUSDT.address, oldEModeLTV, newEModeLTV], // ownerEventArgs
          // ownerChecks
          async () => {
            expect(await controllerV2.getEModeLTV(iUSDT.address)).to.eq(
              newEModeLTV
            );
          },
          // nonownerChecks
          async () => {
            expect(await controllerV2.getEModeLTV(iUSDT.address)).to.eq(
              oldEModeLTV
            );
          }
        );
      });

      it("CONV2-SETEMLTV-1: Should check the non-listed token", async function () {
        await verifyNonlistediToken(controllerV2, "_setEModeLTV", [
          newEModeLTV,
        ]);
      });

      it("CONV2-SETEMLTV-2: Should validate emode ltv", async function () {
        // [collateralFactor, emodeLiquidationThreshold]
        const minEModeLTV = (await controllerV2.marketsV2(iUSDT.address))
          .collateralFactorMantissa;
        const maxEModeLTV = await controllerV2.getEModeLiquidationThreshold(
          iUSDT.address
        );

        await expect(
          controllerV2._setEModeLTV(iUSDT.address, minEModeLTV.sub(1))
        ).to.be.revertedWith("_validateEModeLTV: Invalid LTV!");

        await expect(
          controllerV2._setEModeLTV(iUSDT.address, maxEModeLTV.add(1))
        ).to.be.revertedWith("_validateEModeLTV: Invalid LTV!");
      });

      it("CONV2-SETEMLTV-3: Should validate iToken emode > 0", async function () {
        await expect(
          controllerV2._setEModeLTV(iUSDx.address, newEModeLTV)
        ).to.be.revertedWith("_setEModeLTV: has not set eMode!");
      });
    });

    describe("_setEModeLiquidationThreshold", function () {
      let oldEModeLT, newEModeLT;

      beforeEach(async function () {
        ({
          controllerV2,
          owner,
          accounts: [user],
          iUSDx,
          iUSDT,
        } = await loadFixture(fixtureEModeBase));

        oldEModeLT = await controllerV2.getEModeLiquidationThreshold(
          iUSDT.address
        );
        newEModeLT = oldEModeLT.add(utils.parseEther("0.005"));
      });

      it("CONV2-SETEMLQDT-0: Should only called by owner", async function () {
        await verifyOnlyOwner(
          controllerV2, //contract
          "_setEModeLiquidationThreshold", // method
          [iUSDT.address, newEModeLT], //args
          owner, // owner
          user, // non-owner
          "NewEModeLiquidationThreshold", // ownerEvent
          [iUSDT.address, oldEModeLT, newEModeLT], // ownerEventArgs
          // ownerChecks
          async () => {
            expect(
              await controllerV2.getEModeLiquidationThreshold(iUSDT.address)
            ).to.eq(newEModeLT);
          },
          // nonownerChecks
          async () => {
            expect(
              await controllerV2.getEModeLiquidationThreshold(iUSDT.address)
            ).to.eq(oldEModeLT);
          }
        );
      });

      it("CONV2-SETEMLQDT-1: Should check the non-listed token", async function () {
        await verifyNonlistediToken(
          controllerV2,
          "_setEModeLiquidationThreshold",
          [newEModeLT]
        );
      });

      it("CONV2-SETEMLQDT-1: Should validate emode liquidation threshold", async function () {
        // [ltv, 1]
        const minEModeLT = await controllerV2.getEModeLTV(iUSDT.address);
        const maxEModeLT = utils.parseEther("1");

        await expect(
          controllerV2._setEModeLiquidationThreshold(
            iUSDT.address,
            minEModeLT.sub(1)
          )
        ).to.be.revertedWith(
          "_validateLiquidationThreshold: Invalid liquidation threshold!"
        );

        await expect(
          controllerV2._setEModeLiquidationThreshold(
            iUSDT.address,
            maxEModeLT.add(1)
          )
        ).to.be.revertedWith(
          "_validateLiquidationThreshold: Invalid liquidation threshold!"
        );
      });

      it("CONV2-SETEMLQDT-1: Should validate iToken emode > 0", async function () {
        await expect(
          controllerV2._setEModeLiquidationThreshold(iUSDx.address, newEModeLT)
        ).to.be.revertedWith(
          "_setEModeLiquidationThreshold: has not set eMode!"
        );
      });
    });
  });

  describe("_setLiquidationThreshold", function () {
    let oldLiquidationThreshold, newLiquidationThreshold;

    beforeEach(async function () {
      ({
        controllerV2,
        owner,
        iUSDx,
        accounts: [user],
      } = await loadFixture(fixtureV2));

      oldLiquidationThreshold = await controllerV2.getLiquidationThreshold(
        iUSDx.address
      );
      newLiquidationThreshold = oldLiquidationThreshold.mul(1001).div(1000);
    });

    it("CONV2-SETEMLQDT-0: Should only called by owner", async function () {
      await verifyOnlyOwner(
        controllerV2, //contract
        "_setLiquidationThreshold", // method
        [iUSDx.address, newLiquidationThreshold], //args
        owner, // owner
        user, // non-owner
        "NewLiquidationThreshold", // ownerEvent
        [iUSDx.address, oldLiquidationThreshold, newLiquidationThreshold], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(
            await controllerV2.getLiquidationThreshold(iUSDx.address)
          ).to.eq(newLiquidationThreshold);
        },
        // nonownerChecks
        async () => {
          expect(
            await controllerV2.getLiquidationThreshold(iUSDx.address)
          ).to.eq(oldLiquidationThreshold);
        }
      );
    });

    it("CONV2-SETEMLQDT-1: Should check the non-listed token", async function () {
      await verifyNonlistediToken(controllerV2, "_setLiquidationThreshold", [
        newLiquidationThreshold,
      ]);
    });

    it("CONV2-SETEMLQDT-2: Should validate liquidation threshold ", async function () {
      // [colllateralFactor, 1]
      const minLiquidationThreshold = (
        await controllerV2.marketsV2(iUSDx.address)
      ).collateralFactorMantissa;
      const maxLiquidationThreshold = utils.parseEther("1");

      await expect(
        controllerV2._setLiquidationThreshold(
          iUSDx.address,
          minLiquidationThreshold.sub(1)
        )
      ).to.be.revertedWith(
        "_validateLiquidationThreshold: Invalid liquidation threshold!"
      );

      await expect(
        controllerV2._setLiquidationThreshold(
          iUSDx.address,
          maxLiquidationThreshold.add(1)
        )
      ).to.be.revertedWith(
        "_validateLiquidationThreshold: Invalid liquidation threshold!"
      );
    });
  });
});
