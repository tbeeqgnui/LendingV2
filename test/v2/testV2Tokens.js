const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils, constants } = require("ethers");

const {
  fixtureV2,
  loadFixture,
  fixtureDefault,
} = require("../helpers/fixtures.js");
const { setETHBalance } = require("../helpers/utils.js");

describe("V2 Tokens", function () {
  describe("_doTransferOut", function () {
    let controllerV2, priceOracle, timeLockStrategy, timeLock;
    let iUSDx, iETH, iMUSX;
    let USDx, USX;
    let user;
    const v2tokenBorrowInstance = [
      { symbol: "ITKN", getiToken: () => iUSDx, getUnderlying: () => USDx },
      {
        symbol: "IETH",
        getiToken: () => iETH,
        getUnderlying: () => constants.AddressZero,
      },
      { symbol: "IMSD", getiToken: () => iMUSX, getUnderlying: () => USX },
    ];
    const v2tokenRedeemInstance = [
      { symbol: "ITKN", getiToken: () => iUSDx, getUnderlying: () => USDx },
      {
        symbol: "IETH",
        getiToken: () => iETH,
        getUnderlying: () => constants.AddressZero,
      },
    ];

    async function fixtureTransferOut() {
      const results = await loadFixture(fixtureV2);

      const {
        accounts: [user],
        iUSDx,
        iETH,
      } = results;

      const mintAmount = utils.parseEther("10000");

      await iUSDx.connect(user).mintForSelfAndEnterMarket(mintAmount);
      await iETH.connect(user).mintForSelfAndEnterMarket({ value: mintAmount });

      return { ...results };
    }

    beforeEach(async function () {
      ({
        timeLockStrategy,
        timeLock,
        accounts: [user],
        iUSDx,
        USDx,
        iETH,
        iMUSX,
        USX,
      } = await loadFixture(fixtureTransferOut));
    });

    async function checkTokenBalanceChanges(fn, token, accounts, changes) {
      if (token === constants.AddressZero) {
        await expect(() => fn).to.changeEtherBalances(accounts, changes);
      } else {
        await expect(() => fn).to.changeTokenBalances(token, accounts, changes);
      }
    }

    v2tokenBorrowInstance.forEach((instance) => {
      // iToken is only accessible inside each iter
      it(`${instance.symbol}V2-BRRW-0: Should match the delay strategy`, async function () {
        const iToken = instance.getiToken();
        const underlying = instance.getUnderlying();

        const minSingleLimit = (
          await timeLockStrategy.assetLimitConfig(iToken.address)
        )[0];

        let borrowAmount = minSingleLimit;

        // under single limit, underlying goes to user
        await checkTokenBalanceChanges(
          iToken.connect(user).borrow(borrowAmount),
          underlying,
          [user],
          [borrowAmount]
        );

        // above single limit, underlying goes to timelock
        borrowAmount = minSingleLimit.add(1);

        await checkTokenBalanceChanges(
          iToken.connect(user).borrow(borrowAmount),
          underlying,
          [timeLock],
          [borrowAmount]
        );
      });
    });

    v2tokenRedeemInstance.forEach((instance) => {
      it(`${instance.symbol}V2-RDM-0: Should match the delay strategy`, async function () {
        const iToken = instance.getiToken();
        const underlying = instance.getUnderlying();
        const minSingleLimit = (
          await timeLockStrategy.assetLimitConfig(iToken.address)
        )[0];

        let redeemAmount = minSingleLimit;

        // under single limit, underlying goes to user
        await checkTokenBalanceChanges(
          iToken.connect(user).redeemUnderlying(user.address, redeemAmount),
          underlying,
          [user],
          [redeemAmount]
        );

        // above single limit, underlying goes to timelock
        redeemAmount = minSingleLimit.add(1);

        await checkTokenBalanceChanges(
          iToken.connect(user).redeemUnderlying(user.address, redeemAmount),
          underlying,
          [timeLock],
          [redeemAmount]
        );
      });
    });
  });

  describe("_liquidateBorrowInternal", function () {
    const eModeLTV = utils.parseEther("0.97"); // 97%
    const eModeLiquidationThreshold = utils.parseEther("0.98"); //98%

    let controllerV2, priceOracle;
    let iUSDx, iETH, iMUSX, iUSDC, iWBTC;
    let emodeUsers, userLiquidator;
    let repayRawAmount;

    const v2tokenInstance = [
      { symbol: "ITKN", getiToken: () => iUSDx, emode: 0 },
      { symbol: "IMSD", getiToken: () => iMUSX, emode: 1 },
      { symbol: "IETH", getiToken: () => iETH, emode: 2 },
      { symbol: "ITKN", getiToken: () => iWBTC, emode: 3, decimal: 8 },
    ];

    // users for different emode
    const users = [
      { getUser: () => emodeUsers[0] },
      { getUser: () => emodeUsers[1] },
      { getUser: () => emodeUsers[2] },
      { getUser: () => emodeUsers[3] },
    ];

    // collaterals for different emode
    const collaterals = [
      { getCollateral: () => iUSDx },
      { getCollateral: () => iUSDC },
      { getCollateral: () => iETH },
      { getCollateral: () => iWBTC },
    ];

    async function fixtureLiquidate() {
      const results = await loadFixture(fixtureV2);

      const {
        controllerV2,
        priceOracle,
        accounts: [
          userEmodeDefault,
          userEModeStableCoin,
          userEModeETH,
          userEModeBTC,
          userLiquidator,
        ],
        iUSDC,
        iUSDx,
        iETH,
        iMUSX,
        iWBTC,
      } = results;

      await controllerV2._addEMode(
        ethers.utils.parseEther("1.01"), // liquidationIncentive
        ethers.utils.parseEther("0.4"), // closeFactor
        "BTC" // label
      );

      await controllerV2._setEMode(
        iETH.address,
        2, // ETH
        eModeLTV,
        eModeLiquidationThreshold
      );

      await controllerV2._setEMode(
        iMUSX.address,
        1, // stable coin
        eModeLTV,
        eModeLiquidationThreshold
      );

      await controllerV2._setEMode(
        iWBTC.address,
        3, // BTC
        eModeLTV,
        eModeLiquidationThreshold
      );

      const mintAmount = utils.parseEther("1");
      //Deposits large amount to minimize interest accuring
      const depositAmount = mintAmount.mul(100000000);
      const borrowAmount = utils.parseEther("10");
      const emodeUsers = [
        userEmodeDefault,
        userEModeStableCoin,
        userEModeETH,
        userEModeBTC,
      ];
      const USDCFactor = utils.parseUnits("1", 18 - 6);
      const WBTCFactor = utils.parseUnits("1", 18 - 8);

      // Deposits large amount to minimize interest accuring
      await iUSDC
        .connect(userLiquidator)
        .mintForSelfAndEnterMarket(depositAmount.div(USDCFactor));
      await iUSDx
        .connect(userLiquidator)
        .mintForSelfAndEnterMarket(depositAmount);

      await setETHBalance(userLiquidator.address, depositAmount.mul(2));
      await iETH.connect(userLiquidator).mintForSelfAndEnterMarket({
        value: depositAmount,
      });
      await iWBTC
        .connect(userLiquidator)
        .mintForSelfAndEnterMarket(depositAmount.div(WBTCFactor));
      await iMUSX.connect(userLiquidator).borrow(depositAmount.div(100000));

      // collaterals
      for (const user of emodeUsers) {
        // USDC as main collater will drop to almost 0
        await iUSDC
          .connect(user)
          .mintForSelfAndEnterMarket(mintAmount.div(USDCFactor).mul(1000000));
        await iUSDx.connect(user).mintForSelfAndEnterMarket(mintAmount);
        await iWBTC
          .connect(user)
          .mintForSelfAndEnterMarket(mintAmount.div(WBTCFactor));
        await iETH
          .connect(user)
          .mintForSelfAndEnterMarket({ value: mintAmount });
      }

      // borrows
      // User 0
      await iUSDx.connect(userEmodeDefault).borrow(borrowAmount);
      await iETH.connect(userEmodeDefault).borrow(borrowAmount);
      await iMUSX.connect(userEmodeDefault).borrow(borrowAmount);
      await iWBTC
        .connect(userEmodeDefault)
        .borrow(borrowAmount.div(WBTCFactor));

      // User 1
      await controllerV2.connect(userEModeStableCoin).enterEMode(1);
      await iMUSX.connect(userEModeStableCoin).borrow(borrowAmount.mul(100));

      // User 2
      await controllerV2.connect(userEModeETH).enterEMode(2);
      await iETH.connect(userEModeETH).borrow(borrowAmount);

      // User 3 WBTC price
      await controllerV2.connect(userEModeBTC).enterEMode(3);
      await iWBTC
        .connect(userEModeBTC)
        .borrow(borrowAmount.div(WBTCFactor).mul(100));

      const orginalPrice = await priceOracle.getUnderlyingPrice(iUSDC.address);
      const liquidationPrice = orginalPrice.mul(1).div(10000);
      await priceOracle._setPendingAnchor(iUSDC.address, liquidationPrice);
      await priceOracle.setPrice(iUSDC.address, liquidationPrice);

      return {
        ...results,
        emodeUsers,
        userLiquidator,
      };
    }

    before(async function () {
      repayRawAmount = "0.001";
    });

    beforeEach(async function () {
      ({
        priceOracle,
        emodeUsers,
        userLiquidator,
        iUSDx,
        iETH,
        iMUSX,
        iUSDC,
        iWBTC,
      } = await loadFixture(fixtureLiquidate));
    });

    v2tokenInstance.forEach((instance) => {
      let index = 0;
      users.forEach((u, userEMode) => {
        collaterals.forEach((col, collateralEMode) => {
          // Skip as user can not borrow this asset
          if (userEMode > 0 && userEMode != instance.emode) {
            return;
          }

          // only emode user and the same emode collatera can have the emode incentive
          const useEmodeIncentive =
            userEMode > 0 && instance.emode == collateralEMode;
          const incentiveStr = useEmodeIncentive ? "emode" : "default";

          // iToken is only accessible inside each iter
          it(`${
            instance.symbol
          }V2-LQDT-${index++}: user: ${userEMode}, collateral: ${collateralEMode}, should use the ${incentiveStr} liquidation incentive`, async function () {
            const iToken = instance.getiToken();
            const user = u.getUser();
            const collateral = col.getCollateral();

            // default liquidation incentive is 1.1
            let incentive = useEmodeIncentive
              ? utils.parseEther("1.01")
              : utils.parseEther("1.1");

            const repayAmount = utils.parseUnits(
              repayRawAmount,
              instance.decimal ? instance.decimal : 18
            );

            const seizeAmount = repayAmount
              .mul(await priceOracle.getUnderlyingPrice(iToken.address))
              .mul(incentive)
              .div(await priceOracle.getUnderlyingPrice(collateral.address))
              .div(utils.parseEther("1"));

            const args =
              iToken.address === iETH.address
                ? [user.address, collateral.address, { value: repayAmount }]
                : [user.address, repayAmount, collateral.address];

            await expect(
              iToken.connect(userLiquidator).liquidateBorrow(...args)
            ).to.changeTokenBalances(
              collateral,
              [userLiquidator, user],
              [seizeAmount, seizeAmount.mul(-1)]
            );
          });
        });
      });
    });
  });

  describe("redeemFromSelfAndExitMarket", function () {
    let USDx, iUSDx, iETH, controller;
    let accounts, depositor, owner;

    beforeEach(async function () {
      ({ accounts, controller, owner, iUSDx, iETH, USDx } = await loadFixture(
        fixtureV2
      ));

      iUSDx = new ethers.Contract(
        iUSDx.address,
        require("../../artifacts/contracts/iTokenV2.sol/iTokenV2.json").abi,
        owner
      );

      iETH = new ethers.Contract(
        iETH.address,
        require("../../artifacts/contracts/iETHV2.sol/iETHV2.json").abi,
        owner
      );

      depositor = accounts[1];
      const Alice = accounts[10];

      // Deposit ETH
      await iETH
        .connect(Alice)
        .mint(owner.address, { value: utils.parseEther("100") });
      // Deposit USDx
      await iUSDx.connect(Alice).mint(owner.address, utils.parseEther("10000"));
    });

    async function redeemTokenAndExitMarketWithoutBorrows(
      executor,
      depositToken,
      depositAmount,
      depositIsiETH
    ) {
      if (depositIsiETH) {
        await depositToken
          .connect(executor)
          .mint(executor.address, { value: depositAmount });
      } else {
        // iToken
        await depositToken
          .connect(executor)
          .mint(executor.address, depositAmount);
      }

      const redeemAmount = await depositToken.balanceOf(executor.address);

      expect(
        await controller.hasEnteredMarket(
          executor.address,
          depositToken.address
        )
      ).to.be.false;
      // Use asset as collateral
      await controller.connect(executor).enterMarkets([depositToken.address]);
      expect(
        await controller.hasEnteredMarket(
          executor.address,
          depositToken.address
        )
      ).to.be.true;

      await depositToken
        .connect(executor)
        .redeemFromSelfAndExitMarket(redeemAmount);
      expect(
        await controller.hasEnteredMarket(
          executor.address,
          depositToken.address
        )
      ).to.be.false;
    }

    async function redeemTokenAndExitMarketWithBorrows(
      executor,
      depositToken,
      depositAmount,
      depositIsiETH,
      borrowToken,
      borrowAmount,
      depositSecondToken,
      depositSecondTokenAmount,
      depositSecondTokenIsiETH
    ) {
      // Deposit asset
      if (depositIsiETH) {
        await depositToken
          .connect(executor)
          .mint(executor.address, { value: depositAmount });
      } else {
        // iToken
        await depositToken
          .connect(executor)
          .mint(executor.address, depositAmount);
      }

      const redeemAmount = await depositToken.balanceOf(executor.address);

      expect(
        await controller.hasEnteredMarket(
          executor.address,
          depositToken.address
        )
      ).to.be.false;
      // Use asset as collateral
      await controller.connect(executor).enterMarkets([depositToken.address]);
      expect(
        await controller.hasEnteredMarket(
          executor.address,
          depositToken.address
        )
      ).to.be.true;

      // Borrow asset
      await borrowToken.connect(executor).borrow(borrowAmount);

      // Revert due to shortfall.
      await expect(
        depositToken.connect(executor).redeemFromSelfAndExitMarket(redeemAmount)
      ).to.be.reverted;

      // Deposit another asset and use it as collateral
      expect(
        await controller.hasEnteredMarket(
          executor.address,
          depositSecondToken.address
        )
      ).to.be.false;
      if (depositSecondTokenIsiETH) {
        // iETH
        await depositSecondToken.connect(executor).mintForSelfAndEnterMarket({
          value: depositSecondTokenAmount,
        });
      } else {
        // iToken
        await depositSecondToken
          .connect(executor)
          .mintForSelfAndEnterMarket(depositSecondTokenAmount);
      }
      expect(
        await controller.hasEnteredMarket(
          executor.address,
          depositSecondToken.address
        )
      ).to.be.true;

      // Succeed, cause depositor has enough equity.
      await depositToken
        .connect(executor)
        .redeemFromSelfAndExitMarket(redeemAmount);
      expect(
        await controller.hasEnteredMarket(
          executor.address,
          depositToken.address
        )
      ).to.be.false;
    }

    it("iToken: redeem and exit market without borrows", async function () {
      const executor = depositor;
      const depositToken = iUSDx;
      const depositAmount = utils.parseEther("1000");

      await redeemTokenAndExitMarketWithoutBorrows(
        executor,
        depositToken,
        depositAmount,
        false // is iETH
      );
    });

    it("iToken: redeem and exit market with some borrows", async function () {
      const mintTokenAmount = utils.parseEther("5000");
      const mintEthAmount = utils.parseEther("500");
      const borrowEthAmount = utils.parseEther("1");

      await redeemTokenAndExitMarketWithBorrows(
        depositor, // executor
        iUSDx, // deposit token
        mintTokenAmount, // deposit amount
        false, // is iETH
        iETH, // borrow token
        borrowEthAmount,
        iETH, // deposit second token
        mintEthAmount,
        true // is iETH
      );
    });

    it("iETH: redeem and exit market without borrows", async function () {
      const executor = depositor;
      const depositToken = iETH;
      const depositAmount = utils.parseEther("100");

      await redeemTokenAndExitMarketWithoutBorrows(
        executor,
        depositToken,
        depositAmount,
        true // is iETH
      );
    });

    it("iETH: redeem and exit market with some borrows", async function () {
      const mintTokenAmount = utils.parseEther("5000");
      const mintEthAmount = utils.parseEther("500");
      const borrowTokenAmount = utils.parseEther("1000");

      await redeemTokenAndExitMarketWithBorrows(
        depositor, // executor
        iETH, // deposit token
        mintEthAmount, // deposit amount
        true, // is iETH
        iUSDx, // borrow token
        borrowTokenAmount,
        iUSDx, // deposit second token
        mintTokenAmount,
        false // is iETH
      );
    });
  });

  describe("mint/redeem totalSupply threshold", function () {
    let iUSDx, iETH;
    let USDx, USX;
    let user;
    const tokenInstance = [
      { symbol: "ITKN", getiToken: () => iUSDx, getUnderlying: () => USDx },
      {
        symbol: "IETH",
        getiToken: () => iETH,
        getUnderlying: () => constants.AddressZero,
      },
    ];

    beforeEach(async function () {
      ({
        accounts: [user],
        iUSDx,
        USDx,
        iETH,
        USX,
      } = await loadFixture(fixtureDefault));
    });

    async function mint(iToken, underlying, user, amount) {
      if (underlying === constants.AddressZero) {
        await iToken.connect(user).mint(user.address, { value: amount });
      } else {
        await iToken.connect(user).mint(user.address, amount);
      }
    }

    tokenInstance.forEach((instance) => {
      it(`${instance.symbol}-MINT: Should check totalSupply > TOTAL_SUPPLY_THRESHOLD`, async function () {
        const iToken = instance.getiToken();
        const underlying = instance.getUnderlying();
        const totalSupplyThreshold = await iToken.TOTAL_SUPPLY_THRESHOLD();

        await expect(
          mint(iToken, underlying, user, totalSupplyThreshold.sub(1))
        ).to.be.revertedWith("_mintInternal: totalSupply too small!");
      });

      it(`${instance.symbol}-REDM: Should check totalSupply > TOTAL_SUPPLY_THRESHOLD`, async function () {
        const iToken = instance.getiToken();
        const underlying = instance.getUnderlying();
        const totalSupplyThreshold = await iToken.TOTAL_SUPPLY_THRESHOLD();

        await mint(iToken, underlying, user, totalSupplyThreshold);

        await expect(
          iToken.connect(user).redeem(user.address, 1)
        ).to.be.revertedWith("_redeemInternal: totalSupply too small!");

        await expect(
          iToken.connect(user).redeemUnderlying(user.address, 1)
        ).to.be.revertedWith("_redeemInternal: totalSupply too small!");

        // Allow redeem all
        await iToken.connect(user).redeem(user.address, totalSupplyThreshold);
      });
    });
  });
});
