const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const { ethers } = require("hardhat");

const IToken = require("../../../artifacts/contracts/iToken.sol/iToken.json");

const {
  verifyOnlyOwner,
  verifyNonlistediToken,
  setOraclePrices,
  MAX,
} = require("../../helpers/utils.js");
const {
  fixtureDefault,
  fixtureV2,
  fixtureDeployController,
  deployiTokenAndSetConfigs,
  loadFixture,
  miningAutomatically,
  increaseTime,
} = require("../../helpers/fixtures.js");

describe("Controller V2 Policy", function () {
  describe("Isolation Mode", function () {
    let controllerV2, owner, accounts, priceOracle;
    let iUSDx, iETH;
    let userIsolated, userNonIsolated, userDeposited;
    let ARB, iARB, OP, iOP, USDC, iUSDC, USDT, iUSDT, USX, iUSX;
    let debtCeilingDecimals;
    let supplyAmount, repayAmount, rawRepayAmount;

    async function fixtureIsolationBase() {
      const results = await loadFixture(fixtureV2);

      const {
        controllerV2,
        accounts: [userIsolated, userNonIsolated],
        iARB,
      } = results;

      await controllerV2.connect(userIsolated).enterMarkets([iARB.address]);

      return { ...results, userIsolated, userNonIsolated };
    }

    async function fixtureIsolationPrepareBorrow() {
      const results = await loadFixture(fixtureIsolationBase);

      const {
        controllerV2,
        accounts,
        userIsolated,
        userNonIsolated,
        iUSDC,
        iUSDT,
        iARB,
        iUSDx,
      } = results;

      const userDeposited = accounts[10];
      const supplyAmount = "500000";
      const collateralRawAmount = "1000";
      const collateralAmount = ethers.utils.parseUnits(collateralRawAmount, 18);

      // deposits these two borrowable assets in the isolation mode.
      await iUSDC
        .connect(userDeposited)
        .mint(userDeposited.address, ethers.utils.parseUnits(supplyAmount, 6));

      await iUSDT
        .connect(userDeposited)
        .mint(userDeposited.address, ethers.utils.parseUnits(supplyAmount, 6));

      await iARB
        .connect(userIsolated)
        .mint(userIsolated.address, collateralAmount);

      await controllerV2.connect(userNonIsolated).enterMarkets([iUSDx.address]);
      await iUSDx
        .connect(userNonIsolated)
        .mint(userNonIsolated.address, collateralAmount);

      return { ...results, collateralAmount };
    }

    async function fixtureIsolationPrepareRepay() {
      const results = await loadFixture(fixtureIsolationPrepareBorrow);

      const { userIsolated, userNonIsolated, iUSDC } = results;

      const borrowAmount = utils.parseUnits("100", 6);
      await iUSDC.connect(userIsolated).borrow(borrowAmount);
      await iUSDC.connect(userNonIsolated).borrow(borrowAmount);

      return { ...results };
    }

    async function fixtureIsolationPrepareLiquidate() {
      const results = await loadFixture(fixtureIsolationPrepareRepay);

      const priceOracle = results.priceOracle;
      const user0 = results.accounts[0];

      // decrease the price of the collteral asset to make shortfall.
      const currentPrice = await priceOracle.getUnderlyingPrice(iARB.address);
      let newPrice = currentPrice.div(10);
      await priceOracle._setPendingAnchor(iARB.address, newPrice);
      await priceOracle.setPrice(iARB.address, newPrice);

      let userEquityDetails = await controllerV2.calcAccountEquity(
        user0.address
      );
      // User0 should have shortfall at now.
      expect(userEquityDetails[1]).to.gt(0);

      return { ...results };
    }

    describe("enterMarkets/exitMarkets", async function () {
      beforeEach(async function () {
        ({
          controllerV2,
          iARB,
          iOP,
          iUSDx,
          iUSDC,
          iETH,
          userIsolated,
          userNonIsolated,
        } = await loadFixture(fixtureIsolationBase));

        debtCeilingDecimals = await controllerV2.DEBT_CEILING_DECIMALS();
      });

      it("CONV2-ENTRM-0: Should revert when entering non-isolated market in isolation mode", async function () {
        // Fail cause can not enter market with another collateral in the isolation mode.
        await expect(
          controllerV2.connect(userIsolated).enterMarkets([iUSDx.address])
        ).to.revertedWith(
          "_enterMarket: can only have one isolated collateral!"
        );
      });

      it("CONV2-ENTRM-0: Should revert when entering another isolated market in isolation mode", async function () {
        // Fail cause can not enter market with another collateral in the isolation mode.
        await expect(
          controllerV2.connect(userIsolated).enterMarkets([iOP.address])
        ).to.revertedWith(
          "_enterMarket: can only have one isolated collateral!"
        );
      });

      it("CONV2-ENTRM-1: should revert when entering isolated market with other non-isolated collaterals", async function () {
        // Enter market with non-isolated asset.
        await controllerV2
          .connect(userNonIsolated)
          .enterMarkets([iUSDx.address]);

        // Fail cause already has a non-isolated asset as collateral.
        await expect(
          controllerV2.connect(userNonIsolated).enterMarkets([iARB.address])
        ).to.revertedWith(
          "_enterMarket: can only have one isolated collateral!"
        );
      });

      it("CONV2-ENTRM-2: Should enter multiple non-isolated markets", async function () {
        await controllerV2
          .connect(userNonIsolated)
          .enterMarkets([iUSDC.address, iETH.address, iUSDx.address]);

        userIsolatedIsolationModeDetails =
          await controllerV2.getIsolationModeState(userNonIsolated.address);
        expect(userIsolatedIsolationModeDetails[0]).to.be.false;

        expect(
          (await controllerV2.getEnteredMarkets(userNonIsolated.address)).length
        ).to.equal(3);
      });

      it("CONV2-ENTRM-3: Should enter isolated market", async function () {
        // Enter market with isolated asset.
        await controllerV2
          .connect(userNonIsolated)
          .enterMarkets([iARB.address]);

        userIsolatedIsolationModeDetails =
          await controllerV2.getIsolationModeState(userNonIsolated.address);
        expect(userIsolatedIsolationModeDetails[0]).to.be.true;
      });

      it("Should exit isolated market", async function () {
        let userIsolatedIsolationModeDetails =
          await controllerV2.getIsolationModeState(userIsolated.address);
        // userIsolated is in the isolation mode
        expect(userIsolatedIsolationModeDetails[0]).to.be.true;

        // Exist market with isolated asset.
        await controllerV2.connect(userIsolated).exitMarkets([iARB.address]);

        userIsolatedIsolationModeDetails =
          await controllerV2.getIsolationModeState(userIsolated.address);
        // userIsolated is not in the isolation mode
        expect(userIsolatedIsolationModeDetails[0]).to.be.false;
      });
    });

    describe("beforeBorrow", async function () {
      let collateralAmount;
      let debtCeiling, currentDebt;

      beforeEach(async function () {
        ({ collateralAmount, iUSDC, USDC, iUSDx, USDx, userIsolated } =
          await loadFixture(fixtureIsolationPrepareBorrow));

        const iARBDetails = await controllerV2.marketsV2(iARB.address);
        debtCeilingDecimals = await controllerV2.DEBT_CEILING_DECIMALS();

        debtCeiling = iARBDetails.debtCeiling;
        currentDebt = iARBDetails.currentDebt;
      });

      it("CONV2-BBRW-0: Should call the v1 logic, check the non-listed token", async function () {
        await verifyNonlistediToken(controllerV2, "beforeBorrow", [
          userIsolated.address,
          utils.parseEther("1"),
        ]);
      });

      it("CONV2-BBRW-1: Should check whether it is borrowable if in isolation mode", async function () {
        const iUSDxDetails = await controllerV2.marketsV2(iUSDx.address);
        // iUSDx is not a isolated asset.
        expect(iUSDxDetails.borrowableInIsolation).to.be.false;

        await expect(iUSDx.connect(userIsolated).borrow("100")).to.revertedWith(
          "beforeBorrow: Invalid to borrow in isolation mode!"
        );
      });

      it("CONV2-BBRW-2: Should check the debt ceiling if in isolation mode", async function () {
        // Minimum borrowed amount that will exceed debt ceiling.
        let rawBorrowAmount = debtCeiling.sub(currentDebt).add("1");
        let actualBorrowAmount = utils.parseUnits(
          rawBorrowAmount.toString(),
          6 - debtCeilingDecimals
        );

        // Make sure user have enough collateral
        await iARB
          .connect(userIsolated)
          .mint(
            userIsolated.address,
            utils.parseUnits(
              rawBorrowAmount.mul(2).toString(),
              18 - debtCeilingDecimals
            )
          );

        await expect(
          iUSDC.connect(userIsolated).borrow(actualBorrowAmount)
        ).to.revertedWith("beforeBorrow: Isolation debt ceiling exceeded!");
      });

      it("CONV2-BBRW-3: debt should accumulated correctly in isolation mode", async function () {
        // In the isolation mode, can borrow borrowable asset.
        let rawBorrowAmount = "100";
        let borrowAmount = ethers.utils.parseUnits(rawBorrowAmount, 6);
        let beforeBorrowedDetails = await controllerV2.marketsV2(iARB.address);

        await expect(() =>
          iUSDC.connect(userIsolated).borrow(borrowAmount)
        ).to.changeTokenBalance(USDC, userIsolated, borrowAmount);

        // When borrow in isolation mode, debt ceiling against collateral should increase.
        let afterBorrowedDetails = await controllerV2.marketsV2(iARB.address);
        expect(
          afterBorrowedDetails.currentDebt.sub(
            beforeBorrowedDetails.currentDebt
          )
        ).to.eq(ethers.utils.parseUnits(rawBorrowAmount, debtCeilingDecimals));
      });

      it("CONV2-BBRW-4: Should borrow up to collateral factor(distinguished from liquidation threshold)", async function () {
        const equity = (
          await controllerV2.calcAccountEquity(userIsolated.address)
        )[0];
        // console.log(equity.toString());

        const borrowAmount = equity.div(utils.parseUnits("1", 36 - 6));
        const ltv = await controllerV2.getLTV(iARB.address);
        expect(equity).to.eq(collateralAmount.mul(ltv));

        await expect(() =>
          iUSDC.connect(userIsolated).borrow(borrowAmount)
        ).to.changeTokenBalance(USDC, userIsolated, borrowAmount);

        await expect(iUSDC.connect(userIsolated).borrow(1)).to.revertedWith(
          "Account has some shortfall"
        );
      });

      it("CONV2-BBRW-6: Non-isolated borrower should borrow as before)", async function () {
        // Borrow non-borrowable
        let borrowAmount = utils.parseUnits("1", 0);

        await expect(() =>
          iUSDx.connect(userNonIsolated).borrow(borrowAmount)
        ).to.changeTokenBalance(USDx, userNonIsolated, borrowAmount);

        // Borrow more than debt ceiling
        let rawBorrowAmount = debtCeiling.sub(currentDebt);
        await iUSDx
          .connect(userNonIsolated)
          .mint(
            userNonIsolated.address,
            utils.parseUnits(
              rawBorrowAmount.mul(2).toString(),
              18 - debtCeilingDecimals
            )
          );
        borrowAmount = rawBorrowAmount.mul(
          utils.parseUnits("1", 6 - debtCeilingDecimals)
        );

        // The borrowing dit not revet, held by time lock delay
        // await expect(
        //   iUSDC.connect(userNonIsolated).borrow(borrowAmount)
        // ).to.changeTokenBalance(iUSDC, userNonIsolated, borrowAmount);

        await iUSDC.connect(userNonIsolated).borrow(borrowAmount);
      });
    });

    describe("afterRepayBorrow", function () {
      let currentDebt;

      beforeEach(async function () {
        ({
          controllerV2,
          USDC,
          iUSDC,
          iARB,
          userIsolated,
          userNonIsolated,
          accounts,
        } = await loadFixture(fixtureIsolationPrepareRepay));

        rawRepayAmount = "10";
        repayAmount = utils.parseUnits(rawRepayAmount, 6);

        let beforeIsolatedCollateralDetails = await controllerV2.marketsV2(
          iARB.address
        );

        currentDebt = beforeIsolatedCollateralDetails.currentDebt;
        debtCeilingDecimals = await controllerV2.DEBT_CEILING_DECIMALS();
      });

      it("CONV2-ARPB-0: Should call the v1 logic, check the non-listed token", async function () {
        await verifyNonlistediToken(controllerV2, "afterRepayBorrow", [
          userIsolated.address,
          userIsolated.address,
          utils.parseEther("1"),
        ]);
      });

      it("CONV2-ARPB-1: Should decrease debt for collateral if in isolation mode", async function () {
        // Repay in the isolation mode.
        await expect(() =>
          iUSDC.connect(userIsolated).repayBorrow(repayAmount)
        ).to.changeTokenBalance(USDC, userIsolated, repayAmount.mul("-1"));

        // When repay in isolation mode, current debt against collateral should decrease.
        let afterIsolatedCollateralDetails = await controllerV2.marketsV2(
          iARB.address
        );
        expect(
          currentDebt.sub(afterIsolatedCollateralDetails.currentDebt)
        ).to.eq(utils.parseUnits(rawRepayAmount, debtCeilingDecimals));
      });

      it("CONV2-ARPB-2: Should not decrease debt for collateral if not in isolation mode", async function () {
        // Repay in the isolation mode.
        await expect(() =>
          iUSDC.connect(userNonIsolated).repayBorrow(repayAmount)
        ).to.changeTokenBalance(USDC, userNonIsolated, repayAmount.mul("-1"));

        let afterIsolatedCollateralDetails = await controllerV2.marketsV2(
          iARB.address
        );
        expect(
          currentDebt.sub(afterIsolatedCollateralDetails.currentDebt)
        ).to.eq(0);
      });
      it("CONV2-ARPB-3: Should be able to repay all and decrease debt to zero in isolation mode", async function () {
        // Make the interest growing, so repayAmount > currentDebt
        await increaseTime(10 * 365 * 24 * 3600);

        const beforeBalance = await USDC.balanceOf(userIsolated.address);

        // Repay all in the isolation mode.
        await iUSDC
          .connect(userIsolated)
          .repayBorrow(ethers.constants.MaxUint256);

        const afterBalance = await USDC.balanceOf(userIsolated.address);

        const repayAmount = beforeBalance
          .sub(afterBalance)
          .div(ethers.utils.parseUnits("1", 6 - debtCeilingDecimals));

        // console.log(repayAmount.toString());

        expect(repayAmount).to.gt(currentDebt);

        // When repay in isolation mode, current debt against collateral should decrease.
        let afterIsolatedCollateralDetails = await controllerV2.marketsV2(
          iARB.address
        );
        expect(afterIsolatedCollateralDetails.currentDebt).to.eq(0);
      });
    });

    describe("beforeLiquidateBorrow", function () {
      beforeEach(async function () {
        ({ controllerV2, accounts, iUSDC, userIsolated } = await loadFixture(
          fixtureIsolationPrepareLiquidate
        ));
        rawRepayAmount = "10";
        repayAmount = utils.parseUnits(rawRepayAmount, 6);
        liquidator = accounts[5];

        debtCeilingDecimals = await controllerV2.DEBT_CEILING_DECIMALS();
      });

      it("CONV2-BLQDB-2: Liquidate isolated collateral, should decrease the debt", async function () {
        let beforeiARBDetails = await controllerV2.marketsV2(iARB.address);
        let debtChangedAmount = utils.parseUnits(
          rawRepayAmount,
          debtCeilingDecimals
        );

        // Liquidate user0 account
        await iUSDC
          .connect(liquidator)
          .liquidateBorrow(userIsolated.address, repayAmount, iARB.address);

        let afteriARBDetails = await controllerV2.marketsV2(iARB.address);
        // The debt celling against isolated asset should decrease.
        expect(
          beforeiARBDetails.currentDebt.sub(afteriARBDetails.currentDebt)
        ).to.eq(debtChangedAmount);
      });
    });
  });

  describe("Efficient Mode", function () {
    let controllerV2, accounts, interestRateModel, priceOracle;
    let userEmodeDefault, userEModeStableCoin, userLiquidated, userLiquidator;

    let iUSDx, iETH, iUSDC, iUSDT;

    let eModeLTV = utils.parseEther("0.97"); // 97%
    let eModeLiquidationThreshold = utils.parseEther("0.98"); //98%

    async function fixtureEModeBase() {
      const results = await loadFixture(fixtureV2);

      ({ controllerV2, iUSDx, iUSDT, iUSDC, iETH, accounts } = results);

      // There are three eMode types: default empty mode, stable coin mode and eth mode.
      // iUSDC, iUSDT already in emode 1
      // Add iETH to eMode 2: eth eMode
      await controllerV2._setEMode(
        iETH.address,
        2,
        eModeLTV,
        eModeLiquidationThreshold
      );

      const mintTokenAmount = "10000";
      const userDeposited = accounts[9];

      //  deposit some for borrow
      await iUSDx
        .connect(userDeposited)
        .mint(
          userDeposited.address,
          utils.parseEther(mintTokenAmount).mul(5000)
        );

      await iUSDT
        .connect(userDeposited)
        .mint(
          userDeposited.address,
          utils.parseUnits(mintTokenAmount, 6).mul(5000)
        );

      await iUSDC
        .connect(userDeposited)
        .mint(
          userDeposited.address,
          utils.parseUnits(mintTokenAmount, 6).mul(5000)
        );

      return { ...results };
    }

    async function fixtureEModeEntered() {
      const results = await loadFixture(fixtureEModeBase);

      const {
        controllerV2,
        accounts: [userEmodeDefault, userEModeStableCoin],
        iUSDx,
        iUSDC,
      } = results;

      const mintTokenAmount = "10000";

      for (const user of [userEmodeDefault, userEModeStableCoin]) {
        await iUSDC
          .connect(user)
          .mintForSelfAndEnterMarket(utils.parseUnits(mintTokenAmount, 6));

        // Just deposit not as collateral
        await iUSDx
          .connect(user)
          .mint(user.address, utils.parseEther(mintTokenAmount));
      }

      await controllerV2.connect(userEModeStableCoin).enterEMode(1);

      return { ...results, userEmodeDefault, userEModeStableCoin };
    }

    async function fixtureEModePrepareLiquidate() {
      const results = await loadFixture(fixtureEModeEntered);

      const {
        iUSDC,
        iUSDT,
        priceOracle,
        userEmodeDefault,
        userEModeStableCoin,
      } = results;

      const userLiquidator = results.accounts[10];

      let userEModeDefaultEquity = (
        await controllerV2.calcAccountEquity(userEmodeDefault.address)
      )[0];
      let userEModeStableCoinEquity = (
        await controllerV2.calcAccountEquity(userEModeStableCoin.address)
      )[0];

      // console.log(userEmodeDefault.toString());
      // console.log(userEModeStableCoin.toString());

      let borrowAmountEModeDefault = userEModeDefaultEquity.div(
        utils.parseUnits("1", 36 - 6)
      );
      let borrowAmountEModeStable = userEModeStableCoinEquity.div(
        utils.parseUnits("1", 36 - 6)
      );

      await iUSDT.connect(userEmodeDefault).borrow(borrowAmountEModeDefault);
      await iUSDT.connect(userEModeStableCoin).borrow(borrowAmountEModeStable);

      // default: cf = 0.9, lt = 0.9 * 1.03 = 0.927
      // stablecoin: cf = 0.97, lt = 0.98
      // a 5% price drop will cause both liquidable
      const orginalPrice = await priceOracle.getUnderlyingPrice(iUSDC.address);
      const liquidationPrice = orginalPrice.mul(95).div(100);
      await priceOracle._setPendingAnchor(iUSDC.address, liquidationPrice);
      await priceOracle.setPrice(iUSDC.address, liquidationPrice);

      return {
        ...results,
        borrowAmountEModeDefault,
        borrowAmountEModeStable,
        userEmodeDefault,
        userEModeStableCoin,
        userLiquidator,
        orginalPrice,
        liquidationPrice,
      };
    }

    describe("beforeBorrow", function () {
      beforeEach(async function () {
        ({ controllerV2, iETH, iUSDx, userEModeStableCoin } = await loadFixture(
          fixtureEModeEntered
        ));
      });
      it("CONV2-BBRW-4: Should not borrow other emode asset in certain emode", async function () {
        await expect(
          iETH.connect(userEModeStableCoin).borrow(1)
        ).to.be.revertedWith("beforeBorrow: Inconsistent eMode ID");

        await expect(
          iUSDx.connect(userEModeStableCoin).borrow(1)
        ).to.be.revertedWith("beforeBorrow: Inconsistent eMode ID");
      });
    });

    describe("enterEMode", function () {
      let eModeLength;

      beforeEach(async function () {
        ({ controllerV2, iUSDx, iUSDC, userEmodeDefault, userEModeStableCoin } =
          await loadFixture(fixtureEModeEntered));

        eModeLength = await controllerV2.getEModeLength();
      });

      it("CONV2-ENTREM-0: Should validate eMode ID", async function () {
        await expect(
          controllerV2.connect(userEmodeDefault).enterEMode(eModeLength)
        ).to.be.revertedWith("_validateEModeID: Invalid eMode ID!");
      });

      it("CONV2-ENTREM-1: Should set user eMode successfully when user has no borrows", async function () {
        expect(
          (await controllerV2.getBorrowedAssets(userEmodeDefault.address))
            .length
        ).to.eq(0);

        await controllerV2.connect(userEmodeDefault).enterEMode(1);
        expect(
          await controllerV2.accountsEMode(userEmodeDefault.address)
        ).to.eq(1);
      });

      it("CONV2-ENTREM-2: Should revert when borrowed some iToken of different eMode", async function () {
        // iUSDx is eMode 0
        await iUSDx.connect(userEmodeDefault).borrow(1000);

        await expect(
          controllerV2.connect(userEmodeDefault).enterEMode(1)
        ).to.be.revertedWith("enterEMode: has borrowed asset of other eMode!");
      });

      it("CONV2-ENTREM-3: Should be able to exit emode after borrowed some iToken of eMode", async function () {
        await iUSDC.connect(userEModeStableCoin).borrow(1000);

        await controllerV2.connect(userEModeStableCoin).enterEMode(0);
        expect(
          await controllerV2.accountsEMode(userEModeStableCoin.address)
        ).to.eq(0);
      });

      it("CONV2-ENTREM-4: Should not exits eMode if there will be a shortfall", async function () {
        const normalEquity = (
          await controllerV2.calcAccountEquity(userEmodeDefault.address)
        )[0];

        // borrow more than normal equity
        const borrowAmount = normalEquity
          .div(utils.parseUnits("1", 36 - 6))
          .add(100000);

        await expect(
          iUSDC.connect(userEmodeDefault).borrow(borrowAmount)
        ).to.be.revertedWith("Account has some shortfall");

        await iUSDC.connect(userEModeStableCoin).borrow(borrowAmount);

        // tries to exist in the eMode, will fail cause borrow more with eMode ltv.
        await expect(
          controllerV2.connect(userEModeStableCoin).enterEMode(0)
        ).to.be.revertedWith("enterEMode: Do not have enough equity!");
      });

      it("CONV2-ENTREM-5: Should be able to enter emode after borrowed some iToken of eMode", async function () {
        await iUSDC.connect(userEmodeDefault).borrow(1000);

        await controllerV2.connect(userEmodeDefault).enterEMode(1);
        expect(
          await controllerV2.accountsEMode(userEmodeDefault.address)
        ).to.eq(1);
      });

      // it("3. Should have a higher ltv When enter an eMode", async function () {
      //   let mintAmount = utils.parseEther("10000");
      //   let borrowAmount = utils.parseEther("100");
      //   let userNewEMode = 1;
      //   let user0EquityDetails = await controllerV2.calcAccountEquity(
      //     user0.address
      //   );
      //   expect(user0EquityDetails[0]).to.eq(0);
      //   expect(user0EquityDetails[1]).to.eq(0);
      //   let user1EquityDetails = await controllerV2.calcAccountEquity(
      //     user1.address
      //   );
      //   expect(user1EquityDetails[0]).to.eq(0);
      //   expect(user1EquityDetails[1]).to.eq(0);
      //   let iUSDxDetails = await controllerV2.marketsV2(iUSDx.address);
      //   expect(iUSDxDetails.eModeID).to.eq(userNewEMode);
      //   // User0 is not in any eMode.
      //   expect(await controllerV2.accountsEMode(user0.address)).to.eq(0);

      //   await miningAutomatically(false);
      //   // User0 supplies some iUSDx
      //   await iUSDx.connect(user0).mint(user0.address, mintAmount);
      //   // Use iUSDx as collateral
      //   await controllerV2.connect(user0).enterMarkets([iUSDx.address]);
      //   // Borrow iUSDx
      //   await iUSDx.connect(user0).borrow(borrowAmount);

      //   // User1 supplies some iUSDx
      //   await iUSDx.connect(user1).mint(user1.address, mintAmount);
      //   // Use iUSDx as collateral
      //   await controllerV2.connect(user1).enterMarkets([iUSDx.address]);
      //   // Borrow iUSDx and user1 is in the stable coin eMode
      //   await iUSDx.connect(user1).borrow(borrowAmount);

      //   await miningAutomatically(true);
      //   // Mine block
      //   // User1 enter eMode 1: stable coin eMode
      //   await controllerV2.connect(user1).enterEMode(userNewEMode);

      //   user0EquityDetails = await controllerV2.calcAccountEquity(
      //     user0.address
      //   );
      //   user1EquityDetails = await controllerV2.calcAccountEquity(
      //     user1.address
      //   );
      //   // User1 in the eMode, and user0 is not in the eMode
      //   // So user1 has a higher ltv and higher equity against collateral.
      //   expect(user1EquityDetails[0]).to.gt(user0EquityDetails[0]);
      // });
    });

    describe("beforeLiquidateBorrow", function () {
      let userEmodeDefault, userEModeStableCoin, userLiquidator;
      let borrowAmountEModeDefault, borrowAmountEModeStable;
      let orginalPrice, priceOracle;

      beforeEach(async function () {
        ({
          controllerV2,
          iUSDC,
          iUSDT,
          borrowAmountEModeDefault,
          borrowAmountEModeStable,
          userEmodeDefault,
          userEModeStableCoin,
          userLiquidator,
          priceOracle,
          orginalPrice,
        } = await loadFixture(fixtureEModePrepareLiquidate));
      });

      it("CONV2-BLQDB-0: Should use the liquidation threshold", async function () {
        // cf : 0.9 * 0.971 = 0.8739
        // lq : 0.927 * 0.971 = 0.9001
        // Slightly above the liquidation threshold
        const newPrice = orginalPrice.mul(971).div(1000);
        await priceOracle._setPendingAnchor(iUSDC.address, newPrice);
        await priceOracle.setPrice(iUSDC.address, newPrice);

        // Can not borrow
        await expect(
          iUSDT.connect(userEmodeDefault).borrow(0)
        ).to.be.revertedWith("Account has some shortfall");

        // Nor liquidate
        await expect(
          iUSDT
            .connect(userLiquidator)
            .liquidateBorrow(
              userEmodeDefault.address,
              borrowAmountEModeDefault.div(3),
              iUSDC.address
            )
        ).to.be.revertedWith("Account does not have shortfall");
      });

      it("CONV2-BLQDB-0: Should use the emode liquidation threshold", async function () {
        // cf : 0.97 * 0.99 = 0.9603
        // lq : 0.98 * 0.99 = 0.9702 > 0.97
        // Slightly above the liquidation threshold
        const newPrice = orginalPrice.mul(99).div(100);
        await priceOracle._setPendingAnchor(iUSDC.address, newPrice);
        await priceOracle.setPrice(iUSDC.address, newPrice);

        // Can not borrow
        await expect(
          iUSDT.connect(userEModeStableCoin).borrow(0)
        ).to.be.revertedWith("Account has some shortfall");

        // Nor liquidate
        await expect(
          iUSDT
            .connect(userLiquidator)
            .liquidateBorrow(
              userEModeStableCoin.address,
              borrowAmountEModeStable.div(3),
              iUSDC.address
            )
        ).to.be.revertedWith("Account does not have shortfall");
      });

      async function verifyCloseFactor(
        iToken,
        user,
        liquidator,
        maxRepay,
        collateral
      ) {
        await expect(
          iToken
            .connect(liquidator)
            .liquidateBorrow(user.address, maxRepay.add(1), collateral.address)
        ).to.be.revertedWith("Repay exceeds max repay allowed");

        await iUSDT
          .connect(liquidator)
          .liquidateBorrow(user.address, maxRepay, collateral.address);
      }

      it("CONV2-BLQDB-1: user emode 0, collateral emode 0, should use default close factor", async function () {
        const maxRepay = borrowAmountEModeDefault.mul(5).div(10);

        await verifyCloseFactor(
          iUSDT,
          userEmodeDefault,
          userLiquidator,
          maxRepay,
          iUSDx
        );
      });

      it("CONV2-BLQDB-1: user emode 0, collateral emode 1, should use default close factor", async function () {
        const maxRepay = borrowAmountEModeDefault.mul(5).div(10);

        await verifyCloseFactor(
          iUSDT,
          userEmodeDefault,
          userLiquidator,
          maxRepay,
          iUSDC
        );
      });

      it("CONV2-BLQDB-1: user emode 1, collateral emode 1, should use emode close factor", async function () {
        const maxRepay = borrowAmountEModeStable.mul(4).div(10);

        // user emode 0, collateral emode 1, to use emode close factor
        await verifyCloseFactor(
          iUSDT,
          userEModeStableCoin,
          userLiquidator,
          maxRepay,
          iUSDC
        );
      });

      it("CONV2-BLQDB-1: user emode 1, collateral emode 0, should use default close factor", async function () {
        const maxRepay = borrowAmountEModeStable.mul(5).div(10);

        await verifyCloseFactor(
          iUSDT,
          userEModeStableCoin,
          userLiquidator,
          maxRepay,
          iUSDx
        );
      });
    });

    describe("calcAccountEquityWithEffectV2", function () {
      let userEmodeDefault, userEModeStableCoin;
      const borrowAmount = "1000";

      beforeEach(async function () {
        ({ controllerV2, iUSDC, iUSDT, userEmodeDefault, userEModeStableCoin } =
          await loadFixture(fixtureEModeEntered));
      });

      testCases = [
        {
          title: "CONV2-CALCEQT-0: Should use default ltv",
          equityExp: utils.parseUnits("8000", 36), // 10000 * 0.9 - 1000
          getArgs: () => [
            userEmodeDefault.address,
            ethers.constants.AddressZero,
            0,
            0,
            false,
          ],
        },
        {
          title: "CONV2-CALCEQT-1: Should use default liquidation threshold",
          equityExp: utils.parseUnits("8270", 36), // 10000 * 0.927 - 1000
          getArgs: () => [
            userEmodeDefault.address,
            ethers.constants.AddressZero,
            0,
            0,
            true,
          ],
        },
        {
          title: "CONV2-CALCEQT-2: Should use emode ltv",
          equityExp: utils.parseUnits("9700", 36), // 10000 * 0.97 - 1000
          getArgs: () => [
            userEModeStableCoin.address,
            ethers.constants.AddressZero,
            0,
            0,
            false,
          ],
        },
        {
          title: "CONV2-CALCEQT-3: Should use emode liquidation threshold",
          equityExp: utils.parseUnits("9800", 36), // 10000 * 0.98 - 1000
          getArgs: () => [
            userEModeStableCoin.address,
            ethers.constants.AddressZero,
            0,
            0,
            true,
          ],
        },
      ];

      testCases.forEach((testCase) => {
        it(`${testCase.title}`, async function () {
          // just borrow before the `calcAccountEquityWithEffectV2` call to avoid interest
          await iUSDC
            .connect(userEmodeDefault)
            .borrow(utils.parseUnits(borrowAmount, 6));

          const [equity] = await controllerV2.calcAccountEquityWithEffectV2(
            ...testCase.getArgs()
          );

          expect(equity).to.equal(testCase.equityExp);
        });
      });
    });

    describe("liquidateCalculateSeizeTokensV2", function () {
      let userEmodeDefault, userEModeStableCoin;
      let liquidationPrice;
      let repayAmount;

      beforeEach(async function () {
        ({
          controllerV2,
          mockPriceOracle,
          iUSDC,
          iUSDT,
          userEmodeDefault,
          userEModeStableCoin,
          userLiquidator,
          liquidationPrice,
        } = await loadFixture(fixtureEModePrepareLiquidate));

        repayAmount = utils.parseUnits("1000", 6);
      });

      it("CONV2-CALCSEIZE-0: Should use default liquidation incentive", async function () {
        // default liquidation incentive is 1.1
        const seizeAmount = repayAmount
          .mul(utils.parseUnits("1", 36 - 6)) // USDT Price
          .mul(11)
          .div(liquidationPrice)
          .div(10);

        await expect(
          iUSDT
            .connect(userLiquidator)
            .liquidateBorrow(
              userEmodeDefault.address,
              repayAmount,
              iUSDC.address
            )
        ).to.changeTokenBalances(
          iUSDC,
          [userLiquidator, userEmodeDefault],
          [seizeAmount, seizeAmount.mul(-1)]
        );
      });
      it("CONV2-CALCSEIZE-1: Should use emode liquidation incentive", async function () {
        // emode liquidation incentive is 1.01
        const seizeAmount = repayAmount
          .mul(101)
          .mul(utils.parseUnits("1", 36 - 6)) // USDT Price
          .div(100)
          .div(liquidationPrice);

        await expect(
          iUSDT
            .connect(userLiquidator)
            .liquidateBorrow(
              userEModeStableCoin.address,
              repayAmount,
              iUSDC.address
            )
        ).to.changeTokenBalances(
          iUSDC,
          [userLiquidator, userEModeStableCoin],
          [seizeAmount, seizeAmount.mul(-1)]
        );
      });
      it("CONV2-CALCSEIZE-2: Should use default liquidation incentive when seize collateral is not the same emode", async function () {
        // emode liquidation incentive is 1.1
        const seizeAmount = repayAmount
          .mul(11)
          .mul(utils.parseUnits("1", 36 - 6)) // USDT Price
          .div(10)
          .div(utils.parseUnits("1", 36 - 18)); // USDX Price

        await expect(
          iUSDT
            .connect(userLiquidator)
            .liquidateBorrow(
              userEModeStableCoin.address,
              repayAmount,
              iUSDx.address
            )
        ).to.changeTokenBalances(
          iUSDx,
          [userLiquidator, userEModeStableCoin],
          [seizeAmount, seizeAmount.mul(-1)]
        );
      });
      it("CONV2-CALCSEIZE-3: Should check the oracle status", async function () {
        await controllerV2._setPriceOracle(mockPriceOracle.address);

        await setOraclePrices(
          mockPriceOracle,
          [iUSDT, iUSDx],
          [1, 1],
          [true, false]
        );

        await expect(
          controllerV2.liquidateCalculateSeizeTokensV2(
            iUSDT.address,
            iUSDx.address,
            repayAmount,
            userEModeStableCoin.address
          )
        ).to.be.revertedWith("Borrowed or Collateral asset price is invalid");

        await setOraclePrices(
          mockPriceOracle,
          [iUSDT, iUSDx],
          [1, 1],
          [false, true]
        );

        await expect(
          controllerV2.liquidateCalculateSeizeTokensV2(
            iUSDT.address,
            iUSDx.address,
            repayAmount,
            userEModeStableCoin.address
          )
        ).to.be.revertedWith("Borrowed or Collateral asset price is invalid");
      });
    });

    describe("getCollateralFactor", function () {
      let ltv, lt, eltv, elt;
      let iUSDC;
      let collateralFactor;

      let iTokenEmodes = [0, 1, 2, 3, 4];
      let userEModes = [0, 1, 2, 3, 4];
      let liquidations = [false, true];

      async function fixtureEModeGetCollateralFactor() {
        const results = await loadFixture(fixtureV2);

        // const {
        //   controllerV2,
        //   accounts: [
        //     userEmodeDefault,
        //     userEModeStableCoin,
        //     userEModeETH,
        //     userEModeBTC,
        //   ],
        //   iETH,
        //   iWBTC,
        // } = results;

        // const emodeUsers = [
        //   userEmodeDefault,
        //   userEModeStableCoin,
        //   userEModeETH,
        //   userEModeBTC,
        // ];

        // await controllerV2._addEMode(
        //   ethers.utils.parseEther("1.01"), // liquidationIncentive
        //   ethers.utils.parseEther("0.4"), // closeFactor
        //   "BTC" // label
        // );

        // await controllerV2._setEMode(
        //   iETH.address,
        //   2, // ETH
        //   eModeLTV,
        //   eModeLiquidationThreshold
        // );

        // await controllerV2._setEMode(
        //   iWBTC.address,
        //   3, // BTC
        //   eModeLTV,
        //   eModeLiquidationThreshold
        // );

        // await controllerV2.connect(userEModeStableCoin).enterEMode(1);
        // await controllerV2.connect(userEModeETH).enterEMode(2);
        // await controllerV2.connect(userEModeBTC).enterEMode(3);

        return { ...results };
      }

      before(async function () {
        ({ controllerV2, iUSDC } = await loadFixture(
          fixtureEModeGetCollateralFactor
        ));

        ltv = await controllerV2.getLTV(iUSDC.address);
        lt = await controllerV2.getLiquidationThreshold(iUSDC.address);
        eltv = await controllerV2.getEModeLTV(iUSDC.address);
        elt = await controllerV2.getEModeLiquidationThreshold(iUSDC.address);
      });

      userEModes.forEach((userEmode) => {
        iTokenEmodes.forEach((iTokenEmode) => {
          liquidations.forEach((isLiquidation) => {
            let collaterFactorStr;

            if (iTokenEmode == userEmode && userEmode > 0) {
              if (isLiquidation) {
                collaterFactorStr = "eModeLiquidationThreshold";
              } else {
                collaterFactorStr = "eModeLTV";
              }
            } else {
              if (isLiquidation) {
                collaterFactorStr = "LiquidationThreshold";
              } else {
                collaterFactorStr = "LTV";
              }
            }

            it(`user emode ${userEmode}, iToken emode ${iTokenEmode}, ${isLiquidation} => ${collaterFactorStr}`, async function () {
              const actualCollateralFactor =
                await controllerV2.getCollateralFactor(
                  iUSDC.address,
                  userEmode,
                  iTokenEmode,
                  isLiquidation
                );

              if (iTokenEmode == userEmode && userEmode > 0) {
                if (isLiquidation) {
                  collateralFactor = elt;
                } else {
                  collateralFactor = eltv;
                }
              } else {
                if (isLiquidation) {
                  collateralFactor = lt;
                } else {
                  collateralFactor = ltv;
                }
              }

              // console.log(actualCollateralFactor);
              // console.log(collateralFactor);

              expect(actualCollateralFactor).to.equal(collateralFactor);
            });
          });
        });
      });
    });
  });

  describe("Borrow/Withdraw delay", function () {
    describe("beforeTransferUnderlying", function () {
      it("CONV2-BTRSFUNDL-0, should fail in beforeTransferUnderlying() when caller is not iToken", async function () {
        const { controllerV2, iUSDx, USDx, owner } = await loadFixture(
          fixtureV2
        );

        await expect(
          controllerV2.beforeTransferUnderlying(
            iUSDx.address, // _iToken
            USDx.address, // _underlying
            utils.parseEther("1000"), // _amount
            owner.address // _recipient
          )
        ).to.be.revertedWith("sender must be iToken");

        await expect(
          controllerV2.beforeTransferUnderlying(
            owner.address, // _iToken
            USDx.address, // _underlying
            utils.parseEther("1000"), // _amount
            owner.address // _recipient
          )
        ).to.be.revertedWith("sender must be iToken");
      });
    });
  });
});
