const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  getBlock,
  getChainId,
  increaseBlock,
  increaseTime,
  fixtureDefault,
  deployiToken,
  deployNonListed,
} = require("../helpers/fixtures.js");

const {
  getMaxRedeemable,
  getMaxBorrowable,
  executeAndVerify,
} = require("../helpers/contractData.js");
const { setOraclePrices, parseTokenAmount } = require("../helpers/utils.js");
const abiCoder = new ethers.utils.AbiCoder();

const BASE = ethers.utils.parseEther("1");
const maxAmount = ethers.constants.MaxUint256;

let iToken, iUSDT, nonListediToken, controller, interestRateModel;
let underlying, USDT;
let users, user1, user2, user3, user4, owner;
let oracle;
let flashloanExecutor, flashloanExecutorFailure;
let iTokenDecimals, iUSDTDecimals;
let actualiTokenMintAmount, actualiUSDTMintAmount;

describe("iToken", async function () {
  const rawMintAmount = ethers.BigNumber.from("500");
  const rawBorrowAmout = ethers.BigNumber.from("300");
  const rawLiquidateAmount = ethers.BigNumber.from("90");
  const rawRapyAmount = ethers.BigNumber.from("20");
  let mintAmount = ethers.utils.parseEther("500");
  let redeemAmount = ethers.utils.parseEther("100");
  let borrowAmount = ethers.utils.parseEther("300");
  let repayAmount = ethers.utils.parseEther("50");
  let liquidateAmount = ethers.utils.parseEther("90");
  let flashloanAmount = ethers.utils.parseEther("100");

  async function init() {
    ({
      controller: controller,
      owner: owner,
      iUSDx: iToken,
      USDx: underlying,
      iUSDT: iUSDT,
      USDT: USDT,
      interestRateModel: interestRateModel,
      accounts: users,
      flashloanExecutor: flashloanExecutor,
      flashloanExecutorFailure: flashloanExecutorFailure,
      priceOracle: oracle,
      nonListediToken: nonListediToken,
    } = await loadFixture(fixtureDefault));
    [user1, user2, user3, user4] = users;
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
  }

  describe.skip("Test all scenarios for Flashloan", async function () {
    before(async function () {
      // Initialize environments.
      await init();
    });

    it("Generate a flashloan as expected", async function () {
      // user1 mints iToken.
      await expect(() =>
        iToken.connect(user1).mint(user1.address, mintAmount)
      ).to.changeTokenBalance(iToken, user1, mintAmount);

      const flashloanFeeRate = await iToken.flashloanFeeRatio();
      const flashloanFeeAmount = flashloanFeeRate
        .mul(flashloanAmount)
        .div(BASE);
      const expectRepayAmount = flashloanFeeAmount;

      // add enough undelying token to the flashloan executor contract to repay.
      await underlying
        .connect(user1)
        .transfer(flashloanExecutor.address, flashloanAmount);

      const beforeiTokenCash = await iToken.getCash();
      const beforeExchangeRate = await iToken.exchangeRateStored();
      // execute flashloan.
      await iToken
        .connect(user1)
        .flashloan(flashloanExecutor.address, flashloanAmount, "0x");
      const afteriTokenCash = await iToken.getCash();
      await iToken.connect(user1).exchangeRateCurrent();
      const afterExchangeRate = await iToken.exchangeRateStored();

      expect(afteriTokenCash.sub(beforeiTokenCash)).to.equal(expectRepayAmount);
      expect(afterExchangeRate).to.gt(beforeExchangeRate);
    });

    it("Should revert due to borrow too much cash", async function () {
      const iTokenCurrentCash = await iToken.getCash();
      const flashloanAmount = iTokenCurrentCash.mul(2);
      // execute flashloan.
      await expect(
        iToken
          .connect(user1)
          .flashloan(flashloanExecutor.address, flashloanAmount, "0x")
      ).to.be.revertedWith("SafeMath: subtraction overflow");
    });

    it("Should revert due to borrow too small", async function () {
      // only borrow 9 wei.
      const flashloanAmount = "9";
      await expect(
        iToken
          .connect(user1)
          .flashloan(flashloanExecutor.address, flashloanAmount, "0x")
      ).to.be.revertedWith(
        "flashloanInternal: Request amount is too small for a flashloan!"
      );
    });

    // // TODO:
    // it("Should revert due to controller refuses", async function () {
    //   await expect(
    //     iToken
    //       .connect(user1)
    //       .flashloan(flashloanExecutor.address, flashloanAmount, "0x")
    //   ).to.be.revertedWith(
    //     "flashloanInternal: Controller refuses to make a flashloan!"
    //   );
    // });

    it("Should revert due to do not repay enough", async function () {
      const iTokenCurrentCash = await iToken.getCash();
      await expect(
        iToken
          .connect(user1)
          .flashloan(flashloanExecutorFailure.address, iTokenCurrentCash, "0x")
      ).to.be.revertedWith("flashloanInternal: Fail to repay borrow with fee!");
    });

    // // TODO:
    // it("Should revert due to controller fails to verify", async function () {
    //   await expect(
    //     iToken
    //       .connect(user1)
    //       .flashloan(flashloanExecutor.address, flashloanAmount, "0x")
    //   ).to.be.revertedWith(
    //     "flashloanInternal: Controller can not verify the flashloan!"
    //   );
    // });
  });

  describe("Test all scenarios for Mint", async function () {
    before(async function () {
      // Initialize environments.
      await init();
    });

    it("ITKN-MINT-0: Should mint correctly when exchange rate is equal to 1", async function () {
      let beforeCash = await iToken.getCash();

      // first time to mint, and no borrow, so the exchange rate of iToken should be 1.
      await expect(() =>
        iToken.connect(user1).mint(user1.address, mintAmount)
      ).to.changeTokenBalance(iToken, user1, mintAmount);

      let afterCash = await iToken.getCash();
      expect(afterCash.sub(beforeCash)).to.equal(mintAmount);

      beforeCash = afterCash;
      await expect(() =>
        iToken.connect(user1).mint(user1.getAddress(), mintAmount)
      ).to.changeTokenBalances(
        underlying,
        [user1, iToken],
        [mintAmount.mul(-1), mintAmount]
      );

      afterCash = await iToken.getCash();
      expect(afterCash.sub(beforeCash)).to.equal(mintAmount);
    });

    it("ITKN-MINT-1: Should mint for another account", async function () {
      // deposit account mint for another account.
      await expect(() =>
        iToken.connect(user1).mint(user3.address, mintAmount)
      ).to.changeTokenBalance(iToken, user3, mintAmount);

      await expect(() =>
        iToken.connect(user1).mint(user3.address, mintAmount)
      ).to.changeTokenBalance(underlying, user1, mintAmount.mul(-1));
    });

    it("ITKN-MINT-2: Should mint correctly when exchange rate is greater than 1", async function () {
      // In order to make exchange rate is greater than 1, must have a user to borrow cash and update exchange rate.
      // User2 supply WBTC, enter the market with WBTC and then borrow USDT.

      // First time to mint, and no borrow, so the exchange rate of the iUSDT should be 1.
      await expect(() =>
        iUSDT.connect(user2).mint(user2.address, actualiUSDTMintAmount)
      ).to.changeTokenBalance(iUSDT, user2, actualiUSDTMintAmount);

      // Use the iUSDT as a collateral.
      await controller.connect(user2).enterMarkets([iUSDT.address]);

      await iToken.connect(user2).exchangeRateCurrent();
      const beforeExchangeRate = await iToken.exchangeRateStored();
      // Borrow the iToken.
      await expect(() =>
        iToken.connect(user2).borrow(borrowAmount)
      ).to.changeTokenBalance(underlying, user2, borrowAmount);

      // Try to mint when exchange rate is greater than 1.

      const action = {
        target: iToken,
        executor: user1,
        func: "mint",
        args: [user1.address, mintAmount],
      };
      await executeAndVerify(action, [iToken], [user1.address]);

      const afterExchangeRate = await iToken.exchangeRateStored();
      expect(afterExchangeRate).to.gt(beforeExchangeRate);
    });

    it("ITKN-MINT-3: Should revert due to user do not approve(enough)", async function () {
      // Do not approve.
      await underlying.connect(user1).approve(iToken.address, "0");
      await expect(
        iToken.connect(user1).mint(user1.address, mintAmount)
      ).to.be.revertedWith("SafeMath: subtraction overflow");

      // Approve less than mint amount.
      const approvedAmount = mintAmount.div("2");
      await underlying.connect(user1).approve(iToken.address, approvedAmount);
      await expect(
        iToken.connect(user1).mint(user1.address, approvedAmount.add(1))
      ).to.be.revertedWith("SafeMath: subtraction overflow");
    });

    it("ITKN-MINT-4: Should revert due to user do not have enough underlying token", async function () {
      const user2UnderlyingBalance = await underlying.balanceOf(user2.address);

      await expect(
        iToken.connect(user2).mint(user2.address, user2UnderlyingBalance.mul(2))
      ).to.be.revertedWith("SafeMath: subtraction overflow");
    });

    it("ITKN-MINT-5: Should revert due to iToken not listed", async function () {
      await expect(
        nonListediToken.connect(user2).mint(user2.address, mintAmount)
      ).to.be.revertedWith("Token has not been listed");
    });

    // // TODO: mintInternal: Controller refuses to mint!
    // it("Should revert due to controller refuse to mint", async function () {
    //   await expect(
    //     iToken.connect(user2).mint(user2.address, mintAmount)
    //   ).to.be.revertedWith("mintInternal: Controller refuses to mint!");
    // });

    // // TODO: "mintInternal: Controller fails to verify mint!"
    // it("Should revert due to controller refuse to verify mint", async function () {
    //   await expect(
    //     iToken.connect(user2).mint(user2.address, mintAmount)
    //   ).to.be.revertedWith("mintInternal: Controller fails to verify mint!");
    // });
  });

  describe("Test all scenarios for Redeem", async function () {
    before(async function () {
      // Initialize environments.
      await init();
    });

    it("ITKN-REDM-0: Should redeem from userself normally", async function () {
      // redeem
      let action = {
        target: iToken,
        executor: user1,
        func: "redeem",
        args: [user1.address, redeemAmount],
      };
      await executeAndVerify(action, [iToken], [user1.address]);

      // redeemUnderlying.
      action = {
        target: iToken,
        executor: user1,
        func: "redeemUnderlying",
        args: [user1.address, redeemAmount],
      };
      await executeAndVerify(action, [iToken], [user1.address]);
    });

    // it("Should revert due to controller refuse", async function () {
    //   await expect(
    //     iToken.connect(user1).redeem(user1.address, redeemAmount)
    //   ).to.be.revertedWith("redeemInternal: Controller refuses to redeem!");

    //   await expect(
    //     iToken.connect(user1).redeemUnderlying(user1.address, redeemAmount)
    //   ).to.be.revertedWith("redeemInternal: Controller refuses to redeem!");
    // });

    // it("Should revert due to controller can not verify", async function () {
    //   await expect(
    //     iToken.connect(user1).redeem(user1.address, redeemAmount)
    //   ).to.be.revertedWith("redeemInternal: Controller fails to verify redeem!");

    //   await expect(
    //     iToken.connect(user1).redeemUnderlying(user1.address, redeemAmount)
    //   ).to.be.revertedWith("redeemInternal: Controller fails to verify redeem!");
    // });

    it("ITKN-REDM-1: Should revert due to exceed allowance", async function () {
      const redeemAmount = 1;

      await expect(
        iToken.connect(user3).redeem(user1.address, redeemAmount)
      ).to.be.revertedWith("SafeMath: subtraction overflow");

      await expect(
        iToken.connect(user3).redeemUnderlying(user1.address, redeemAmount)
      ).to.be.revertedWith("SafeMath: subtraction overflow");
    });

    it("ITKN-REDM-2: Redeem should revert due to insufficient cash", async function () {
      await iUSDT
        .connect(user2)
        .mint(user2.address, actualiUSDTMintAmount.mul(5));
      let currentCash = await iToken.getCash();
      await iToken.connect(user2).borrow(currentCash);
      currentCash = await iToken.getCash();
      expect(currentCash).to.equal(0);

      await expect(
        iToken.connect(user1).redeem(user1.address, redeemAmount)
      ).to.be.revertedWith("SafeMath: subtraction overflow");

      await expect(
        iToken.connect(user1).redeemUnderlying(user1.address, redeemAmount)
      ).to.be.revertedWith("SafeMath: subtraction overflow");
    });

    it("ITKN-REDM-3: Should revert due to iToken not listed", async function () {
      await expect(
        nonListediToken.connect(user1).redeem(user1.address, redeemAmount)
      ).to.be.revertedWith("Token has not been listed");
    });
  });

  describe("Test all scenarios for Borrow", async function () {
    before(async function () {
      // Initialize environments.
      await init();
    });

    it("ITKN-BRRW-0: Should borrow normally", async function () {
      let actualBorrowedAmount = rawBorrowAmout.mul(
        ethers.BigNumber.from("10").pow(iUSDTDecimals)
      );

      const action = {
        target: iUSDT,
        executor: user1,
        func: "borrow",
        args: [actualBorrowedAmount],
      };

      await executeAndVerify(action, [iUSDT], [user1.address]);
    });

    // it("Borrow should revert due to insufficient cash", async function () {
    //   let currentCash = await iToken.getCash();
    //   let shortfallUser1 = await controller.calcAccountEquity(user1.address);
    //   console.log("shortfallUser1", (shortfallUser1[0]).toString(), (shortfallUser1[1]).toString())
    //   let shortfallUser2 = await controller.calcAccountEquity(user2.address);
    //   console.log("shortfallUser2", (shortfallUser2[0]).toString(), (shortfallUser2[1]).toString())
    //   await expect(
    //     iToken.connect(user1).borrow(currentCash.mul(2))
    //   ).to.be.revertedWith("borrowInternal: Insufficient cash to borrow!");
    // });

    it("ITKN-BRRW-1: Should revert due to controller refuse to borrow", async function () {
      // User has shortfall, so can not borrow more.
      await iToken.connect(user3).borrow(mintAmount.mul(9).div(10));

      let iTokenPrice = await oracle.getUnderlyingPrice(iToken.address);
      await setOraclePrices(oracle, [iToken], [5]);

      let actualBorrowedAmount = rawBorrowAmout.mul(
        ethers.BigNumber.from("10").pow(iUSDTDecimals)
      );
      await expect(
        iToken.connect(user3).borrow(actualBorrowedAmount)
      ).to.be.revertedWith("Account has some shortfall");
    });

    it("ITKN-BRRW-2: Should revert due to iToken not listed", async function () {
      await expect(nonListediToken.connect(user1).borrow(0)).to.be.revertedWith(
        "Token has not been listed"
      );
    });

    // it("Should revert due to controller refuse to borrow", async function () {
    //   await expect(
    //     iToken.connect(user1).borrow(borrowAmount)
    //   ).to.be.revertedWith("borrowInternal: Controller fails to verify borrow!");
    // });
  });

  describe("Test all scenarios for Repay", async function () {
    before(async function () {
      // Initialize environments.
      await init();

      const actualBorrowedAmount = await parseTokenAmount(
        iUSDT,
        rawBorrowAmout
      );
      await iUSDT.connect(user1).borrow(actualBorrowedAmount);
    });

    it("ITKN-REPY-0: Should repay for user self normally!", async function () {
      let actualRepayAmount = await parseTokenAmount(iUSDT, rawRapyAmount);

      const action = {
        target: iUSDT,
        executor: user1,
        func: "repayBorrow",
        args: [actualRepayAmount],
      };

      await executeAndVerify(action, [iUSDT], [user1.address]);
    });

    it("ITKN-REPY-1: Should repay behalf for others normally!", async function () {
      let actualRepayAmount = await parseTokenAmount(iUSDT, rawRapyAmount);

      await iUSDT.connect(user1).borrow(actualRepayAmount);

      const action = {
        target: iUSDT,
        executor: user2,
        func: "repayBorrowBehalf",
        args: [user1.address, actualRepayAmount],
      };

      await executeAndVerify(action, [iUSDT], [user1.address, user2.address]);
    });

    it("ITKN-REPY-2: Should revert due to iToken not listed", async function () {
      await expect(
        nonListediToken.connect(user1).repayBorrow(10)
      ).to.be.revertedWith("Token has not been listed");
    });

    // it("Repay borrow should revert due to controller refuses!", async function () {
    //   await expect(
    //     iToken.connect(user1).borrow(borrowAmount)
    //   ).to.be.revertedWith("repay: Controller refuses to repay!");
    // });

    // it("Repay borrow should revert due to controller can not verify!", async function () {
    //   await expect(
    //     iToken.connect(user1).borrow(borrowAmount)
    //   ).to.be.revertedWith("repay: Controller fails to verify repay!");
    // });
  });

  describe("Test all scenarios for liquidate borrow", async function () {
    it("ITKN-LQDT-0: Should liquidate normally", async function () {
      // initialize environment
      await init();

      // Cause user3 only deposits iUSDT at here, and iToken has the same price as iUSDT,
      // so max borrowed amount = user3iUSDTBalance * 0.9
      let user3iUSDTBalance = await iUSDT.balanceOf(user3.address);
      let rawMaxBorrowAmount = user3iUSDTBalance
        .mul(9)
        .div(10)
        .div(ethers.BigNumber.from(10).pow(iUSDTDecimals));
      let actualMaxborrowAmount = rawMaxBorrowAmount.mul(
        ethers.BigNumber.from(10).pow(iTokenDecimals)
      );

      let liquidateDetails = await controller.calcAccountEquity(user3.address);
      // user3 can not have a shortfall, so he can borrow.
      expect(liquidateDetails[1]).to.equal(0);

      await iToken.connect(user3).borrow(actualMaxborrowAmount);

      // Reduced the price of iUSDT, so user3 will have a shortfall.
      await setOraclePrices(oracle, [iUSDT], [0]);

      liquidateDetails = await controller.calcAccountEquity(user3.address);
      expect(liquidateDetails[0]).to.equal(0);

      // user2 is going to liquidate user3.
      let actualLiquidateAmount = rawLiquidateAmount.mul(
        ethers.BigNumber.from(10).pow(iTokenDecimals)
      );

      const action = {
        target: iToken,
        executor: user2,
        func: "liquidateBorrow",
        args: [user3.address, actualLiquidateAmount, iUSDT.address],
      };
      await executeAndVerify(
        action,
        [iToken, iUSDT],
        [user2.address, user3.address]
      );
    });

    it("ITKN-LQDT-1: Should revert due to do not allow to liquidate self", async function () {
      let actualLiquidateAmount = rawLiquidateAmount.mul(
        ethers.BigNumber.from(10).pow(iTokenDecimals)
      );
      await expect(
        iToken
          .connect(user3)
          .liquidateBorrow(user3.address, actualLiquidateAmount, iUSDT.address)
      ).to.be.revertedWith(
        "_liquidateBorrowInternal: Liquidator can not be borrower!"
      );
    });

    it("ITKN-LQDT-2: Should revert due to do not allow to repay 0", async function () {
      await expect(
        iToken.connect(user2).liquidateBorrow(user3.address, "0", iUSDT.address)
      ).to.be.revertedWith(
        "_liquidateBorrowInternal: Liquidate amount should be greater than 0!"
      );
    });

    // it("Should revert due to do not allow to repay max amount", async function () {
    //   await expect(
    //     iToken
    //       .connect(user2)
    //       .liquidateBorrow(user3.address, maxAmount, iUSDT.address)
    //   ).to.be.revertedWith(
    //     "_liquidateBorrowInternal: Liquidate amount should be greater than 0 and amount can not be max!"
    //   );
    // });

    it("ITKN-LQDT-3: Should revert due to controller refuses to liquidate", async function () {
      // User1 do not have a shortfall, so controller will refuse the operation of liquidation.
      let actualLiquidateAmount = rawLiquidateAmount.mul(
        ethers.BigNumber.from(10).pow(iTokenDecimals)
      );
      await expect(
        iToken
          .connect(user2)
          .liquidateBorrow(user1.address, actualLiquidateAmount, iUSDT.address)
      ).to.be.revertedWith("Account does not have shortfall");
    });

    // it("Should revert due to failing to repay when liquidates", async function () {
    //   let actualLiquidateAmount = rawLiquidateAmount.mul(ethers.BigNumber.from(10).pow(iTokenDecimals));
    //   await expect(
    //     iToken.connect(user2).liquidateBorrow(user1.address, actualLiquidateAmount, iUSDT.address)
    //   ).to.be.revertedWith("liquidateBorrowInternal: Fail to repay when liquidate!");
    // });

    // it("Should revert due to failing to liquidating too much", async function () {
    //   let actualLiquidateAmount = rawLiquidateAmount.mul(ethers.BigNumber.from(10).pow(iTokenDecimals));
    //   await expect(
    //     iToken.connect(user2).liquidateBorrow(user1.address, actualLiquidateAmount, iUSDT.address)
    //   ).to.be.revertedWith("liquidateBorrowInternal: Liquidate too much!");
    // });

    // it("Should revert due to failing to seize token", async function () {
    //   let actualLiquidateAmount = rawLiquidateAmount.mul(ethers.BigNumber.from(10).pow(iTokenDecimals));
    //   await expect(
    //     iToken.connect(user2).liquidateBorrow(user1.address, actualLiquidateAmount, iUSDT.address)
    //   ).to.be.revertedWith("liquidateBorrowInternal: Token seizure failed!");
    // });

    // it("Should revert due to controller can not verify", async function () {
    //   let actualLiquidateAmount = rawLiquidateAmount.mul(ethers.BigNumber.from(10).pow(iTokenDecimals));
    //   await expect(
    //     iToken.connect(user2).liquidateBorrow(user1.address, actualLiquidateAmount, iUSDT.address)
    //   ).to.be.revertedWith("liquidateBorrowInternal: Controller fails to verify liquidate!");
    // });

    it("ITKN-LQDT-4: Liquidate asset that does not be set as collateral", async function () {
      // initialize environment
      await init();

      // Cause user3 only sets iUSDT as collateral at here, although he deposits iToken,
      // and iToken has the same price as iUSDT,
      // so max borrowed amount = user3iUSDTBalance * 0.9
      let user3iUSDTBalance = await iUSDT.balanceOf(user3.address);
      // console.log("user3iUSDTBalance", user3iUSDTBalance.toString());

      // user3 supply iToken, but does not set it as collateral.
      await underlying.connect(user3).approve(iToken.address, maxAmount);
      await iToken
        .connect(user3)
        .mint(user3.address, ethers.utils.parseEther("500"));

      let beforeUser3iTokenBalance = await iToken.balanceOf(user3.address);
      // console.log("beforeUser3iTokenBalance", beforeUser3iTokenBalance.toString());

      let rawMaxBorrowAmount = user3iUSDTBalance
        .mul(9)
        .div(10)
        .div(ethers.BigNumber.from(10).pow(iUSDTDecimals));
      let actualMaxborrowAmount = rawMaxBorrowAmount.mul(
        ethers.BigNumber.from(10).pow(iTokenDecimals)
      );

      let liquidateDetails = await controller.calcAccountEquity(user3.address);
      // user3 can not have a shortfall, so he can borrow.
      expect(liquidateDetails[1]).to.equal(0);

      await iToken.connect(user3).borrow(actualMaxborrowAmount);

      // Reduced the price of iUSDT, so user3 will have a shortfall.
      await setOraclePrices(oracle, [iUSDT], [0]);

      liquidateDetails = await controller.calcAccountEquity(user3.address);
      expect(liquidateDetails[0]).to.equal(0);
      let shortfall = liquidateDetails[1];
      // console.log("shortfall", shortfall.toString());
      expect(shortfall).to.gt(0);

      // user2 is going to liquidate user3.
      let actualLiquidateAmount = rawLiquidateAmount.mul(
        ethers.BigNumber.from(10).pow(iTokenDecimals)
      );

      const action = {
        target: iToken,
        executor: user2,
        func: "liquidateBorrow",
        args: [user3.address, actualLiquidateAmount, iToken.address],
      };

      await executeAndVerify(
        action,
        [iToken, iUSDT],
        [user2.address, user3.address]
      );

      liquidateDetails = await controller.calcAccountEquity(user3.address);
      shortfall = liquidateDetails[1];
      expect(shortfall).to.equal(0);
    });
  });

  describe("Test new function: mintForSelfAndEnterMarket", async function () {
    it("ITKN-MINT-5: When mint iToken for callerself, use it as collateral at the same time", async function () {
      // Initialize environments.
      await init();
      // Before minting, user's equity is zero.
      let beforeMintUserEquity = await controller.calcAccountEquity(
        user4.address
      );
      expect(beforeMintUserEquity[0]).to.equal(0);

      await expect(() =>
        iToken.connect(user4).mintForSelfAndEnterMarket(mintAmount)
      ).to.changeTokenBalance(underlying, user4, mintAmount.mul(-1));

      let afterMintUserEquity = await controller.calcAccountEquity(
        user4.address
      );
      expect(afterMintUserEquity[0]).to.gt(0);
    });
  });

  describe("Equity Check", async function () {
    describe("Check equity for redeem", async function () {
      // let snapshotId;
      let maxRedeemableUnderlying, maxRedeemable;

      // It would be more convenient to use evm_revert to revert to a previous state,
      // which does not work here, just rebuild the state before each case
      beforeEach(async function () {
        // console.log("Before of Check equity for Redeem");
        await init();

        // Only iToken is used as collateral
        await iUSDT
          .connect(user1)
          .redeem(user1.address, await iUSDT.balanceOf(user1.address));

        // Borrow Some token to make the redeemable < balance
        await iToken.connect(user1).borrow(redeemAmount);

        ({ maxRedeemableUnderlying, maxRedeemable } = await getMaxRedeemable(
          controller,
          oracle,
          user1.address,
          iToken,
          1
        ));

        // console.log(maxRedeemableUnderlying.toString());
        // console.log(maxRedeemable.toString());

        // snapshotId = await ethers.provider.send("evm_snapshot", []);
      });

      // afterEach(async function () {
      //   console.log("afterEach of Check equity for Redeem", snapshotId);
      //   await ethers.provider.send("evm_revert", [snapshotId]);
      // });

      it("ITKN-REDM-4: Should be able to redeem up to max redeemable", async function () {
        await iToken.connect(user1).redeem(user1.address, maxRedeemable);

        // accountEquity = await controller.calcAccountEquity(user1.address);
        // console.log(accountEquity[0].toString());
      });

      it("ITKN-REDM-5: Should be able to redeemUnderlying up to max redeemable", async function () {
        await iToken
          .connect(user1)
          .redeemUnderlying(user1.address, maxRedeemableUnderlying);
      });

      it("ITKN-REDM-6: Should fail to redeem more than max redeemable", async function () {
        await expect(
          iToken.connect(user1).redeem(user1.address, maxRedeemable.add(1))
        ).to.be.revertedWith("Account has some shortfall");
      });

      it("ITKN-REDM-7: Should fail to redeemUnderlying more than max redeemable", async function () {
        await expect(
          iToken
            .connect(user1)
            .redeemUnderlying(user1.address, maxRedeemableUnderlying.add(1))
        ).to.be.revertedWith("Account has some shortfall");
      });
    });

    describe("Check equity for borrow", async function () {
      let maxBorrowable;

      // It would be more convenient to use evm_revert to revert to a previous state,
      // which does not work here, just rebuild the state before each case
      beforeEach(async function () {
        await init();

        maxBorrowable = await getMaxBorrowable(
          controller,
          oracle,
          user1.address,
          iUSDT,
          1
        );

        // console.log(maxBorrowable.toString());
      });

      it("ITKN-BRRW-3: Should be able to borrow up to max borrowable", async function () {
        await iUSDT.connect(user1).borrow(maxBorrowable);
      });

      it("ITKN-BRRW-4: Should fail to borrow more than max borrowable", async function () {
        await expect(
          iUSDT.connect(user1).borrow(maxBorrowable.add(1))
        ).to.be.revertedWith("Account has some shortfall");
      });
    });

    describe("Check equity for transfer/transferFrom", async function () {
      let maxRedeemable;

      // It would be more convenient to use evm_revert to revert to a previous state,
      // which does not work here, just rebuild the state before each case
      beforeEach(async function () {
        await init();

        // Only iToken is used as collateral
        await iUSDT
          .connect(user1)
          .redeem(user1.address, await iUSDT.balanceOf(user1.address));

        // Borrow Some token to make the redeemable < balance
        await iToken.connect(user1).borrow(redeemAmount);

        ({ maxRedeemableUnderlying, maxRedeemable } = await getMaxRedeemable(
          controller,
          oracle,
          user1.address,
          iToken,
          0
        ));
      });

      it("ITKN-ERC-0: Should be able to transfer up to max redeemable", async function () {
        await iToken.connect(user1).transfer(user2.address, maxRedeemable);
      });

      it("ITKN-ERC-1: Should fail to transfer more than max redeemable", async function () {
        await expect(
          iToken.connect(user1).transfer(user2.address, maxRedeemable.add(1))
        ).to.be.revertedWith("Account has some shortfall");
      });

      it("ITKN-ERC-2: Should be able to transfer up to max redeemable", async function () {
        await iToken
          .connect(user1)
          .approve(user2.address, ethers.constants.MaxUint256);

        await iToken
          .connect(user2)
          .transferFrom(user1.address, user2.address, maxRedeemable);
      });

      it("ITKN-ERC-3: Should fail to transfer more than max redeemable", async function () {
        await iToken
          .connect(user1)
          .approve(user2.address, ethers.constants.MaxUint256);

        await expect(
          iToken
            .connect(user2)
            .transferFrom(user1.address, user2.address, maxRedeemable.add(1))
        ).to.be.revertedWith("Account has some shortfall");
      });
    });
  });

  describe("Reentrancy Check", async function () {
    let reentrancyToken, reentrancyiToken;
    let user;

    before(async function () {
      // console.log("Before of Check equity for Redeem");
      ({ reentrancyToken, reentrancyiToken, accounts } = await loadFixture(
        fixtureDefault
      ));

      [user] = accounts;
      user.address = await user.getAddress();

      // Only iToken is used as collateral
      await reentrancyiToken
        .connect(user)
        .mint(user.address, await parseTokenAmount(reentrancyiToken, 100));
    });

    const functionsWithReentrancyGuard = [
      {
        action: "mint",
        signature: "mint(address,uint256)",
        encodeSig: ["address", "uint256"],
        args: [ethers.constants.AddressZero, 1],
      },
      {
        action: "mintForSelfAndEnterMarket",
        signature: "mintForSelfAndEnterMarket(uint256)",
        encodeSig: ["uint256"],
        args: [1],
      },
      {
        action: "redeem",
        signature: "redeem(address,uint256)",
        encodeSig: ["address", "uint256"],
        args: [ethers.constants.AddressZero, 1],
      },
      {
        action: "redeemUnderlying",
        signature: "redeemUnderlying(address,uint256)",
        encodeSig: ["address", "uint256"],
        args: [ethers.constants.AddressZero, 1],
      },
      {
        action: "borrow",
        signature: "borrow(uint256)",
        encodeSig: ["uint256"],
        args: [1],
      },
      {
        action: "repayBorrow",
        signature: "repayBorrow(uint256)",
        encodeSig: ["uint256"],
        args: [1],
      },
      {
        action: "repayBorrowBehalf",
        signature: "repayBorrowBehalf(address,uint256)",
        encodeSig: ["address", "uint256"],
        args: [ethers.constants.AddressZero, 1],
      },
      {
        action: "liquidateBorrow",
        signature: "liquidateBorrow(address,uint256,address)",
        encodeSig: ["address", "uint256", "address"],
        args: [ethers.constants.AddressZero, 1, ethers.constants.AddressZero],
      },
      {
        action: "seize",
        signature: "seize(address,address,uint256)",
        encodeSig: ["address", "address", "uint256"],
        args: [ethers.constants.AddressZero, ethers.constants.AddressZero, 1],
      },
      {
        action: "borrowBalanceCurrent",
        signature: "borrowBalanceCurrent(address)",
        encodeSig: ["address"],
        args: [ethers.constants.AddressZero],
      },
      {
        action: "transfer",
        signature: "transfer(address,uint256)",
        encodeSig: ["address", "uint256"],
        args: [ethers.constants.AddressZero, 1],
      },
      {
        action: "transferFrom",
        signature: "transferFrom(address,address,uint256)",
        encodeSig: ["address", "address", "uint256"],
        args: [ethers.constants.AddressZero, ethers.constants.AddressZero, 1],
      },
    ];

    describe("Should fail to Reenter from mint", async function () {
      functionsWithReentrancyGuard.forEach(function (action) {
        it(`Trying to reenter ${action.action}`, async function () {
          await reentrancyToken.setCallData(
            reentrancyiToken.address,
            0,
            action.signature,
            abiCoder.encode(action.encodeSig, action.args)
          );

          await expect(
            reentrancyiToken
              .connect(user)
              .mint(user.address, await parseTokenAmount(reentrancyiToken, 100))
          ).to.be.revertedWith("ReentrancyGuard: reentrant call");
        });
      });
    });

    describe("Should fail to Reenter from redeem/redeemUnderlying", async function () {
      functionsWithReentrancyGuard.forEach(function (action) {
        it(`Trying to reenter ${action.action}`, async function () {
          await reentrancyToken.setCallData(
            reentrancyiToken.address,
            0,
            action.signature,
            abiCoder.encode(action.encodeSig, action.args)
          );

          await expect(
            reentrancyiToken
              .connect(user)
              .redeem(
                user.address,
                await parseTokenAmount(reentrancyiToken, 100)
              )
          ).to.be.revertedWith("ReentrancyGuard: reentrant call");

          await expect(
            reentrancyiToken
              .connect(user)
              .redeemUnderlying(
                user.address,
                await parseTokenAmount(reentrancyiToken, 100)
              )
          ).to.be.revertedWith("ReentrancyGuard: reentrant call");
        });
      });
    });
  });
});
