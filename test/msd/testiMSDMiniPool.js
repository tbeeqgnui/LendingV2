const { expect } = require("chai");

const {
  parseTokenAmount,
  formatTokenAmount,
  verifyOnlyOwner,
  rmul,
  rdiv,
} = require("../helpers/utils.js");

const {
  loadFixture,
  deployiTokenAndSetConfigs,
  fixtureDefault,
} = require("../helpers/fixtures.js");

async function fixtureMiniPoolBorrow() {
  const results = await loadFixture(fixtureDefault);

  const { collateralUnderlying, collateral, iMSDMiniPool, USX, accounts } =
    results;

  const user = accounts[0];
  const someDepositor = accounts[9];

  await collateralUnderlying
    .connect(user)
    .approve(iMSDMiniPool.address, ethers.constants.MaxUint256);

  await collateralUnderlying
    .connect(someDepositor)
    .approve(iMSDMiniPool.address, ethers.constants.MaxUint256);

  // Now there is a thresold of totalSupply
  await collateral.connect(someDepositor).mint(someDepositor.address, 10000);

  await collateral
    .connect(user)
    .approve(iMSDMiniPool.address, ethers.constants.MaxUint256);

  await USX.connect(user).approve(
    iMSDMiniPool.address,
    ethers.constants.MaxUint256
  );

  const userAddr = await user.getAddress();

  return { ...results, user, userAddr };
}

async function fixtureMiniPoolRepay() {
  const results = await loadFixture(fixtureMiniPoolBorrow);

  const { collateral, iMSDMiniPool, user } = results;

  await iMSDMiniPool
    .connect(user)
    .depositAndBorrow(
      true,
      await parseTokenAmount(collateral, "100"),
      await parseTokenAmount(iMSDMiniPool, "90")
    );

  return { ...results };
}

async function getBalances(tokens, accounts) {
  let result = {};

  for (account of accounts) {
    const address = await account.getAddress();
    result[address] = await tokens.reduce(async (res, token) => {
      res = await res;
      res[token.address] = await token.balanceOf(address);
      return res;
    }, {});
  }

  return result;
}

async function getAccrualBlockNumbers(tokens) {
  return tokens.reduce(async (res, token) => {
    res = await res;
    res[token.address] = await token.accrualBlockNumber();
    return res;
  }, {});
}

describe("iMSD Mini Pool", function () {
  let collateralUnderlying, collateral, iMSDMiniPool, USX, controller;
  let user, userAddr;

  describe("Origination Fee", function () {
    let owner, feeRecipient, feeRecipientAddr;

    before(async () => {
      ({
        owner,
        collateralUnderlying,
        collateral,
        iMSDMiniPool,
        USX,
        user,
        userAddr,
        controllerMiniPool: controller,
      } = await loadFixture(fixtureMiniPoolBorrow));

      feeRecipient = (await ethers.getSigners())[0];
      feeRecipientAddr = await iMSDMiniPool.originationFeeRecipient();

      expect(await feeRecipient.getAddress()).to.equal(feeRecipientAddr);
    });

    // The default fixture set fee ratio to 0
    describe("Fee Ratio = 0", function () {
      it("Should be able to borrow 1 and fee to 0", async function () {
        const before = await getBalances([USX], [user, feeRecipient]);

        await iMSDMiniPool.connect(user).depositAndBorrow(true, 2, 1);

        const after = await getBalances([USX], [user, feeRecipient]);

        // Exact amount
        expect(
          after[userAddr][USX.address].sub(before[userAddr][USX.address])
        ).to.equal(1);

        // No fee
        expect(
          after[feeRecipientAddr][USX.address].sub(
            before[feeRecipientAddr][USX.address]
          )
        ).to.equal(0);
      });
    });

    describe("Fee Ratio != 0", function () {
      let feeRatio;

      before(async () => {
        feeRatio = ethers.utils.parseEther("0.1");
        await iMSDMiniPool._setOriginationFeeRatio(feeRatio);
      });

      it("Should be able to borrow 0 and fee to 0", async function () {
        const before = await getBalances([USX], [user, feeRecipient]);

        await iMSDMiniPool.connect(user).depositAndBorrow(true, 1, 0);

        const after = await getBalances([USX], [user, feeRecipient]);

        // Exact Amount
        expect(
          after[userAddr][USX.address].sub(before[userAddr][USX.address])
        ).to.equal(0);

        // No fee
        expect(
          after[feeRecipientAddr][USX.address].sub(
            before[feeRecipientAddr][USX.address]
          )
        ).to.equal(0);
      });

      it("Should be able to borrow !0 rounding fee down to 0", async function () {
        const before = await getBalances([USX], [user, feeRecipient]);

        await iMSDMiniPool.connect(user).depositAndBorrow(true, 11, 9);

        const after = await getBalances([USX], [user, feeRecipient]);

        // Exact Amount
        expect(
          after[userAddr][USX.address].sub(before[userAddr][USX.address])
        ).to.equal(9);

        // No fee
        expect(
          after[feeRecipientAddr][USX.address].sub(
            before[feeRecipientAddr][USX.address]
          )
        ).to.equal(0);
      });

      it("Should be able to borrow and charge some fee", async function () {
        const before = await getBalances([USX], [user, feeRecipient]);

        await iMSDMiniPool.connect(user).depositAndBorrow(true, 20, 10);

        const after = await getBalances([USX], [user, feeRecipient]);

        // remaining Amount
        expect(
          after[userAddr][USX.address].sub(before[userAddr][USX.address])
        ).to.equal(9);

        // Fee
        expect(
          after[feeRecipientAddr][USX.address].sub(
            before[feeRecipientAddr][USX.address]
          )
        ).to.equal(1);
      });

      it("Should be able to change fee ratio", async function () {
        const oldFeeRatro = await iMSDMiniPool.originationFeeRatio();
        const newFeeRatio = ethers.utils.parseEther("0.001");

        await verifyOnlyOwner(
          iMSDMiniPool, //contract
          "_setOriginationFeeRatio", // method
          [newFeeRatio], //args
          owner, // owner
          user, // non-owner
          "NewOriginationFeeRatio", // ownerEvent
          [oldFeeRatro, newFeeRatio], // ownerEventArgs
          // ownerChecks
          async () => {
            expect(await iMSDMiniPool.originationFeeRatio()).to.equal(
              newFeeRatio
            );
          },
          // nonownerChecks
          async () => {
            expect(await iMSDMiniPool.originationFeeRatio()).to.equal(
              oldFeeRatro
            );
          }
        );
      });

      it("Should not be able to change fee ratio > MAX_FEE_RATIO", async function () {
        const MAX_FEE_RATIO = ethers.utils.parseEther("0.5");

        await expect(
          iMSDMiniPool._setOriginationFeeRatio(MAX_FEE_RATIO.add(1))
        ).to.revertedWith("New fee ratio too large!");
      });
    });

    describe("Fee Recipient", function () {
      it("Should be able to change fee recipient", async function () {
        const newFeeRecipientAddr = userAddr;

        await verifyOnlyOwner(
          iMSDMiniPool, //contract
          "_setOriginationFeeRecipient", // method
          [newFeeRecipientAddr], //args
          owner, // owner
          user, // non-owner
          "NewOriginationFeeRecipient", // ownerEvent
          [feeRecipientAddr, newFeeRecipientAddr], // ownerEventArgs
          // ownerChecks
          async () => {
            expect(await iMSDMiniPool.originationFeeRecipient()).to.equal(
              newFeeRecipientAddr
            );
          },
          // nonownerChecks
          async () => {
            expect(await iMSDMiniPool.originationFeeRecipient()).to.equal(
              feeRecipientAddr
            );
          }
        );
      });

      it("Should not be able to change fee recipient to zero address", async function () {
        await expect(
          iMSDMiniPool._setOriginationFeeRecipient(ethers.constants.AddressZero)
        ).to.revertedWith("Fee recipent address should not be zero address!");
      });
    });
  });

  describe("Deposit And Borrow", function () {
    let depositAmount = ethers.utils.parseEther("100");
    let borrowAmount = ethers.utils.parseEther("90");
    let zeroAmount = ethers.BigNumber.from("0");

    async function executeAndVerify(args, succeed) {
      const [enterMarket, depositAmount, borrowAmount] = args;
      let before = {};
      let after = {};

      before.accrualBlockNumbers = await getAccrualBlockNumbers([
        collateral,
        iMSDMiniPool,
      ]);
      before.balances = await getBalances(
        [collateralUnderlying, collateral, USX],
        [user]
      );

      if (!succeed) {
        await expect(iMSDMiniPool.connect(user).depositAndBorrow(...args)).to
          .reverted;

        return;
      }

      await iMSDMiniPool.connect(user).depositAndBorrow(...args);

      after.accrualBlockNumbers = await getAccrualBlockNumbers([
        collateral,
        iMSDMiniPool,
      ]);
      after.balances = await getBalances(
        [collateralUnderlying, collateral, USX],
        [user]
      );

      expect(
        after.balances[userAddr][collateralUnderlying.address].sub(
          before.balances[userAddr][collateralUnderlying.address]
        )
      ).to.equal(depositAmount.mul(-1));

      expect(
        after.balances[userAddr][collateral.address].sub(
          before.balances[userAddr][collateral.address]
        )
      ).to.equal(depositAmount);

      expect(
        after.balances[userAddr][USX.address].sub(
          before.balances[userAddr][USX.address]
        )
      ).to.equal(borrowAmount);

      expect(
        await controller.hasEnteredMarket(userAddr, collateral.address)
      ).to.equal(enterMarket);

      if (borrowAmount.isZero()) {
        // Should not call borrow() on iMSDMiniPool, no interest should be updated
        expect(before.accrualBlockNumbers[USX.address]).to.equal(
          after.accrualBlockNumbers[USX.address]
        );
      }

      if (depositAmount.isZero()) {
        // Should not call mint() on collateral, no interest should be updated
        expect(before.accrualBlockNumbers[collateral.address]).to.equal(
          after.accrualBlockNumbers[collateral.address]
        );
      }
    }

    function runCases(cases) {
      cases.forEach(({ args, succeed }) => {
        const [enterMarket, depositAmount, borrowAmount] = args;

        const depositAmountPaded = ethers.utils
          .formatEther(depositAmount)
          .padStart(6);
        const borrowAmountPaded = ethers.utils
          .formatEther(borrowAmount)
          .padStart(25);
        const enterMarketPaded = enterMarket.toString().padStart(6);
        const succeedPaded = succeed.toString().padStart(6);

        it(`Deposits: ${depositAmountPaded}, borrow: ${borrowAmountPaded}, use as collateral : ${enterMarketPaded}, should succeed: ${succeedPaded}`, async () => {
          await executeAndVerify(args, succeed);
        });
      });
    }

    describe("Initial State: no collaterals", function () {
      beforeEach(async () => {
        ({
          controllerMiniPool: controller,
          collateralUnderlying,
          collateral,
          iMSDMiniPool,
          USX,
          user,
          userAddr,
        } = await loadFixture(fixtureMiniPoolBorrow));
      });

      runCases([
        { args: [true, depositAmount, zeroAmount], succeed: true },
        { args: [false, depositAmount, zeroAmount], succeed: true },
        { args: [true, depositAmount, borrowAmount], succeed: true },
        { args: [false, depositAmount, borrowAmount], succeed: false },
        { args: [true, zeroAmount, zeroAmount], succeed: true },
        { args: [false, zeroAmount, zeroAmount], succeed: true },
        { args: [true, zeroAmount, borrowAmount], succeed: false },
        { args: [false, zeroAmount, borrowAmount], succeed: false },
      ]);
    });

    describe("After deposite 100 and as collateral", function () {
      beforeEach(async () => {
        ({
          controllerMiniPool: controller,
          collateralUnderlying,
          collateral,
          iMSDMiniPool,
          USX,
          user,
          userAddr,
        } = await loadFixture(fixtureMiniPoolBorrow));

        await iMSDMiniPool
          .connect(user)
          .depositAndBorrow(true, depositAmount, 0);
      });

      runCases([
        { args: [true, depositAmount, zeroAmount], succeed: true },
        { args: [true, depositAmount, borrowAmount], succeed: true },
        {
          args: [true, depositAmount, borrowAmount.mul(2)],
          succeed: true,
        },
        {
          args: [true, depositAmount, borrowAmount.mul(2).add(1)],
          succeed: false,
        },
        { args: [true, zeroAmount, zeroAmount], succeed: true },
        { args: [true, zeroAmount, borrowAmount], succeed: true },
        {
          args: [true, zeroAmount, borrowAmount.add(1)],
          succeed: false,
        },
      ]);
    });
  });

  describe("Repay and Withdraw", function () {
    let repayAmount = ethers.utils.parseEther("80");
    let withdrawAmount = ethers.utils.parseEther("88.88");
    let zeroAmount = ethers.BigNumber.from("0");

    beforeEach(async () => {
      ({ collateralUnderlying, collateral, iMSDMiniPool, USX, user, userAddr } =
        await loadFixture(fixtureMiniPoolRepay));
    });

    testCases = [
      { args: [true, repayAmount, zeroAmount], succeed: true },
      { args: [false, repayAmount, zeroAmount], succeed: true },
      { args: [true, repayAmount, withdrawAmount], succeed: true },
      { args: [false, repayAmount, withdrawAmount], succeed: true },
      { args: [true, zeroAmount, zeroAmount], succeed: true },
      { args: [false, zeroAmount, zeroAmount], succeed: true },
      { args: [true, zeroAmount, withdrawAmount], succeed: false },
      { args: [false, zeroAmount, withdrawAmount], succeed: false },
    ];

    testCases.forEach(({ args, succeed }) => {
      const [isUnderlying, repayAmount, withdrawAmount] = args;

      it(`Repay: ${repayAmount}, Withdraw: ${withdrawAmount}, isUnderlying :${isUnderlying}, should succeed: ${succeed}`, async () => {
        let before = {};
        let after = {};

        before.accrualBlockNumbers = await getAccrualBlockNumbers([
          collateral,
          iMSDMiniPool,
        ]);
        before.balances = await getBalances(
          [collateralUnderlying, collateral, USX],
          [user]
        );

        if (!succeed) {
          await expect(iMSDMiniPool.connect(user).repayAndWithdraw(...args)).to
            .reverted;

          return;
        }

        await iMSDMiniPool.connect(user).repayAndWithdraw(...args);

        after.accrualBlockNumbers = await getAccrualBlockNumbers([
          collateral,
          iMSDMiniPool,
        ]);
        after.balances = await getBalances(
          [collateralUnderlying, collateral, USX],
          [user]
        );

        expect(
          after.balances[userAddr][collateralUnderlying.address].sub(
            before.balances[userAddr][collateralUnderlying.address]
          )
        ).to.equal(withdrawAmount);

        expect(
          after.balances[userAddr][collateral.address].sub(
            before.balances[userAddr][collateral.address]
          )
        ).to.equal(withdrawAmount.mul(-1));

        expect(
          after.balances[userAddr][USX.address].sub(
            before.balances[userAddr][USX.address]
          )
        ).to.equal(repayAmount.mul(-1));

        if (repayAmount.isZero()) {
          // Should not call repay() on iMSDMiniPool, no interest should be updated
          expect(before.accrualBlockNumbers[USX.address]).to.equal(
            after.accrualBlockNumbers[USX.address]
          );
        }

        if (withdrawAmount.isZero()) {
          // Should not call withdraw() on collateral, no interest should be updated
          expect(before.accrualBlockNumbers[collateral.address]).to.equal(
            after.accrualBlockNumbers[collateral.address]
          );
        }
      });
    });
  });
});

describe("Controller Mini Pool", function () {
  let collateral, priceOracle, interestRateModel, controller;
  let accounts;

  before(async function () {
    ({
      collateral,
      controllerMiniPool: controller,
      priceOracle,
      interestRateModel,
      accounts,
    } = await loadFixture(fixtureDefault));
  });

  it("Should not be able to add market with iToken's controller is some other controller", async function () {
    const { iToken: iTokenToAdd } = await deployiTokenAndSetConfigs(
      "Test Token",
      "tToken",
      18,
      "dForce lending Test Token",
      "iToken Test",
      interestRateModel, // use some other address as controller, should check
      interestRateModel, // use some other address as controller, should check
      interestRateModel,
      priceOracle,
      false,
      0,
      0,
      0
    );

    await expect(
      controller._addMarket(iTokenToAdd.address, 0, 0, 0, 0, 0)
    ).to.revertedWith("Token's controller is not this one");
  });

  it("Should not be able to enter market by others", async function () {
    await expect(
      controller.enterMarketFromiToken(
        collateral.address,
        await accounts[1].getAddress()
      )
    ).to.revertedWith("Token has not been listed");
  });
});
