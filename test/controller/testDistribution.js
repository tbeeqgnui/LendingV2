const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");

const {
  verifyOnlyOwner,
  parseTokenAmount,
  setOraclePrices,
  verifyAllowError,
  rdiv,
  rmul,
  divup,
} = require("../helpers/utils.js");

const {
  loadFixture,
  fixtureDefault,
  increaseBlock,
  getBlock,
  miningAutomatically,
  getiTokenCurrentData,
  increaseTime,
  deployTreasuryAndConfig,
} = require("../helpers/fixtures.js");

const { formatEther } = require("ethers/lib/utils");

async function getBlockBN() {
  return BigNumber.from(await getBlock());
}

const BASE = utils.parseEther("1");
const ZERO = utils.parseEther("0");
const MAX = ethers.constants.MaxUint256;

describe("Controller: Reward Distribution", function () {
  let controller,
    iUSDx,
    iUSDT,
    iMUSX,
    priceOracle,
    owner,
    accounts,
    rewardDistributor;
  let globalBorrowSpeed = utils.parseEther("10000");
  let globalSupplySpeed = utils.parseEther("20000");
  let borrowSpeed0 = utils.parseEther("5000");
  let borrowSpeed1 = utils.parseEther("5000");
  let supplySpeed0 = utils.parseEther("10000");
  let supplySpeed1 = utils.parseEther("10000");
  let user1, user2;
  let account1, account2;
  let amount0, amount1, amount2;

  beforeEach(async function () {
    ({
      controller,
      iUSDx,
      iUSDT,
      iMUSX,
      owner,
      accounts,
      priceOracle,
      rewardDistributor,
    } = await loadFixture(fixtureDefault));

    [user1, user2] = accounts;
    account1 = await user1.getAddress();
    account2 = await user2.getAddress();

    amount0 = await parseTokenAmount(iUSDx, 1000);
    amount1 = await parseTokenAmount(iUSDT, 1000);
    amount2 = await parseTokenAmount(iMUSX, 1000);

    await controller
      .connect(user1)
      .enterMarkets([iUSDx.address, iUSDT.address]);
    await controller
      .connect(user2)
      .enterMarkets([iUSDx.address, iUSDT.address]);

    await iUSDx.connect(user1).mint(account1, amount0);
    await iUSDT.connect(user1).mint(account1, amount1);

    // Now by default it is paused
    await rewardDistributor._unpause(
      [iUSDx.address, iUSDT.address],
      [0, 0],
      [iUSDx.address, iUSDT.address],
      [0, 0]
    );
  });

  async function calcSupplyValue(iToken) {
    return (await iToken.totalSupply())
      .mul(await iToken.exchangeRateStored())
      .div(BASE)
      .mul(await priceOracle.getUnderlyingPrice(iToken.address))
      .mul(await rewardDistributor.distributionFactorMantissa(iToken.address))
      .div(BASE);
  }

  async function calcBorrowValue(iToken) {
    return (await iToken.totalBorrows())
      .mul(await priceOracle.getUnderlyingPrice(iToken.address))
      .mul(await rewardDistributor.distributionFactorMantissa(iToken.address))
      .div(BASE);
  }

  async function verifyTokensDistributionSpeed(
    iTokens,
    borrowSpeeds,
    supplySpeeds
  ) {
    for (let i = 0; i < iTokens.length; i++) {
      const iToken = iTokens[i];
      const expectedSupplySpeed = supplySpeeds[i];
      const expectedBorrowSpeed = borrowSpeeds[i];

      expect(expectedBorrowSpeed).to.equal(
        await rewardDistributor.distributionSpeed(iToken.address)
      );
      expect(expectedSupplySpeed).to.equal(
        await rewardDistributor.distributionSupplySpeed(iToken.address)
      );

      // console.log(
      //   await iToken.symbol(),
      //   ":\tBorrowSpeed:\t",
      //   expectedBorrowSpeed.toString(),
      //   "\tSupplySpeed:\t",
      //   expectedSupplySpeed.toString()
      // );
    }
  }

  describe("Add Recipient", function () {
    it("RWD-ADDRCP-1: Should allow controller to add recipient", async function () {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [controller.address],
      });
      const signer = await ethers.provider.getSigner(controller.address);

      await rewardDistributor
        .connect(signer)
        .callStatic._addRecipient(iUSDT.address, utils.parseEther("1"));

      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [controller.address],
      });
    });

    it("RWD-ADDRCP-2: Should not allow non-controller to add recipient", async function () {
      await expect(
        rewardDistributor._addRecipient(iUSDT.address, utils.parseEther("1"))
      ).to.revertedWith("onlyController: caller is not the controller");
    });
  });

  describe("set distribution speeds", function () {
    it("RWD-DTBSPD-1: Should only allow owner to set distribution speeds", async function () {
      await verifyOnlyOwner(
        rewardDistributor, //contract
        "_setDistributionSpeeds", // method
        [
          [iUSDx.address, iUSDT.address],
          [borrowSpeed0, borrowSpeed1],
          [iUSDx.address, iUSDT.address],
          [supplySpeed0, supplySpeed1],
        ], //args
        owner, // owner
        accounts[0], // non-owner
        "GlobalDistributionSpeedsUpdated", // ownerEvent
        [globalBorrowSpeed, globalSupplySpeed], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(await rewardDistributor.globalDistributionSpeed()).to.equal(
            globalBorrowSpeed
          );
          expect(
            await rewardDistributor.globalDistributionSupplySpeed()
          ).to.equal(globalSupplySpeed);

          await verifyTokensDistributionSpeed(
            [iUSDx, iUSDT, iMUSX],
            [borrowSpeed0, borrowSpeed1, 0],
            [supplySpeed0, supplySpeed1, 0]
          );
        },
        // nonownerChecks
        async () => {
          expect(await rewardDistributor.globalDistributionSpeed()).to.equal(0);
          expect(
            await rewardDistributor.globalDistributionSupplySpeed()
          ).to.equal(0);
        }
      );
    });

    it("RWD-DTBSPD-2: _setDistributionSpeeds Check address param", async function () {
      await expect(
        rewardDistributor._setDistributionSpeeds(
          [controller.address, iUSDT.address],
          [borrowSpeed0, borrowSpeed1],
          [],
          []
        )
      ).to.be.revertedWith("Token has not been listed");

      await expect(
        rewardDistributor._setDistributionSpeeds(
          [ethers.constants.AddressZero, iUSDT.address],
          [borrowSpeed0, borrowSpeed1],
          [],
          []
        )
      ).to.be.revertedWith("Token has not been listed");
    });
  });

  describe("set distribution supply and borrow speeds", function () {
    it("RWD-DTB-SPLBOR-1: Should only allow owner to set distribution supply and borrow speeds", async function () {
      await verifyOnlyOwner(
        rewardDistributor, //contract
        "_setDistributionSupplySpeeds", // method
        [
          [iUSDx.address, iUSDT.address],
          [supplySpeed0, supplySpeed1],
        ], //args
        owner, // owner
        accounts[0], // non-owner
        "GlobalDistributionSpeedsUpdated", // ownerEvent
        [0, globalSupplySpeed], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(await rewardDistributor.globalDistributionSpeed()).to.equal(0);
          expect(
            await rewardDistributor.globalDistributionSupplySpeed()
          ).to.equal(globalSupplySpeed);

          await verifyTokensDistributionSpeed(
            [iUSDx, iUSDT, iMUSX],
            [0, 0, 0],
            [supplySpeed0, supplySpeed1, 0]
          );
        },
        // nonownerChecks
        async () => {
          expect(await rewardDistributor.globalDistributionSpeed()).to.equal(0);
          expect(
            await rewardDistributor.globalDistributionSupplySpeed()
          ).to.equal(0);
        }
      );

      await verifyOnlyOwner(
        rewardDistributor, //contract
        "_setDistributionBorrowSpeeds", // method
        [
          [iUSDx.address, iUSDT.address],
          [borrowSpeed0, borrowSpeed1],
        ], //args
        owner, // owner
        accounts[0], // non-owner
        "GlobalDistributionSpeedsUpdated", // ownerEvent
        [globalBorrowSpeed, globalSupplySpeed], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(await rewardDistributor.globalDistributionSpeed()).to.equal(
            globalBorrowSpeed
          );
          expect(
            await rewardDistributor.globalDistributionSupplySpeed()
          ).to.equal(globalSupplySpeed);

          await verifyTokensDistributionSpeed(
            [iUSDx, iUSDT, iMUSX],
            [borrowSpeed0, borrowSpeed1, 0],
            [supplySpeed0, supplySpeed1, 0]
          );
        },
        // nonownerChecks
        async () => {
          expect(await rewardDistributor.globalDistributionSpeed()).to.equal(0);
          expect(
            await rewardDistributor.globalDistributionSupplySpeed()
          ).to.equal(globalSupplySpeed);
        }
      );
    });

    it("RWD-DTB-SPLBOR-2: set distribution supply and borrow speeds Check address param", async function () {
      await expect(
        rewardDistributor._setDistributionSupplySpeeds(
          [controller.address, iUSDT.address],
          [supplySpeed0, supplySpeed1]
        )
      ).to.be.revertedWith("Token has not been listed");

      await expect(
        rewardDistributor._setDistributionSupplySpeeds(
          [ethers.constants.AddressZero, iUSDT.address],
          [supplySpeed0, supplySpeed1]
        )
      ).to.be.revertedWith("Token has not been listed");

      await expect(
        rewardDistributor._setDistributionBorrowSpeeds(
          [controller.address, iUSDT.address],
          [borrowSpeed0, borrowSpeed1]
        )
      ).to.be.revertedWith("Token has not been listed");

      await expect(
        rewardDistributor._setDistributionBorrowSpeeds(
          [ethers.constants.AddressZero, iUSDT.address],
          [borrowSpeed0, borrowSpeed1]
        )
      ).to.be.revertedWith("Token has not been listed");
    });
  });

  // Distribution factor is not used any more
  describe.skip("Distribution Factor", function () {
    let distributionFactor0 = utils.parseEther("1");
    let distributionFactor1 = utils.parseEther("1.5");

    it("Should only allow owner to set distribution factor", async function () {
      let oldDistributionFactor =
        await rewardDistributor.distributionFactorMantissa(iUSDx.address);
      let newDistributionFactor = utils.parseEther("2");

      await verifyOnlyOwner(
        rewardDistributor, //contract
        "_setDistributionFactors", // method
        [[iUSDx.address], [newDistributionFactor]], //args
        owner, // owner
        accounts[0], // non-owner
        "NewDistributionFactor", // ownerEvent
        [iUSDx.address, oldDistributionFactor, newDistributionFactor], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(
            await rewardDistributor.distributionFactorMantissa(iUSDx.address)
          ).to.equal(utils.parseEther("2"));
        },
        // nonownerChecks
        async () => {
          expect(
            await rewardDistributor.distributionFactorMantissa(iUSDx.address)
          ).to.equal(utils.parseEther("1"));
        }
      );
    });

    it("Should update distribution speed after update distribution factor ", async function () {
      await iUSDx.connect(user1).mint(account1, amount0);
      await iUSDT.connect(user1).mint(account1, amount1);

      await iUSDx.connect(user1).borrow(amount0.div(3));
      await iUSDT.connect(user1).borrow(amount1.div(3));
      await iMUSX.connect(user1).borrow(amount2.div(3));

      await rewardDistributor._setGlobalDistributionSpeeds(
        globalBorrowSpeed,
        globalSupplySpeed
      );

      // Now iUSDx has 200% weight, iUSDT only has 100%
      let distributionFactor0 = utils.parseEther("2");
      let distributionFactor1 = utils.parseEther("1");
      await rewardDistributor._setDistributionFactors(
        [iUSDx.address, iUSDT.address],
        [distributionFactor0, distributionFactor1]
      );

      await verifyTokensDistributionSpeed([iUSDx, iUSDT, iMUSX]);
    });

    it("Should fail if the iToken has not been listed", async function () {
      await expect(
        rewardDistributor._setDistributionFactors(
          [controller.address, iUSDT.address],
          [distributionFactor0, distributionFactor1]
        )
      ).to.be.revertedWith("Token has not been listed");
    });

    it("Should fail if the iTokens and distribution factors has different length", async function () {
      await expect(
        rewardDistributor._setDistributionFactors(
          [iUSDx.address, iUSDT.address],
          [distributionFactor0, distributionFactor1, distributionFactor1]
        )
      ).to.be.revertedWith(
        "Length of _iTokens and _distributionFactors mismatch"
      );
    });

    it("Should fail if reward distribution is paused", async function () {
      await rewardDistributor._pause();

      await expect(
        rewardDistributor._setDistributionFactors(
          [iUSDx.address, iUSDT.address],
          [distributionFactor0, distributionFactor1]
        )
      ).to.be.revertedWith("Can not update distribution factors when paused");
    });
  });

  describe("Reward Token", function () {
    it("RWD-TKN-1: Should only allow owner to set reward token", async function () {
      const Token = await ethers.getContractFactory("Token");
      const DF = await Token.deploy("DF", "DF", 18);
      await DF.deployed();

      let oldRewardToken = await rewardDistributor.rewardToken();
      let newRewardToken = DF.address;

      await verifyOnlyOwner(
        rewardDistributor, //contract
        "_setRewardToken", // method
        [newRewardToken], //args
        owner, // owner
        accounts[0], // non-owner
        "NewRewardToken", // ownerEvent
        [oldRewardToken, newRewardToken], // ownerEventArgs
        // ownerChecks
        async () => {
          expect(await rewardDistributor.rewardToken()).to.equal(DF.address);
        },
        // nonownerChecks
        async () => {
          expect(await rewardDistributor.rewardToken()).to.equal(
            ethers.constants.AddressZero
          );
        }
      );
    });

    it("RWD-TKN-2: Should not update reward token with invalid address", async function () {
      let oldRewardToken = await rewardDistributor.rewardToken();

      await expect(
        rewardDistributor._setRewardToken(oldRewardToken)
      ).to.be.revertedWith("Reward token address invalid");

      await expect(
        rewardDistributor._setRewardToken(ethers.constants.AddressZero)
      ).to.be.revertedWith("Reward token address invalid");
    });
  });

  // Distribution speed is directly set by owner
  describe.skip("Update Distribution Speed", function () {
    it("Should fail if called by a contract", async function () {
      const Caller = await ethers.getContractFactory(
        "UpdateDistributionSpeedCaller"
      );
      const caller = await Caller.deploy();
      await caller.deployed();

      await expect(caller.call(rewardDistributor.address)).to.revertedWith(
        "only EOA can update speeds"
      );
    });

    let borrowAmounts = [
      [0, 100, 30],
      [20, 20, 20],
      [20, 0, 0],
      [20, 0, 20],
      [0, 0, 20],
    ];

    let underlyingPrices = [
      [1.0, 1.0, 1.0],
      [1.0, 2.0, 3.0],
      [0.0, 0.0, 0.0],
    ];

    borrowAmounts.forEach(async function (borrowAmount) {
      underlyingPrices.forEach(async function (underlyingPrice) {
        it(`With borrowAmounts: ${borrowAmount}, underlyingPrice: ${underlyingPrice}`, async function () {
          await rewardDistributor._setGlobalDistributionSpeeds(
            globalBorrowSpeed,
            globalSupplySpeed
          );

          if (borrowAmount[0] > 0)
            await iUSDx
              .connect(user1)
              .borrow(await parseTokenAmount(iUSDx, borrowAmount[0]));
          if (borrowAmount[1] > 0)
            await iUSDT
              .connect(user1)
              .borrow(await parseTokenAmount(iUSDT, borrowAmount[1]));
          if (borrowAmount[2] > 0)
            await iMUSX
              .connect(user1)
              .borrow(await parseTokenAmount(iMUSX, borrowAmount[2]));

          // Pause will return all 0
          if (underlyingPrice[0] > 0) {
            await setOraclePrices(
              priceOracle,
              [iUSDx, iUSDT, iMUSX],
              underlyingPrice
            );
          } else {
            await priceOracle._setPaused(true);
          }

          await rewardDistributor.updateDistributionSpeed();

          await verifyTokensDistributionSpeed([iUSDx, iUSDT, iMUSX]);
        });
      });
    });
  });
});

describe("Update Distribution State", function () {
  let controller, iUSDx, iUSDT, priceOracle, owner, accounts, rewardDistributor;
  let borrowSpeed0 = utils.parseEther("5000");
  let borrowSpeed1 = utils.parseEther("5000");
  let supplySpeed0 = utils.parseEther("10000");
  let supplySpeed1 = utils.parseEther("10000");
  let user1, user2;
  let account1, account2;
  let amount0, amount1;

  before(async function () {
    ({
      controller,
      iUSDx,
      iUSDT,
      owner,
      accounts,
      priceOracle,
      rewardDistributor,
    } = await loadFixture(fixtureDefault));

    [user1, user2] = accounts;
    account1 = await user1.getAddress();
    account2 = await user2.getAddress();

    amount0 = await parseTokenAmount(iUSDx, 1000);
    amount1 = await parseTokenAmount(iUSDT, 1000);

    await controller
      .connect(user1)
      .enterMarkets([iUSDx.address, iUSDT.address]);
    await controller
      .connect(user2)
      .enterMarkets([iUSDx.address, iUSDT.address]);

    await iUSDx.connect(user1).mint(account1, amount0);
    await iUSDx.connect(user2).mint(account2, amount0);

    await iUSDT.connect(user1).mint(account1, amount1);
    await iUSDT.connect(user2).mint(account2, amount1);

    await iUSDx.connect(user1).borrow(amount0.div(2));
    await iUSDx.connect(user2).borrow(amount0.div(2));

    await iUSDT.connect(user1).borrow(amount1.div(2));
    await iUSDT.connect(user2).borrow(amount1.div(2));

    await rewardDistributor._unpause(
      [iUSDx.address, iUSDT.address],
      [borrowSpeed0, borrowSpeed1],
      [iUSDx.address, iUSDT.address],
      [supplySpeed0, supplySpeed1]
    );
  });

  let actions = [
    {
      description: "No action at all, only forward blocks",
      setup: async function () {
        this.func = "";
        this.sender = user1;
        this.iToken = iUSDx;
        this.users = [user1, user2];
        this.iTokens = [iUSDx, iUSDT];
        this.args = [
          await user1.getAddress(),
          await parseTokenAmount(iUSDx, 100),
        ];
      },
    },
    {
      description: "Mint 100 iUSDx",
      setup: async function () {
        this.func = "mint";
        this.sender = user1;
        this.iToken = iUSDx;
        this.users = [user1, user2];
        this.iTokens = [iUSDx, iUSDT];
        this.args = [
          await user1.getAddress(),
          await parseTokenAmount(iUSDx, 100),
        ];
      },
    },
    {
      description: "Redeem 50 iUSDx",
      setup: async function () {
        this.func = "redeem";
        this.sender = user1;
        this.iToken = iUSDx;
        this.users = [user1, user2];
        this.iTokens = [iUSDx, iUSDT];
        this.args = [
          await user1.getAddress(),
          await parseTokenAmount(iUSDx, 50),
        ];
      },
    },
    {
      description: "RedeemUnderlying 50 iUSDx",
      setup: async function () {
        this.func = "redeemUnderlying";
        this.sender = user1;
        this.iToken = iUSDx;
        this.users = [user1, user2];
        this.iTokens = [iUSDx, iUSDT];
        this.args = [
          await user1.getAddress(),
          await parseTokenAmount(iUSDx, 50),
        ];
      },
    },
    {
      description: "Borrow 20 iUSDx",
      setup: async function () {
        this.func = "borrow";
        this.sender = user1;
        this.iToken = iUSDx;
        this.users = [user1, user2];
        this.iTokens = [iUSDx, iUSDT];
        this.args = [await parseTokenAmount(iUSDx, 20)];
      },
    },
    {
      description: "RepayBorrow 100 iUSDx",
      setup: async function () {
        this.func = "repayBorrow";
        this.sender = user1;
        this.iToken = iUSDx;
        this.users = [user1, user2];
        this.iTokens = [iUSDx, iUSDT];
        this.args = [await parseTokenAmount(iUSDx, 100)];
      },
    },
    {
      description: "Transfer 100 iUSDx",
      setup: async function () {
        this.func = "transfer";
        this.sender = user1;
        this.iToken = iUSDx;
        this.users = [user1, user2];
        this.iTokens = [iUSDx, iUSDT];
        this.args = [
          await user2.getAddress(),
          await parseTokenAmount(iUSDx, 100),
        ];
      },
    },
    {
      description: "liquidateBorrow 10 iUSDx, and seize iUSDT",
      setup: async function () {
        this.func = "liquidateBorrow";
        this.sender = user1;
        this.iToken = iUSDx;
        this.users = [user1, user2];
        this.iTokens = [iUSDx, iUSDT];
        this.args = [
          await user2.getAddress(),
          await parseTokenAmount(iUSDx, 10),
          iUSDT.address,
        ];

        // Set collateral factor to 0, and set liquidation threshold to 0, so it can be liquidated.
        await controller._setCollateralFactor(iUSDx.address, 0);
      },
    },
  ];

  async function executeAction(action) {
    const { func, sender, iToken, args } = action;

    if (func === "") {
      // Update interest to update the state
      await iToken.connect(sender).updateInterest();
    } else {
      await iToken.connect(sender)[func](...args);
    }
  }

  async function getDistributionState(iToken, is_borrow) {
    let state = {};
    if (is_borrow) {
      ({ index: state.index, block: state.block } =
        await rewardDistributor.distributionBorrowState(iToken.address));

      state.speed = await rewardDistributor.distributionSpeed(iToken.address);
    } else {
      ({ index: state.index, block: state.block } =
        await rewardDistributor.distributionSupplyState(iToken.address));

      state.speed = await rewardDistributor.distributionSupplySpeed(
        iToken.address
      );
    }

    return state;
  }

  async function getSupplyState(iToken) {
    let state = await getDistributionState(iToken, false);
    state.totalSupply = await iToken.totalSupply();

    return state;
  }

  async function getBorrowState(iToken, blockDelta) {
    let state = await getDistributionState(iToken, true);

    const data = await getiTokenCurrentData(iToken, blockDelta);

    state.totalBorrows = data.totalBorrows;
    state.borrowIndex = data.borrowIndex;

    return state;
  }

  async function getAccountTokenState(account, iToken, blockDelta) {
    let state = {};

    state.balance = await iToken.balanceOf(account);

    let { 0: principal, 1: interestIndex } = await iToken.borrowSnapshot(
      account
    );

    // Calculate the borrow balance in advance
    state.borrowBalance = divup(
      principal.mul(
        (await getiTokenCurrentData(iToken, blockDelta)).borrowIndex
      ),
      interestIndex
    );

    state.supplierIndex = await rewardDistributor.distributionSupplierIndex(
      iToken.address,
      account
    );
    state.borrowerIndex = await rewardDistributor.distributionBorrowerIndex(
      iToken.address,
      account
    );

    return state;
  }

  async function getAccountState(account, iTokens, blockDelta) {
    let state = {};

    state.iTokens = {};
    for (iToken of iTokens) {
      state.iTokens[iToken.address] = await getAccountTokenState(
        account,
        iToken,
        blockDelta
      );
    }

    state.reward = await rewardDistributor.reward(account);

    return state;
  }

  async function getState(iTokens, accounts, blockDelta) {
    let state = {};

    state.iTokens = {};
    state.accounts = {};
    for (iToken of iTokens) {
      let address = iToken.address;
      let supply = await getSupplyState(iToken);
      let borrow = await getBorrowState(iToken, blockDelta);

      state.iTokens[address] = { supply: supply, borrow: borrow };
    }

    for (account of accounts) {
      state.accounts[account] = await getAccountState(
        account,
        iTokens,
        blockDelta
      );
    }

    // console.log(JSON.stringify(state, null, 2));
    return state;
  }

  async function calcExpectedMintAndRedeem(preState, action) {
    let expected = preState;
    let currentBlock = BigNumber.from(await getBlock());

    // Mint/Redeem only change the state of current targeting iToken
    const address = action.iToken.address;

    let supply = expected.iTokens[address].supply;
    let blockDelta = currentBlock.sub(supply.block);

    supply.block = currentBlock;
    supply.index = supply.index.add(
      rdiv(supply.speed.mul(blockDelta), supply.totalSupply)
    );

    // Mint/Redeem only change the state of recipient which is args[0]
    const account = action.args[0];

    const indexDelta = expected.iTokens[address].supply.index.sub(
      expected.accounts[account].iTokens[address].supplierIndex
    );

    expected.accounts[account].iTokens[address].supplierIndex =
      expected.iTokens[address].supply.index;

    expected.accounts[account].reward = expected.accounts[account].reward.add(
      rmul(indexDelta, expected.accounts[account].iTokens[address].balance)
    );

    // console.log(JSON.stringify(expected, null, 2));
    return expected;
  }

  async function calcExpectedBorrowAndRepay(preState, action) {
    let expected = preState;
    let currentBlock = BigNumber.from(await getBlock());

    // Borrow/Repay only change the state of current targeting iToken
    const address = action.iToken.address;

    let borrow = expected.iTokens[address].borrow;
    let blockDelta = currentBlock.sub(borrow.block);

    borrow.block = currentBlock;
    borrow.index = borrow.index.add(
      rdiv(
        borrow.speed.mul(blockDelta),
        rdiv(borrow.totalBorrows, borrow.borrowIndex)
      )
    );

    // Borrow/Repay only change the state of msg.sender
    const account = await action.sender.getAddress();

    const indexDelta = expected.iTokens[address].borrow.index.sub(
      expected.accounts[account].iTokens[address].borrowerIndex
    );

    expected.accounts[account].iTokens[address].borrowerIndex =
      expected.iTokens[address].borrow.index;

    expected.accounts[account].reward = expected.accounts[account].reward.add(
      rmul(
        indexDelta,
        rdiv(
          expected.accounts[account].iTokens[address].borrowBalance,
          borrow.borrowIndex
        )
      )
    );

    // console.log(JSON.stringify(expected, null, 2));
    return expected;
  }

  async function calcExpectedTransfer(preState, action) {
    let expected = preState;
    let currentBlock = BigNumber.from(await getBlock());

    // Transfer only change the state of current targeting iToken
    const address = action.iToken.address;

    let supply = expected.iTokens[address].supply;
    let blockDelta = currentBlock.sub(supply.block);

    supply.block = currentBlock;
    supply.index = supply.index.add(
      rdiv(supply.speed.mul(blockDelta), supply.totalSupply)
    );

    // Transfer will change the state of msg.sender and recipient args[0]
    const accounts = [await action.sender.getAddress(), action.args[0]];

    for (account of accounts) {
      const indexDelta = expected.iTokens[address].supply.index.sub(
        expected.accounts[account].iTokens[address].supplierIndex
      );

      expected.accounts[account].iTokens[address].supplierIndex =
        expected.iTokens[address].supply.index;

      expected.accounts[account].reward = expected.accounts[account].reward.add(
        rmul(indexDelta, expected.accounts[account].iTokens[address].balance)
      );
    }

    // console.log(JSON.stringify(expected, null, 2));
    return expected;
  }

  async function calcExpectedLiquidateBorrow(preState, action) {
    let expected = preState;
    let currentBlock = BigNumber.from(await getBlock());

    // liquidate borrow will change the borrow state of current targeting iToken
    const address = action.iToken.address;

    let borrow = expected.iTokens[address].borrow;
    let blockDelta = currentBlock.sub(borrow.block);

    borrow.block = currentBlock;
    borrow.index = borrow.index.add(
      rdiv(
        borrow.speed.mul(blockDelta),
        rdiv(borrow.totalBorrows, borrow.borrowIndex)
      )
    );

    // liquidate borrow will change the supply state of seized iToken
    const sAddress = action.args[2];

    let supply = expected.iTokens[sAddress].supply;
    blockDelta = currentBlock.sub(supply.block);

    supply.block = currentBlock;
    supply.index = supply.index.add(
      rdiv(supply.speed.mul(blockDelta), supply.totalSupply)
    );

    const liquidator = await action.sender.getAddress();
    const borrower = action.args[0];

    // liquidate borrow will change supply the state of msg.sender
    let indexDelta = expected.iTokens[sAddress].supply.index.sub(
      expected.accounts[liquidator].iTokens[sAddress].supplierIndex
    );

    expected.accounts[liquidator].iTokens[sAddress].supplierIndex =
      expected.iTokens[sAddress].supply.index;

    expected.accounts[liquidator].reward = expected.accounts[
      liquidator
    ].reward.add(
      rmul(indexDelta, expected.accounts[liquidator].iTokens[sAddress].balance)
    );

    // liquidate borrow will change supply the state of Borrower
    indexDelta = expected.iTokens[sAddress].supply.index.sub(
      expected.accounts[borrower].iTokens[sAddress].supplierIndex
    );

    expected.accounts[borrower].iTokens[sAddress].supplierIndex =
      expected.iTokens[sAddress].supply.index;

    expected.accounts[borrower].reward = expected.accounts[borrower].reward.add(
      rmul(indexDelta, expected.accounts[borrower].iTokens[sAddress].balance)
    );

    // liquidate borrow will change borrower's args[0] borrow state of current iToken
    indexDelta = expected.iTokens[address].borrow.index.sub(
      expected.accounts[borrower].iTokens[address].borrowerIndex
    );

    expected.accounts[borrower].iTokens[address].borrowerIndex =
      expected.iTokens[address].borrow.index;

    expected.accounts[borrower].reward = expected.accounts[borrower].reward.add(
      rmul(
        indexDelta,
        rdiv(
          expected.accounts[borrower].iTokens[address].borrowBalance,
          borrow.borrowIndex
        )
      )
    );

    // console.log(indexDelta);

    // console.log(JSON.stringify(expected, null, 2));
    return expected;
  }

  async function calcExpected(preState, action) {
    let expected;

    switch (action.func) {
      case "mint":
      case "redeem":
      case "redeemUnderlying":
        expected = await calcExpectedMintAndRedeem(preState, action);
        break;

      case "borrow":
      case "repayBorrow":
        expected = await calcExpectedBorrowAndRepay(preState, action);
        break;

      case "transfer":
        expected = await calcExpectedTransfer(preState, action);
        break;

      case "liquidateBorrow":
        expected = await calcExpectedLiquidateBorrow(preState, action);
        break;

      default:
        expected = preState;
        break;
    }

    return expected;
  }

  function verify(expected, postState) {
    // Skip the check of the total supply/borrow here
    for (address in expected.iTokens) {
      delete expected.iTokens[address].supply.totalSupply;
      delete expected.iTokens[address].borrow.totalBorrows;
      delete postState.iTokens[address].supply.totalSupply;
      delete postState.iTokens[address].borrow.totalBorrows;
    }

    // Skip the check of the balance/borrowBalance here
    for (account in expected.accounts) {
      for (address in expected.accounts[account].iTokens) {
        delete expected.accounts[account].iTokens[address].balance;
        delete expected.accounts[account].iTokens[address].borrowBalance;
        delete postState.accounts[account].iTokens[address].balance;
        delete postState.accounts[account].iTokens[address].borrowBalance;
      }
    }

    // Final deep check here
    expect(expected).to.deep.equal(postState);
  }

  actions.forEach(function (action) {
    it(`Checking state after ${action.description}`, async function () {
      await action.setup();

      const { iTokens, users } = action;

      const accounts = await Promise.all(
        users.map(async (a) => await a.getAddress())
      );

      let blockDelta = 100;

      const preState = await getState(iTokens, accounts, blockDelta);

      // The action itself will forward 1 block
      await increaseBlock(blockDelta - 1);
      await executeAction(action);

      const postState = await getState(iTokens, accounts, 0);

      let expected = await calcExpected(preState, action);
      verify(expected, postState);
    });
  });

  it("RWD-UP-STAT-1: Should fail when try to update distribution state of non-listed token", async function () {
    await expect(
      rewardDistributor.updateDistributionState(controller.address, false)
    ).to.be.revertedWith("Token has not been listed");

    await expect(
      rewardDistributor.updateDistributionState(controller.address, true)
    ).to.be.revertedWith("Token has not been listed");
  });

  it("RWD-UP-STAT-2: Should fail when try to update distribution state of zero address token", async function () {
    await expect(
      rewardDistributor.updateDistributionState(
        ethers.constants.AddressZero,
        false
      )
    ).to.be.revertedWith("Token has not been listed");

    await expect(
      rewardDistributor.updateDistributionState(
        ethers.constants.AddressZero,
        true
      )
    ).to.be.revertedWith("Token has not been listed");
  });
});

describe("Claiming reward", async function () {
  let controller, iUSDx, iUSDT, priceOracle, owner, accounts, rewardDistributor;
  let globalBorrowSpeed = utils.parseEther("10000");
  let globalSupplySpeed = utils.parseEther("20000");
  let borrowSpeed0 = utils.parseEther("5000");
  let borrowSpeed1 = utils.parseEther("5000");
  let supplySpeed0 = utils.parseEther("10000");
  let supplySpeed1 = utils.parseEther("10000");
  let user1, user2, user3;
  let account1, account2, account3;
  let amount0, amount1;
  let DF;
  let startBlock;

  beforeEach(async function () {
    ({
      controller,
      iUSDx,
      iUSDT,
      owner,
      accounts,
      priceOracle,
      rewardDistributor,
    } = await loadFixture(fixtureDefault));

    [user1, user2, user3] = accounts;
    account1 = await user1.getAddress();
    account2 = await user2.getAddress();
    account3 = await user3.getAddress();

    amount0 = await parseTokenAmount(iUSDx, 1000);
    amount1 = await parseTokenAmount(iUSDT, 1000);

    await controller
      .connect(user1)
      .enterMarkets([iUSDx.address, iUSDT.address]);
    await controller
      .connect(user2)
      .enterMarkets([iUSDx.address, iUSDT.address]);

    const Token = await ethers.getContractFactory("Token");
    DF = await Token.deploy("DF", "DF", 18);
    await DF.deployed();

    const treasury = await deployTreasuryAndConfig(
      DF.address,
      rewardDistributor
    );

    // Prepare reward
    await DF.mint(treasury.address, parseTokenAmount(DF, "10000000000"));
    await rewardDistributor._setRewardToken(DF.address);

    // await rewardDistributor._unpause(
    //   [iUSDx.address, iUSDT.address],
    //   [0, borrowSpeed1],
    //   [iUSDx.address, iUSDT.address],
    //   [supplySpeed0, supplySpeed1]
    // );
  });

  it("Should be able to claim reward", async function () {
    // Only 1 user mint/borrow
    await iUSDx.connect(user1).mint(account1, amount0);
    await iUSDx.connect(user1).borrow(amount0.div(2));

    // _unpause at the last step for easy calculation
    await rewardDistributor._unpause(
      [iUSDx.address, iUSDT.address],
      [0, borrowSpeed1],
      [iUSDx.address, iUSDT.address],
      [supplySpeed0, supplySpeed1]
    );

    await increaseBlock(99);

    // _unpause should update both supply and borrow state
    startBlock = (
      await rewardDistributor.distributionSupplyState(iUSDx.address)
    ).block;

    let currentBlock = (await getBlockBN()).add(1);
    let blockDelta = currentBlock.sub(startBlock);

    // user1 should be able to claim all on both supply and borrow
    let reward = (await rewardDistributor.distributionSpeed(iUSDx.address))
      .mul(blockDelta)
      .add(
        (await rewardDistributor.distributionSupplySpeed(iUSDx.address)).mul(
          blockDelta
        )
      );

    await expect(() =>
      rewardDistributor.claimReward([account1], [iUSDx.address])
    ).to.changeTokenBalance(DF, user1, reward);

    // Should claim all reward
    expect(await rewardDistributor.reward(account1)).to.equal(0);
  });

  it("Should not be able to claim reward with non-listed token", async function () {
    await expect(
      rewardDistributor.claimReward([account1], [DF.address])
    ).to.revertedWith("Token has not been listed");
  });

  it("Should be able to claim all reward", async function () {
    await iUSDx.connect(user1).mint(account1, amount0);
    await iUSDx.connect(user2).mint(account2, amount0);

    await iUSDT.connect(user1).mint(account1, amount1);
    await iUSDT.connect(user2).mint(account2, amount1);

    await iUSDx.connect(user1).borrow(amount0.div(2));
    await iUSDx.connect(user2).borrow(amount0.div(2));

    await iUSDT.connect(user1).borrow(amount1.div(2));
    await iUSDT.connect(user2).borrow(amount1.div(2));

    // Refresh the speed and token State at the last step for easy calculation
    await rewardDistributor._unpause(
      [iUSDx.address, iUSDT.address],
      [0, borrowSpeed1],
      [iUSDx.address, iUSDT.address],
      [supplySpeed0, supplySpeed1]
    );

    // _unpause should update both supply and borrow state to the same block
    startBlock = (
      await rewardDistributor.distributionSupplyState(iUSDT.address)
    ).block;

    await increaseBlock(99);

    let balanceBefore = (await DF.balanceOf(account1)).add(
      await DF.balanceOf(account2)
    );
    await rewardDistributor.claimAllReward([account1, account2, account3]);
    let balanceAfter = (await DF.balanceOf(account1)).add(
      await DF.balanceOf(account2)
    );

    let currentBlock = await getBlockBN();
    let blockDelta = currentBlock.sub(startBlock);

    // 2 users should be able to claim all on both supply and borrow
    let reward = (await rewardDistributor.globalDistributionSpeed())
      .mul(blockDelta)
      .add(
        (await rewardDistributor.globalDistributionSupplySpeed()).mul(
          blockDelta
        )
      );

    // console.log(
    //   (await rewardDistributor.distributionBorrowState(iUSDx.address)).map((i) =>
    //     i.toString()
    //   )
    // );

    // Borrow will accured interest, the 2nd borrow will not match the 1st one
    // with the same amount, therefore there could be some rounding errors
    verifyAllowError(balanceAfter.sub(balanceBefore), reward, 0.000001);
    // expect(balanceAfter.sub(balanceBefore)).to.equal(reward);

    // Should claim all reward
    expect(await rewardDistributor.reward(account1)).to.equal(0);
    expect(await rewardDistributor.reward(account2)).to.equal(0);
  });

  it("RWD-USE-RWD-1: Should fail when try to update claim non-listed token", async function () {
    await expect(
      rewardDistributor.claimReward([account1], [controller.address])
    ).to.be.revertedWith("Token has not been listed");

    await expect(
      rewardDistributor.updateReward(controller.address, account1, true)
    ).to.be.revertedWith("Token has not been listed");

    await expect(
      rewardDistributor.updateReward(
        ethers.constants.AddressZero,
        account1,
        true
      )
    ).to.be.revertedWith("Token has not been listed");
  });

  it("RWD-USE-RWD-2: Should fail when try to update reward distribution state for the zero account", async function () {
    await expect(
      rewardDistributor.updateReward(
        iUSDT.address,
        ethers.constants.AddressZero,
        true
      )
    ).to.be.revertedWith("Invalid account address!");

    await expect(
      rewardDistributor.claimReward(
        [ethers.constants.AddressZero],
        [iUSDT.address]
      )
    ).to.be.revertedWith("Invalid account address!");
  });

  it("RWD-USE-RWDS-1: Should fail when try to update claim non-listed token", async function () {
    await expect(
      rewardDistributor.claimRewards(
        [account1],
        [controller.address],
        [iUSDT.address]
      )
    ).to.be.revertedWith("Token has not been listed");

    await expect(
      rewardDistributor.claimRewards(
        [account1],
        [iUSDT.address],
        [ethers.constants.AddressZero]
      )
    ).to.be.revertedWith("Token has not been listed");
  });

  it("RWD-USE-RWDS-2: Should fail when try to update reward distribution state for the zero account", async function () {
    await expect(
      rewardDistributor.claimRewards(
        [ethers.constants.AddressZero],
        [iUSDT.address],
        [iUSDT.address]
      )
    ).to.be.revertedWith("Invalid account address!");
  });

  it("RWD-UP-RWDB-1: Should fail when try to batch update reward distribution state non-listed token", async function () {
    await expect(
      rewardDistributor.updateRewardBatch(
        [account1],
        [iUSDx.address, controller.address]
      )
    ).to.be.revertedWith("Token has not been listed");

    await expect(
      rewardDistributor.updateRewardBatch(
        [account1],
        [iUSDx.address, ethers.constants.AddressZero]
      )
    ).to.be.revertedWith("Token has not been listed");
  });

  it("RWD-UP-RWDB-2: Should fail when try to batch update reward distribution state for the zero account", async function () {
    await expect(
      rewardDistributor.updateRewardBatch(
        [ethers.constants.AddressZero],
        [iUSDx.address, iUSDT.address]
      )
    ).to.be.revertedWith("Invalid account address!");
  });
});

describe("Pause/Unpause", async function () {
  let controller, iUSDx, iUSDT, priceOracle, owner, accounts, rewardDistributor;
  let globalBorrowSpeed = utils.parseEther("10000");
  let globalSupplySpeed = utils.parseEther("20000");
  let borrowSpeed0 = utils.parseEther("5000");
  let borrowSpeed1 = utils.parseEther("5000");
  let supplySpeed0 = utils.parseEther("10000");
  let supplySpeed1 = utils.parseEther("10000");
  let user1, user2, user3;
  let account1, account2, account3;
  let amount0, amount1;
  let DF;
  let startBlock;

  before(async function () {
    ({
      controller,
      iUSDx,
      iUSDT,
      owner,
      accounts,
      priceOracle,
      rewardDistributor,
    } = await loadFixture(fixtureDefault));

    [user1, user2, user3] = accounts;
    account1 = await user1.getAddress();
    account2 = await user2.getAddress();
    account3 = await user3.getAddress();

    amount0 = await parseTokenAmount(iUSDx, 1000);
    amount1 = await parseTokenAmount(iUSDT, 1000);

    await controller
      .connect(user1)
      .enterMarkets([iUSDx.address, iUSDT.address]);
    await controller
      .connect(user2)
      .enterMarkets([iUSDx.address, iUSDT.address]);

    const Token = await ethers.getContractFactory("Token");
    DF = await Token.deploy("DF", "DF", 18);
    await DF.deployed();

    const treasury = await deployTreasuryAndConfig(
      DF.address,
      rewardDistributor
    );

    // Prepare reward
    await DF.mint(treasury.address, parseTokenAmount(DF, "10000000000"));
    await rewardDistributor._setRewardToken(DF.address);
  });

  it("RWD-PAU-1: Initial state should be paused and can not set global speed", async function () {
    expect(await rewardDistributor.paused()).to.equal(true);

    await expect(
      rewardDistributor._setDistributionSpeeds(
        [iUSDx.address, iUSDT.address],
        [borrowSpeed0, borrowSpeed1],
        [iUSDx.address, iUSDT.address],
        [supplySpeed0, supplySpeed1]
      )
    ).to.be.revertedWith("Can not change speeds when paused");

    await expect(
      rewardDistributor._setDistributionSupplySpeeds(
        [iUSDx.address, iUSDT.address],
        [supplySpeed0, supplySpeed1]
      )
    ).to.be.revertedWith("Can not change supply speeds when paused");

    await expect(
      rewardDistributor._setDistributionBorrowSpeeds(
        [iUSDx.address, iUSDT.address],
        [borrowSpeed0, borrowSpeed1]
      )
    ).to.be.revertedWith("Can not change borrow speeds when paused");
  });

  it("RWD-PAU-2: Should only allow owner to unpause", async function () {
    await verifyOnlyOwner(
      rewardDistributor, //contract
      "_unpause", // method
      [
        [iUSDx.address, iUSDT.address],
        [borrowSpeed0, borrowSpeed1],
        [iUSDx.address, iUSDT.address],
        [supplySpeed0, supplySpeed1],
      ], //args
      owner, // owner
      accounts[0], // non-owner
      "Paused", // ownerEvent
      [false], // ownerEventArgs
      // ownerChecks
      async () => {
        expect(await rewardDistributor.paused()).to.equal(false);
        expect(await rewardDistributor.globalDistributionSpeed()).to.equal(
          globalBorrowSpeed
        );
        expect(
          await rewardDistributor.globalDistributionSupplySpeed()
        ).to.equal(globalSupplySpeed);
      },
      // nonownerChecks
      async () => {
        expect(await rewardDistributor.paused()).to.equal(true);
        expect(await rewardDistributor.globalDistributionSpeed()).to.equal(0);
        expect(
          await rewardDistributor.globalDistributionSupplySpeed()
        ).to.equal(0);
      }
    );
  });

  it("RWD-PAU-3: Should only allow owner to pause", async function () {
    await verifyOnlyOwner(
      rewardDistributor, //contract
      "_pause", // method
      [], //args
      owner, // owner
      accounts[0], // non-owner
      "Paused", // ownerEvent
      [true], // ownerEventArgs
      // ownerChecks
      async () => {
        expect(await rewardDistributor.paused()).to.equal(true);
        expect(await rewardDistributor.globalDistributionSpeed()).to.equal(0);
      },
      // nonownerChecks
      async () => {
        expect(await rewardDistributor.paused()).to.equal(false);
        expect(await rewardDistributor.globalDistributionSpeed()).to.equal(
          globalBorrowSpeed
        );
        expect(
          await rewardDistributor.globalDistributionSupplySpeed()
        ).to.equal(globalSupplySpeed);
      }
    );
  });

  it("RWD-PAU-4: Should stop accumulation but claimable when paused", async function () {
    const blockDelta = 100;
    let block, borrowerIndex, reward;

    // Only 1 user mint/borrow
    await iUSDx.connect(user1).mint(account1, amount0);
    await iUSDx.connect(user1).borrow(amount0.div(2));

    startReward = await rewardDistributor.reward(account1);

    // Refresh the speed and token State at the last step for easy calculation
    await rewardDistributor._unpause(
      [iUSDx.address, iUSDT.address],
      [borrowSpeed0, borrowSpeed1],
      [iUSDx.address, iUSDT.address],
      [supplySpeed0, supplySpeed1]
    );

    await increaseBlock(blockDelta);

    // Both supply and borrow side,
    let expectedReward = (
      await rewardDistributor.distributionSpeed(iUSDx.address)
    )
      .mul(blockDelta + 1) //_setPaused() will increase 1 block
      .add(
        (await rewardDistributor.distributionSupplySpeed(iUSDx.address)).mul(
          blockDelta + 1
        )
      );

    let expectedBorrowReward = (
      await rewardDistributor.distributionSpeed(iUSDx.address)
    ).mul(blockDelta + 1);

    await rewardDistributor._pause();

    ({ block: block, index: borrowerIndex } =
      await rewardDistributor.distributionBorrowState(iUSDx.address));

    // Should not accumulated reward or update state when paused
    await increaseBlock(blockDelta);

    const repayAmount = utils.parseEther("10");

    // iToken interactions will accure interest, the borrow balance will increase
    await iUSDx.connect(user1).repayBorrow(repayAmount);

    // the borrow balance stay the same
    // await controller.beforeBorrow(iUSDx.address, account1, 0);

    // const currentBlock = await getBlockBN();

    // Should not update token state if paused
    expect(
      (await rewardDistributor.distributionBorrowState(iUSDx.address)).block
    ).to.equal(block);

    // Should update borrowerIndex
    expect(
      await rewardDistributor.distributionBorrowerIndex(iUSDx.address, account1)
    ).to.equal(borrowerIndex);

    // Should update reward for borrow
    expect(await rewardDistributor.reward(account1)).to.equal(
      expectedBorrowReward
    );

    // claimReward will claim both supply and borrow reward
    await expect(() =>
      rewardDistributor.claimReward([account1], [iUSDx.address])
    ).changeTokenBalance(DF, user1, expectedReward);
  });

  it("RWD-PAU-5: Should not be able to update distribution speeds when paused", async function () {
    await expect(
      rewardDistributor._setDistributionSpeeds([], [], [], [])
    ).to.be.revertedWith("Can not change speeds when paused");

    let block = await getBlockBN();

    expect(await rewardDistributor.distributionSpeed(iUSDx.address)).to.equal(
      0
    );
    expect(await rewardDistributor.distributionSpeed(iUSDT.address)).to.equal(
      0
    );

    // The state should not be updated
    expect(
      (await rewardDistributor.distributionBorrowState(iUSDx.address)).block
    ).to.not.equal(block);
    expect(
      (await rewardDistributor.distributionBorrowState(iUSDx.address)).block
    ).to.not.equal(block);
    expect(
      (await rewardDistributor.distributionSupplyState(iUSDT.address)).block
    ).to.not.equal(block);
    expect(
      (await rewardDistributor.distributionSupplyState(iUSDT.address)).block
    ).to.not.equal(block);
  });

  it("RWD-PAU-6: Should start accumulating after unpause", async function () {
    const blockDelta = 100;

    let startBlock, startIndex, startReward;

    startBlock = (
      await rewardDistributor.distributionSupplyState(iUSDx.address)
    ).block;

    startIndex = await rewardDistributor.distributionBorrowerIndex(
      iUSDx.address,
      account1
    );

    // console.log((await iUSDx.totalBorrows()).toString());
    // console.log((await iUSDx.borrowIndex()).toString());

    startReward = await rewardDistributor.reward(account1);

    await rewardDistributor._unpause(
      [iUSDx.address, iUSDT.address],
      [borrowSpeed0, borrowSpeed1],
      [iUSDx.address, iUSDT.address],
      [supplySpeed0, supplySpeed1]
    );

    // All state should be updated
    await controller.beforeBorrow(iUSDx.address, account1, 0);
    expect(
      (await rewardDistributor.distributionBorrowState(iUSDx.address)).block
    ).to.not.equal(startBlock);
    expect(
      await rewardDistributor.distributionBorrowerIndex(iUSDx.address, account1)
    ).to.not.equal(startIndex);
    expect(await rewardDistributor.reward(account1)).to.not.equal(startReward);

    // console.log((await rewardDistributor.reward(account1)).toString());

    // Should start accumulating reward after unpause
    await increaseBlock(blockDelta);

    let reward = (await rewardDistributor.distributionSpeed(iUSDx.address))
      .mul(blockDelta + 2) // beforeBorrow() and claimReward() will increase 2 blocks
      .add(
        (await rewardDistributor.distributionSupplySpeed(iUSDx.address)).mul(
          blockDelta + 2
        )
      )
      .add(startReward);

    let balanceBefore = (await DF.balanceOf(account1)).add(
      await DF.balanceOf(account2)
    );

    await rewardDistributor.claimReward([account1], [iUSDx.address]);

    let balanceAfter = (await DF.balanceOf(account1)).add(
      await DF.balanceOf(account2)
    );

    // Now the reward index will take borrow index into account
    // There will be some rounding errors
    let error = reward.sub(balanceAfter.sub(balanceBefore));
    // console.log(error.toString());

    // Some arbitrary error allowance
    expect(error).to.lte(500);
  });

  it("RWD-PAU-7: Initial state should be paused, exec _pause", async function () {
    let paused = await rewardDistributor.paused();

    if (!paused) await rewardDistributor._pause();

    expect(await rewardDistributor.paused()).to.equal(true);

    await rewardDistributor._pause();
  });

  it("RWD-PAU-8: Initial state should be unpause, exec _unpause", async function () {
    let paused = await rewardDistributor.paused();

    if (paused) {
      await rewardDistributor._unpause(
        [iUSDx.address, iUSDT.address],
        [borrowSpeed0, borrowSpeed1],
        [iUSDx.address, iUSDT.address],
        [supplySpeed0, supplySpeed1]
      );
    }

    expect(await rewardDistributor.paused()).to.equal(false);

    await rewardDistributor._unpause(
      [iUSDx.address, iUSDT.address],
      [borrowSpeed0, borrowSpeed1],
      [iUSDx.address, iUSDT.address],
      [supplySpeed0, supplySpeed1]
    );
  });

  it("RWD-PAU-9: exec _unpause check address param.", async function () {
    await expect(
      rewardDistributor._unpause(
        [ethers.constants.AddressZero, iUSDT.address],
        [borrowSpeed0, borrowSpeed1],
        [iUSDx.address, iUSDT.address],
        [supplySpeed0, supplySpeed1]
      )
    ).to.be.revertedWith("Token has not been listed");

    await expect(
      rewardDistributor._unpause(
        [controller.address, iUSDT.address],
        [borrowSpeed0, borrowSpeed1],
        [iUSDx.address, iUSDT.address],
        [supplySpeed0, supplySpeed1]
      )
    ).to.be.revertedWith("Token has not been listed");
  });
});

describe.skip("Manually check", function () {
  let controller,
    iUSDx,
    USDx,
    iUSDT,
    USDT,
    iUSDC,
    USDC,
    iMUSX,
    USX,
    priceOracle,
    owner,
    accounts,
    rewardDistributor,
    lendingData;
  let globalBorrowSpeed = utils.parseEther("10000");
  let globalSupplySpeed = utils.parseEther("20000");
  let borrowSpeed0 = utils.parseEther("5000");
  let borrowSpeed1 = utils.parseEther("5000");
  let supplySpeed0 = utils.parseEther("10000");
  let supplySpeed1 = utils.parseEther("10000");
  let user1, user2, user3, user4;
  let account1, account2;
  let amount0, amount1, amount2;
  let rewardToken;
  let validUsersAddr;

  let user1LastActionBlock;
  let user2LastActionBlock;
  let user3LastActionBlock;

  before(async function () {
    ({
      controller,
      iUSDx,
      USDx,
      iUSDT,
      USDT,
      iUSDC,
      USDC,
      iMUSX,
      USX,
      owner,
      accounts,
      priceOracle,
      rewardDistributor,
      lendingData,
    } = await loadFixture(fixtureDefault));

    [user1, user2, user3, user4] = accounts;
    validUsersAddr = [user1.address, user2.address, user3.address];

    rewardToken = USDx;

    account1 = await user1.getAddress();
    account2 = await user2.getAddress();

    amount0 = await parseTokenAmount(iUSDx, 1000);
    amount1 = await parseTokenAmount(iUSDT, 1000);
    amount2 = await parseTokenAmount(iMUSX, 1000);

    await controller
      .connect(user1)
      .enterMarkets([iUSDx.address, iUSDT.address]);
    await controller
      .connect(user2)
      .enterMarkets([iUSDx.address, iUSDT.address]);

    for (let i = 0; i < accounts.length; i++) {
      let account = accounts[i];
      let balance = await iUSDT.balanceOf(account.address);
      if (balance.toString() != "0") {
        await iUSDT
          .connect(account)
          .transfer(owner.address, await iUSDT.balanceOf(balance));
      }
      balance = await iUSDT.balanceOf(account.address);
    }

    await USDT.connect(user1).approve(iUSDT.address, MAX);
    await USDT.connect(user2).approve(iUSDT.address, MAX);
    await USDT.connect(user3).approve(iUSDT.address, MAX);

    await USDC.connect(user1).approve(iUSDC.address, MAX);
    await USDC.connect(user2).approve(iUSDC.address, MAX);
    await USDC.connect(user3).approve(iUSDC.address, MAX);

    await USX.connect(user1).approve(iMUSX.address, MAX);
    await USX.connect(user2).approve(iMUSX.address, MAX);
    await USX.connect(user3).approve(iMUSX.address, MAX);

    await USDC.connect(user4).approve(iUSDC.address, MAX);
    await iUSDC
      .connect(user4)
      .mint(user4.address, await parseTokenAmount(iUSDC, 1000));

    await controller.connect(user1).enterMarkets([iUSDT.address]);
    await controller.connect(user2).enterMarkets([iUSDT.address]);
    await controller.connect(user3).enterMarkets([iUSDT.address]);

    const treasury = await deployTreasuryAndConfig(
      rewardToken.address,
      rewardDistributor
    );

    await rewardDistributor._setRewardToken(rewardToken.address);
    await rewardToken.mint(
      treasury.address,
      await parseTokenAmount(rewardToken, 100000)
    );

    const NewRateModel = await ethers.getContractFactory(
      "MockRateModelNoInterest"
    );
    const newRateModel = await NewRateModel.deploy();
    await newRateModel.deployed();

    await newRateModel.setIsInterestRateModel(true);

    // await iUSDT._setInterestRateModel(newRateModel.address);
    // await iUSDC._setInterestRateModel(newRateModel.address);
  });

  async function confirmTx() {
    await increaseBlock(1);
    await increaseTime(1);
  }

  async function mine(blocks) {
    await increaseBlock(blocks);
    await increaseTime(blocks);
  }

  async function userRewardTokenAmount(userAddress) {
    return await rewardToken.balanceOf(userAddress);
  }

  async function executeActionsThenVerify(userAddresses, expectResults) {
    let usersLength = userAddresses.length;

    let beforeTXUserRewardTokenAmounts = [];
    let delta = 0.0001;

    for (let i = 0; i < usersLength; i++) {
      console.log("index: ", i);
      let userAddr = userAddresses[i];
      let beforeTXUserRewardTokenAmount = await userRewardTokenAmount(userAddr);
      console.log(
        "beforeTXUserRewardTokenAmount",
        beforeTXUserRewardTokenAmount.toString()
      );
      beforeTXUserRewardTokenAmounts.push(beforeTXUserRewardTokenAmount);
    }

    await confirmTx();
    console.log("current block: ", await getBlock());

    for (let i = 0; i < usersLength; i++) {
      console.log("index: ", i);
      let userAddr = userAddresses[i];
      let beforeTXUserRewardTokenAmount = beforeTXUserRewardTokenAmounts[i];
      let expectUserRewardAmount = expectResults.expectUsersRewardAmounts[i];
      let expectUserClaimableAmount =
        expectResults.expectUserClaimableAmounts[i];

      let afterTXUserRewardTokenAmount = await userRewardTokenAmount(userAddr);

      console.log(
        "actual",
        afterTXUserRewardTokenAmount
          .sub(beforeTXUserRewardTokenAmount)
          .toString()
      );
      console.log("expectUserRewardAmount", expectUserRewardAmount.toString());

      verifyAllowError(
        afterTXUserRewardTokenAmount.sub(beforeTXUserRewardTokenAmount),
        expectUserRewardAmount,
        delta
      );

      let userClaimableAmount =
        await lendingData.callStatic.getAccountRewardAmount(userAddr);
      console.log("userClaimableAmount", userClaimableAmount.toString());
      console.log(
        "expectUserClaimableAmount",
        expectUserClaimableAmount.toString(),
        "\n"
      );

      verifyAllowError(userClaimableAmount, expectUserClaimableAmount, delta);
    }

    let actualiUSDTTotalSupply = await iUSDT.totalSupply();
    console.log("actualiUSDTTotalSupply", actualiUSDTTotalSupply.toString());
    console.log(
      "expectResults.expectediUSDTTotalSupply",
      expectResults.expectediUSDTTotalSupply.toString()
    );

    verifyAllowError(
      actualiUSDTTotalSupply,
      expectResults.expectediUSDTTotalSupply,
      delta
    );

    let actualiUSDCTotalBorrow = await iUSDC.totalBorrows();
    console.log("actualiUSDCTotalBorrow", actualiUSDCTotalBorrow.toString());

    verifyAllowError(
      actualiUSDCTotalBorrow,
      expectResults.expectediUSDCTotalBorrow,
      delta
    );

    let actualiMUSXTotalBorrow = await iMUSX.totalBorrows();
    console.log("actualiMUSXTotalBorrow", actualiMUSXTotalBorrow.toString());

    verifyAllowError(
      actualiMUSXTotalBorrow,
      expectResults.expectediMUSXTotalBorrow,
      delta
    );
  }

  it("1. Set iUSDT supply distribution rate to 10 and supplies 500 USDT", async function () {
    await miningAutomatically(false);
    let currentBlock = await getBlock();
    let passBlocks = 599 - currentBlock;

    await mine(passBlocks);

    console.log(
      "Start to execute all actions from the block: ",
      await getBlock()
    );

    await rewardDistributor._unpause(
      [],
      [],
      [iUSDT.address],
      [await parseTokenAmount(rewardToken, 10)]
    );
    await iUSDT
      .connect(user1)
      .mint(user1.address, await parseTokenAmount(iUSDT, 500));

    await confirmTx();
    console.log("current block: ", await getBlock());
  });

  it("2. Pass 40 blocks, user2 supplies 600 USDT", async function () {
    let passBlocks = 39;
    await mine(passBlocks);

    await iUSDT
      .connect(user2)
      .mint(user2.address, await parseTokenAmount(iUSDT, 600));

    let expectResult = {
      expectediUSDTTotalSupply: await parseTokenAmount(iUSDT, 1100),
      expectediUSDCTotalBorrow: ZERO,
      expectediMUSXTotalBorrow: ZERO,
      expectUsersRewardAmounts: [ZERO, ZERO, ZERO],
      expectUserClaimableAmounts: [
        await parseTokenAmount(rewardToken, 400),
        ZERO,
        ZERO,
      ],
    };

    await executeActionsThenVerify(validUsersAddr, expectResult);
  });

  it("3. Pass another 60 blocks, user1 withdraws 200 USDT and claim rewards.", async function () {
    let passBlocks = 59;
    await mine(passBlocks);

    await iUSDT
      .connect(user3)
      .mint(user3.address, await parseTokenAmount(iUSDT, 1000));
    await iUSDT
      .connect(user1)
      .redeemUnderlying(user1.address, await parseTokenAmount(iUSDT, 200));
    await rewardDistributor.connect(user1).claimAllReward([user1.address]);

    let expectResult = {
      expectediUSDTTotalSupply: await parseTokenAmount(iUSDT, 1900),
      expectediUSDCTotalBorrow: ZERO,
      expectediMUSXTotalBorrow: ZERO,
      expectUsersRewardAmounts: [
        BigNumber.from("672727272727272727272"),
        ZERO,
        ZERO,
      ],
      expectUserClaimableAmounts: [
        ZERO,
        BigNumber.from("327272727272727272727"),
        ZERO,
      ],
    };

    await executeActionsThenVerify(validUsersAddr, expectResult);
  });

  it("4. Pass 20 blocks, user1 supplies 300 USDT, borrows 100 USDC and user3 mints 200 USX", async function () {
    let passBlocks = 19;
    await mine(passBlocks);

    await rewardDistributor._setDistributionSupplySpeeds(
      [iUSDT.address],
      [await parseTokenAmount(rewardToken, 50)]
    );
    await rewardDistributor._setDistributionBorrowSpeeds(
      [iUSDC.address],
      [await parseTokenAmount(rewardToken, 20)]
    );
    await iUSDT
      .connect(user1)
      .mint(user1.address, await parseTokenAmount(iUSDT, 300));
    await iUSDC.connect(user1).borrow(await parseTokenAmount(iUSDC, 100));

    await iMUSX.connect(user3).borrow(await parseTokenAmount(iMUSX, 200));

    let expectResult = {
      expectediUSDTTotalSupply: await parseTokenAmount(iUSDT, 2200),
      expectediUSDCTotalBorrow: await parseTokenAmount(iUSDC, 100),
      expectediMUSXTotalBorrow: await parseTokenAmount(iMUSX, 200),
      expectUsersRewardAmounts: [ZERO, ZERO, ZERO],
      expectUserClaimableAmounts: [
        BigNumber.from("31578947368421052631"),
        BigNumber.from("390430622009569377990"),
        BigNumber.from("105263157894736842105"),
      ],
    };

    await executeActionsThenVerify(validUsersAddr, expectResult);
  });

  it("5. Pass 30 blocks, user1 supplies 300 USDT, borrows 300 USDC, mint 200 USX and claim.", async function () {
    let passBlocks = 29;
    await mine(passBlocks);

    await rewardDistributor.connect(user2).claimAllReward([user2.address], {
      gasPrice: ethers.utils.parseUnits("150", "gwei"),
    });
    await rewardDistributor.connect(user3).claimAllReward([user3.address], {
      gasPrice: ethers.utils.parseUnits("145", "gwei"),
    });
    await rewardDistributor._setDistributionBorrowSpeeds(
      [iMUSX.address],
      [await parseTokenAmount(rewardToken, 30)],
      { gasPrice: ethers.utils.parseUnits("140", "gwei") }
    );
    await rewardDistributor._setDistributionBorrowSpeeds(
      [iMUSX.address],
      [await parseTokenAmount(rewardToken, 30)],
      { gasPrice: ethers.utils.parseUnits("135", "gwei") }
    );

    await iMUSX.connect(user1).borrow(await parseTokenAmount(iMUSX, 50), {
      gasPrice: ethers.utils.parseUnits("130", "gwei"),
    });
    await iUSDC.connect(user1).repayBorrow(await parseTokenAmount(iUSDC, 50), {
      gasPrice: ethers.utils.parseUnits("125", "gwei"),
    });

    await iUSDT
      .connect(user2)
      .mint(user2.address, await parseTokenAmount(iUSDT, 300), {
        gasPrice: ethers.utils.parseUnits("120", "gwei"),
      });
    await iUSDC.connect(user2).borrow(await parseTokenAmount(iUSDC, 300), {
      gasPrice: ethers.utils.parseUnits("115", "gwei"),
    });
    await iMUSX.connect(user2).borrow(await parseTokenAmount(iMUSX, 200), {
      gasPrice: ethers.utils.parseUnits("110", "gwei"),
    });

    await iMUSX.connect(user3).repayBorrow(await parseTokenAmount(iMUSX, 100), {
      gasPrice: ethers.utils.parseUnits("105", "gwei"),
    });

    let expectResult = {
      expectediUSDTTotalSupply: await parseTokenAmount(iUSDT, 2500),
      expectediUSDCTotalBorrow: await parseTokenAmount(iUSDC, 350),
      expectediMUSXTotalBorrow: await parseTokenAmount(iMUSX, 350),
      expectUsersRewardAmounts: [
        ZERO,
        BigNumber.from("799521531100478468899"),
        BigNumber.from("787081339712918660287"),
      ],
      expectUserClaimableAmounts: [
        BigNumber.from("1040669856459330143540"),
        ZERO,
        ZERO,
      ],
    };

    await executeActionsThenVerify(validUsersAddr, expectResult);
  });

  it("6. Pass 50 blocks, user1 repays 50 USX and user3 borrows 300 USX", async function () {
    let passBlocks = 49;
    await mine(passBlocks);

    await iMUSX.connect(user1).repayBorrow(await parseTokenAmount(iMUSX, 50), {
      gasPrice: ethers.utils.parseUnits("150", "gwei"),
    });
    await iUSDC.connect(user2).repayBorrow(await parseTokenAmount(iUSDC, 100), {
      gasPrice: ethers.utils.parseUnits("140", "gwei"),
    });
    await iMUSX.connect(user2).borrow(await parseTokenAmount(iMUSX, 100), {
      gasPrice: ethers.utils.parseUnits("135", "gwei"),
    });

    await iMUSX.connect(user3).borrow(await parseTokenAmount(iMUSX, 300), {
      gasPrice: ethers.utils.parseUnits("130", "gwei"),
    });

    let expectResult = {
      expectediUSDTTotalSupply: await parseTokenAmount(iUSDT, 2500),
      expectediUSDCTotalBorrow: await parseTokenAmount(iUSDC, 250),
      expectediMUSXTotalBorrow: await parseTokenAmount(iMUSX, 700),
      expectUsersRewardAmounts: [ZERO, ZERO, ZERO],
      expectUserClaimableAmounts: [
        BigNumber.from("1997812665422188246490"),
        BigNumber.from("2614285331361614755821"),
        BigNumber.from("1428571865389813507533"),
      ],
    };

    await executeActionsThenVerify(validUsersAddr, expectResult);
  });

  it("7. Pass 100 blocks, stop to distribute reward token.", async function () {
    let passBlocks = 99;
    await mine(passBlocks);

    await rewardDistributor._pause();

    let expectResult = {
      expectediUSDTTotalSupply: await parseTokenAmount(iUSDT, 2500),
      expectediUSDCTotalBorrow: await parseTokenAmount(iUSDC, 250),
      expectediMUSXTotalBorrow: await parseTokenAmount(iMUSX, 700),
      expectUsersRewardAmounts: [ZERO, ZERO, ZERO],
      expectUserClaimableAmounts: [
        BigNumber.from("3597812881832823066269"),
        BigNumber.from("7299999664195271315404"),
        BigNumber.from("5142857332145518030837"),
      ],
    };

    await executeActionsThenVerify(validUsersAddr, expectResult);

    expect(
      await rewardDistributor.distributionSupplySpeed(iUSDT.address)
    ).to.equal(0);
    expect(await rewardDistributor.distributionSpeed(iUSDC.address)).to.equal(
      0
    );
    expect(await rewardDistributor.distributionSpeed(iMUSX.address)).to.equal(
      0
    );
  });

  it("8. Pass 50 blocks, user1 supply 2k USDT, borrow 500 USX and user3 borrow 200 USX", async function () {
    let passBlocks = 49;
    await mine(passBlocks);

    await iUSDT
      .connect(user1)
      .mint(user1.address, await parseTokenAmount(iUSDT, 2000), {
        gasPrice: ethers.utils.parseUnits("130", "gwei"),
      });
    await iMUSX.connect(user1).borrow(await parseTokenAmount(iMUSX, 500), {
      gasPrice: ethers.utils.parseUnits("120", "gwei"),
    });
    await iMUSX.connect(user3).borrow(await parseTokenAmount(iMUSX, 200), {
      gasPrice: ethers.utils.parseUnits("110", "gwei"),
    });

    let expectResult = {
      expectediUSDTTotalSupply: await parseTokenAmount(iUSDT, 4500),
      expectediUSDCTotalBorrow: await parseTokenAmount(iUSDC, 250),
      expectediMUSXTotalBorrow: await parseTokenAmount(iMUSX, 1400),
      expectUsersRewardAmounts: [ZERO, ZERO, ZERO],
      expectUserClaimableAmounts: [
        BigNumber.from("3597812881832823066311"),
        BigNumber.from("7299999664195271315657"),
        BigNumber.from("5142857332145518030585"),
      ],
    };

    await executeActionsThenVerify(validUsersAddr, expectResult);
  });

  it("9. Pass 90 blocks, user2 supply 800 USDT, borrow 500 USDC and claim rewards.", async function () {
    let passBlocks = 49;
    await mine(passBlocks);

    await iUSDT
      .connect(user2)
      .mint(user2.address, await parseTokenAmount(iUSDT, 800), {
        gasPrice: ethers.utils.parseUnits("130", "gwei"),
      });
    await iUSDC.connect(user2).borrow(await parseTokenAmount(iUSDC, 500), {
      gasPrice: ethers.utils.parseUnits("125", "gwei"),
    });
    await rewardDistributor.claimAllReward([account2], {
      gasPrice: ethers.utils.parseUnits("120", "gwei"),
    });

    let expectResult = {
      expectediUSDTTotalSupply: await parseTokenAmount(iUSDT, 5300),
      expectediUSDCTotalBorrow: await parseTokenAmount(iUSDC, 750),
      expectediMUSXTotalBorrow: await parseTokenAmount(iMUSX, 1400),
      expectUsersRewardAmounts: [
        ZERO,
        BigNumber.from("7299999664195271315404"),
        ZERO,
      ],
      expectUserClaimableAmounts: [
        BigNumber.from("3597812881832823066311"),
        ZERO,
        BigNumber.from("5142857332145518030585"),
      ],
    };

    await executeActionsThenVerify(validUsersAddr, expectResult);
  });

  it("10. Pass 40 blocks, user1 withdraw 500 USDT, user2 repay 300 USDC, user3 borrow 300 USDC and repay 200 USX", async function () {
    let passBlocks = 39;
    await mine(passBlocks);

    await iUSDT
      .connect(user1)
      .redeemUnderlying(user1.address, await parseTokenAmount(iUSDT, 500));
    await iUSDC.connect(user2).repayBorrow(await parseTokenAmount(iUSDC, 300));
    await iMUSX.connect(user3).repayBorrow(await parseTokenAmount(iMUSX, 200));
    await iUSDC.connect(user3).borrow(await parseTokenAmount(iUSDC, 300));

    let expectResult = {
      expectediUSDTTotalSupply: await parseTokenAmount(iUSDT, 4800),
      expectediUSDCTotalBorrow: await parseTokenAmount(iUSDC, 750),
      expectediMUSXTotalBorrow: await parseTokenAmount(iMUSX, 1200),
      expectUsersRewardAmounts: [ZERO, ZERO, ZERO],
      expectUserClaimableAmounts: [
        BigNumber.from("3597812881832823066311"),
        ZERO,
        BigNumber.from("5142857332145518030585"),
      ],
    };

    await executeActionsThenVerify(validUsersAddr, expectResult);
  });

  it("11. Pass 120 blocks, call update interest directly", async function () {
    let passBlocks = 119;
    await mine(passBlocks);

    await rewardDistributor.updateRewardBatch(validUsersAddr, [
      iUSDT.address,
      iUSDC.address,
      iMUSX.address,
    ]);

    let expectResult = {
      expectediUSDTTotalSupply: await parseTokenAmount(iUSDT, 4800),
      expectediUSDCTotalBorrow: await parseTokenAmount(iUSDC, 750),
      expectediMUSXTotalBorrow: await parseTokenAmount(iMUSX, 1200),
      expectUsersRewardAmounts: [ZERO, ZERO, ZERO],
      expectUserClaimableAmounts: [
        BigNumber.from("3597812881832823066311"),
        ZERO,
        BigNumber.from("5142857332145518030585"),
      ],
    };

    await executeActionsThenVerify(validUsersAddr, expectResult);
  });
});
