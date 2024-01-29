const { expect } = require("chai");
const { utils, constants, BigNumber } = require("ethers");

const {
  parseTokenAmount,
  formatTokenAmount,
  setOraclePrices,
} = require("../helpers/utils.js");

const { loadFixture, fixtureDefault } = require("../helpers/fixtures.js");

describe("Controller: Account", function () {
  describe("Assets list", function () {
    describe("Collateral Assets", function () {
      describe("Enter Markets", function () {
        it("CON-ENTM-1: Should be able to enter markets", async function () {
          const { controller, iUSDx, accounts } = await loadFixture(
            fixtureDefault
          );
          const [other] = accounts;

          await expect(controller.connect(other).enterMarkets([iUSDx.address]))
            .to.emit(controller, "MarketEntered")
            .withArgs(iUSDx.address, await other.getAddress());
        });

        it("CON-ENTM-2: Should be able to get entered markets", async function () {
          const { controller, iUSDx, accounts } = await loadFixture(
            fixtureDefault
          );
          const [other] = accounts;

          // Check the returned value from static call first
          let entered = await controller
            .connect(other)
            .callStatic.enterMarkets([iUSDx.address]);
          expect(entered).to.eql([true]);

          await controller.connect(other).enterMarkets([iUSDx.address]);
          let markets = await controller.getEnteredMarkets(
            await other.getAddress()
          );

          // To check the deep equality of address array here, for further info:
          // https://medium.com/building-ibotta/testing-arrays-and-objects-with-chai-js-4b372310fe6d
          expect(markets).to.eql([iUSDx.address]);
        });

        it("CON-ENTM-3: Should be able to check whether has entered market", async function () {
          const { controller, iUSDx, accounts } = await loadFixture(
            fixtureDefault
          );
          const [other] = accounts;

          await controller.connect(other).enterMarkets([iUSDx.address]);

          expect(
            await controller.hasEnteredMarket(
              await other.getAddress(),
              iUSDx.address
            )
          ).to.equal(true);

          expect(
            await controller.hasEnteredMarket(
              await other.getAddress(),
              controller.address
            )
          ).to.equal(false);
        });

        it("CON-ENTM-4: Should fail when enter non-listed markets", async function () {
          const { controller, iUSDx, accounts } = await loadFixture(
            fixtureDefault
          );
          const [user1, user2] = accounts;
          const account1 = await user1.getAddress();
          const account2 = await user2.getAddress();

          // Pretend account2 is a non-listed market
          // should return false
          expect(
            await controller.connect(user1).callStatic.enterMarkets([account2])
          ).to.eql([false]);

          // Also check hasEnteredMarket()
          expect(
            await controller.connect(user1).hasEnteredMarket(account1, account2)
          ).to.equal(false);
        });

        it("CON-ENTM-5: Should not emit event when enter market again", async function () {
          const { controller, iUSDx, accounts } = await loadFixture(
            fixtureDefault
          );
          const [user1, user2] = accounts;

          await controller.connect(user1).enterMarkets([iUSDx.address]);

          // Should check whether event is emitted, now waffle has no such matcher
          // await expect(
          //   controller.connect(user1).enterMarkets([iUSDx.address])
          // ).to.emit(controller, "MarketEntered");

          // Should return true as it has entered already
          expect(
            await controller
              .connect(user1)
              .callStatic.enterMarkets([iUSDx.address])
          ).to.eql([true]);
        });
      });

      describe("Exit Markets", function () {
        it("CON-EXM-1: Should be able to exit markets", async function () {
          const { controller, iUSDx, accounts } = await loadFixture(
            fixtureDefault
          );
          const [other] = accounts;
          const account = await other.getAddress();

          // Enter market first
          await controller.connect(other).enterMarkets([iUSDx.address]);
          expect(
            await controller.hasEnteredMarket(account, iUSDx.address)
          ).to.equal(true);

          // Exit with event emitted
          await expect(controller.connect(other).exitMarkets([iUSDx.address]))
            .to.emit(controller, "MarketExited")
            .withArgs(iUSDx.address, account);

          // Check the hasEnteredMarket() to false
          expect(
            await controller.hasEnteredMarket(account, iUSDx.address)
          ).to.equal(false);

          // Also check the getEnteredMarkets() list
          let markets = await controller.getEnteredMarkets(account);
          expect(markets).to.eql([]);
        });

        it("CON-EXM-2: Should be able to exit non-listed markets", async function () {
          const { controller, iUSDx, accounts } = await loadFixture(
            fixtureDefault
          );
          const [user1, user2] = accounts;
          const account1 = await user1.getAddress();
          const account2 = await user2.getAddress();

          // Pretend is account2 is a non-listed market
          expect(
            await controller.connect(user1).callStatic.exitMarkets([account2])
          ).to.eql([false]);
        });

        it("CON-EXM-3: Should be able to exit non-entered markets", async function () {
          const { controller, iUSDx, accounts } = await loadFixture(
            fixtureDefault
          );
          const [user1] = accounts;

          // Should return true
          expect(
            await controller
              .connect(user1)
              .callStatic.exitMarkets([iUSDx.address])
          ).to.eql([false]);
        });
      });
    });

    describe("Borrowed Assets", async function () {
      let controller, iUSDx, iUSDT;
      let user0, account0;
      let rawAmount = BigNumber.from("1000");
      let mintiUSDxAmount, mintiUSDTAmount, amount;

      before(async function () {
        ({ controller, iUSDx, iUSDT, accounts } = await loadFixture(
          fixtureDefault
        ));
        const iUSDxDecimals = await iUSDx.decimals();
        const iUSDTDecimals = await iUSDT.decimals();
        mintiUSDxAmount = rawAmount.mul(BigNumber.from(10).pow(iUSDxDecimals));
        mintiUSDTAmount = rawAmount.mul(BigNumber.from(10).pow(iUSDTDecimals));
        amount = mintiUSDxAmount;

        [user0] = accounts;
        account0 = await user0.getAddress();

        await iUSDx.connect(user0).mint(account0, amount);
        await iUSDT.connect(user0).mint(account0, mintiUSDTAmount);

        // User use iUSDx as collateral
        await controller.connect(user0).enterMarkets([iUSDx.address]);
      });

      it("Should be able to get borrowed list", async function () {
        // Borrow some USDx
        await expect(iUSDx.connect(user0).borrow(amount.div(10)))
          .to.emit(controller, "BorrowedAdded")
          .withArgs(iUSDx.address, account0);

        // Check the hasBorrowed()
        expect(await controller.hasBorrowed(account0, iUSDx.address)).to.equal(
          true
        );

        // Borrow some USDT
        await expect(iUSDT.connect(user0).borrow(mintiUSDTAmount.div(10)))
          .to.emit(controller, "BorrowedAdded")
          .withArgs(iUSDT.address, account0);

        // Check the hasBorrowed()
        expect(await controller.hasBorrowed(account0, iUSDT.address)).to.equal(
          true
        );

        // Check the Borrowed list
        expect(await controller.getBorrowedAssets(account0)).to.have.members([
          iUSDx.address,
          iUSDT.address,
        ]);
      });

      it("Should be able to remove from borrowed list if all paid off", async function () {
        // Now paid off
        await expect(
          iUSDx.connect(user0).repayBorrow(ethers.constants.MaxUint256)
        )
          .to.emit(controller, "BorrowedRemoved")
          .withArgs(iUSDx.address, account0);

        // Check the hasBorrowed()
        expect(await controller.hasBorrowed(account0, iUSDx.address)).to.equal(
          false
        );

        // Check the Borrowed list
        expect(await controller.getBorrowedAssets(account0)).to.eql([
          iUSDT.address,
        ]);
      });
    });
  });

  describe("Account Equity", function () {
    describe("Liquidate Calculate Seize Tokens", function () {
      let cases = [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [2, 1.42, 1.3, 2.45],
        [5.230480842, 771.32, 1.3, 10002.45],
        [
          2527872.6317240445, 261771.12093242585, 1.179713989619784,
          7790468.414639561,
        ],
      ];

      cases.forEach((testCase) => {
        it(`returns the correct value for ${testCase}`, async () => {
          const { controller, priceOracle, iUSDx, iUSDT } = await loadFixture(
            fixtureDefault
          );

          let [
            borrowedPrice,
            collateralPrice,
            liquidationIncentive,
            repayAmount,
          ] = testCase;

          await setOraclePrices(
            priceOracle,
            [iUSDx, iUSDT],
            [borrowedPrice, collateralPrice]
          );

          const price0 = await priceOracle.getUnderlyingPrice(iUSDx.address);
          const price1 = await priceOracle.getUnderlyingPrice(iUSDT.address);

          liquidationIncentive = utils.parseEther(
            liquidationIncentive.toString()
          );
          repayAmount = await parseTokenAmount(iUSDx, repayAmount);
          await controller._setLiquidationIncentive(liquidationIncentive);
          let seized = await controller.liquidateCalculateSeizeTokens(
            iUSDx.address,
            iUSDT.address,
            repayAmount
          );

          let exchangeRate1 = await iUSDT.exchangeRateStored();

          let expected = repayAmount
            .mul(liquidationIncentive)
            .div(utils.parseEther("1"))
            .mul(price0)
            .div(price1)
            .mul(utils.parseEther("1"))
            .div(exchangeRate1);

          expect(seized).to.equal(expected);
        });
      });

      it("Should revert if either underlying price is unavailable", async function () {
        const { controller, mockPriceOracle, iUSDx, iUSDT } = await loadFixture(
          fixtureDefault
        );

        // Use mock oracle
        await controller._setPriceOracle(mockPriceOracle.address);

        await setOraclePrices(mockPriceOracle, [iUSDx], [0]);

        let repayAmount = await parseTokenAmount(iUSDx, 100);
        await expect(
          controller.liquidateCalculateSeizeTokens(
            iUSDx.address,
            iUSDT.address,
            repayAmount
          )
        ).to.revertedWith("Borrowed or Collateral asset price is invalid");

        // Set some price for iUSDx
        await setOraclePrices(mockPriceOracle, [iUSDx, iUSDT], [1, 0]);

        await expect(
          controller.liquidateCalculateSeizeTokens(
            iUSDx.address,
            iUSDT.address,
            repayAmount
          )
        ).to.revertedWith("Borrowed or Collateral asset price is invalid");
      });

      it.skip("Should revert if either underlying price is unavailable in ControllerStock", async function () {
        const { controllerStock, mockPriceOracle, iUSDx, iUSDT } =
          await loadFixture(fixtureDefault);
        let repayAmount = await parseTokenAmount(iUSDx, 100);

        // Use controllerStock
        await iUSDx._setController(controllerStock.address);
        await iUSDT._setController(controllerStock.address);

        // Use mock oracle
        await controllerStock._setPriceOracle(mockPriceOracle.address);

        let caseArgs = [
          [
            [iUSDx, iUSDT],
            [1, 0],
            [true, true],
          ],
          [
            [iUSDx, iUSDT],
            [1, 1],
            [false, true],
          ],
          [
            [iUSDx, iUSDT],
            [0, 1],
            [true, true],
          ],
          [
            [iUSDx, iUSDT],
            [1, 1],
            [true, false],
          ],
        ];

        // Set some price for iUSDx
        await setOraclePrices(mockPriceOracle, [iUSDx, iUSDT], [1, 0]);
        for (args of caseArgs) {
          await setOraclePrices(mockPriceOracle, ...args);
          await expect(
            controllerStock.liquidateCalculateSeizeTokens(
              iUSDx.address,
              iUSDT.address,
              repayAmount
            )
          ).to.revertedWith("Borrowed or Collateral asset price is invalid");
        }
      });
    });

    describe("Calculate Account Equity", async function () {
      let controller, controllerStock, iUSDx, iUSDT;
      let user1, user2, account1, account2;
      let priceOracle, mockPriceOracle;

      before(async function () {
        ({
          controller,
          controllerStock,
          iUSDx,
          iUSDT,
          priceOracle,
          mockPriceOracle,
          accounts,
        } = await loadFixture(fixtureDefault));

        [user1, user2] = accounts;
        account1 = await user1.getAddress();
        account2 = await user2.getAddress();

        await controller.connect(user1).enterMarkets([iUSDx.address]);
      });

      it("Should get correct account equity with initial mint()", async function () {
        let amount = await parseTokenAmount(iUSDx, 100);
        let price = await priceOracle.getUnderlyingPrice(iUSDx.address);
        //console.log(price.toString());

        await iUSDx.connect(user1).mint(account1, amount);

        let exchangeRate = await iUSDx.exchangeRateStored();
        // console.log(exchangeRate.toString());

        let balance = await iUSDx.balanceOf(account1);
        // console.log(
        //   "balance of account",
        //   await formatTokenAmount(iUSDx, balance)
        // );

        // The default collateral factor is 0.9
        let expected = balance
          .mul(price)
          .mul(exchangeRate)
          .div(utils.parseEther("1"))
          .mul(9)
          .div(10);

        let equity = await controller.calcAccountEquity(account1);

        expect(equity[0]).to.equal(expected);
        expect(equity[1]).to.equal(0);
      });

      it("Should get correct account equity followed by a redeem()", async function () {
        let redeemAmount = await parseTokenAmount(iUSDx, 20);
        let price = await priceOracle.getUnderlyingPrice(iUSDx.address);
        let exchangeRate = await iUSDx.exchangeRateStored();

        let equity = await controller.calcAccountEquity(account1);

        await iUSDx.connect(user1).redeem(account1, redeemAmount);

        // The default collateral factor is 0.9
        let redeemedValue = redeemAmount
          .mul(price)
          .mul(exchangeRate)
          .div(utils.parseEther("1"))
          .mul(9)
          .div(10);
        let expected = equity[0].sub(redeemedValue);
        equity = await controller.calcAccountEquity(account1);

        expect(equity[0]).to.equal(expected);
        expect(equity[1]).to.equal(0);
      });

      it("Should get correct account equity followed by another borrow()", async function () {
        let borrowAmount = await parseTokenAmount(iUSDx, 10);
        let price = await priceOracle.getUnderlyingPrice(iUSDx.address);
        let equity = await controller.calcAccountEquity(account1);

        await iUSDx.connect(user1).borrow(borrowAmount);

        // default borrow factor is 1.0
        let borrowedValue = borrowAmount.mul(price);
        let expected = equity[0].sub(borrowedValue);
        equity = await controller.calcAccountEquity(account1);

        expect(equity[0]).to.equal(expected);
        expect(equity[1]).to.equal(0);
      });

      it("Should get correct account equity followed by a price drop", async function () {
        await setOraclePrices(priceOracle, [iUSDx], [0.5]);
        let price = await priceOracle.getUnderlyingPrice(iUSDx.address);

        let balance = await iUSDx.balanceOf(account1);
        let borrowBalance = await iUSDx.borrowBalanceStored(account1);
        let exchangeRate = await iUSDx.exchangeRateStored();

        let expected = balance
          .mul(price)
          .mul(exchangeRate)
          .div(utils.parseEther("1"))
          .mul(9)
          .div(10)
          .sub(borrowBalance.mul(price));
        let equity = await controller.calcAccountEquity(account1);

        expect(equity[0]).to.equal(expected);
        expect(equity[1]).to.equal(0);
      });

      it("Should get correct account equity after changing collateral factor", async function () {
        let price = await priceOracle.getUnderlyingPrice(iUSDx.address);
        let balance = await iUSDx.balanceOf(account1);
        let borrowBalance = await iUSDx.borrowBalanceStored(account1);
        let exchangeRate = await iUSDx.exchangeRateStored();

        // collateral factor = 0.8
        let newCollateralFactor = ethers.utils.parseUnits("0.8", 18);
        await controller._setCollateralFactor(
          iUSDx.address,
          newCollateralFactor
        );

        let expected = balance
          .mul(price)
          .mul(exchangeRate)
          .div(utils.parseEther("1"))
          .mul(8)
          .div(10)
          .sub(borrowBalance.mul(price));
        let equity = await controller.calcAccountEquity(account1);

        expect(equity[0]).to.equal(expected);
        expect(equity[1]).to.equal(0);
      });

      it("Should get correct account equity after a price rise of borrowed assets", async function () {
        let exchangeRate = await iUSDx.exchangeRateStored();
        let price0 = await priceOracle.getUnderlyingPrice(iUSDx.address);

        // User2 deposit some token1 for user1 to borrow
        let mintAmount = await parseTokenAmount(iUSDT, 100);
        let borrowAmount = await parseTokenAmount(iUSDT, 10);

        await iUSDT.connect(user2).mint(account2, mintAmount);
        await iUSDT.connect(user1).borrow(borrowAmount);

        // price of token1 rises to 5
        await setOraclePrices(priceOracle, [iUSDT], [5]);
        let price1 = await priceOracle.getUnderlyingPrice(iUSDT.address);

        // collateral factor = 0.8
        let balance = await iUSDx.balanceOf(account1);
        let borrowBalance = await iUSDx.borrowBalanceStored(account1);
        let expected = borrowAmount
          .mul(price1)
          .add(borrowBalance.mul(price0))
          .sub(
            balance
              .mul(price0)
              .mul(exchangeRate)
              .div(utils.parseEther("1"))
              .mul(8)
              .div(10)
          );
        let equity = await controller.calcAccountEquity(account1);

        // Should be a shortfall
        expect(equity[0]).to.equal(0);
        expect(equity[1]).to.equal(expected);
      });

      it("Should get correct account equity after changing borrow factor", async function () {
        let exchangeRate = await iUSDx.exchangeRateStored();
        let price0 = await priceOracle.getUnderlyingPrice(iUSDx.address);
        let price1 = await priceOracle.getUnderlyingPrice(iUSDT.address);
        let balance0 = await iUSDx.balanceOf(account1);
        let borrowBalance0 = await iUSDx.borrowBalanceStored(account1);
        let borrowBalance1 = await iUSDT.borrowBalanceStored(account1);

        let newBorrowFactor = ethers.utils.parseUnits("0.8", 18);
        await controller._setBorrowFactor(iUSDT.address, newBorrowFactor);

        let expected = borrowBalance0
          .mul(price0)
          .add(borrowBalance1.mul(price1).mul(10).div(8))
          .sub(
            balance0
              .mul(price0)
              .mul(exchangeRate)
              .div(utils.parseEther("1"))
              .mul(8)
              .div(10)
          );
        let equity = await controller.calcAccountEquity(account1);

        // Should be a shortfall
        expect(equity[0]).to.equal(0);
        expect(equity[1]).to.equal(expected);
      });

      it("Should get correct account equity after enter new market", async function () {
        let exchangeRate1 = await iUSDT.exchangeRateStored();
        let price1 = await priceOracle.getUnderlyingPrice(iUSDT.address);
        let balance1 = await iUSDT.balanceOf(account2);

        let equity = await controller.calcAccountEquity(account2);
        expect(equity[0]).to.equal(0);

        // User2 use iUSDx and iUSDT as collateral
        await controller.connect(user2).enterMarkets([iUSDT.address]);

        // User2 has minted 100 iUSDT
        let expected = balance1
          .mul(price1)
          .mul(exchangeRate1)
          .div(utils.parseEther("1"))
          .mul(9)
          .div(10);
        equity = await controller.calcAccountEquity(account2);

        expect(equity[0]).to.equal(expected);
      });

      it("Should get correct account equity after exit market", async function () {
        // User2 remove iUSDT from collateral
        await controller.connect(user2).exitMarkets([iUSDT.address]);
        let equity = await controller.calcAccountEquity(account2);

        expect(equity[0]).to.equal(0);
      });

      it("Should fail if the underlying price is unavailable", async function () {
        // Use mock oracle
        await controller._setPriceOracle(mockPriceOracle.address);

        await setOraclePrices(mockPriceOracle, [iUSDx, iUSDT], [1, 0]);

        await expect(controller.calcAccountEquity(account1)).to.revertedWith(
          "Invalid price to calculate account equity"
        );

        await setOraclePrices(mockPriceOracle, [iUSDx, iUSDT], [0, 1]);

        await expect(controller.calcAccountEquity(account1)).to.revertedWith(
          "Invalid price to calculate account equity"
        );
      });

      it.skip("Should fail if the underlying price is unavailable in controllerStock ", async function () {
        // Use controllerStock
        await iUSDx._setController(controllerStock.address);
        await iUSDT._setController(controllerStock.address);

        // Use mock oracle
        await controllerStock._setPriceOracle(mockPriceOracle.address);
        await setOraclePrices(
          mockPriceOracle,
          [iUSDx, iUSDT],
          [1, 1],
          [true, true]
        );

        await controllerStock
          .connect(user1)
          .enterMarkets([iUSDx.address, iUSDT.address]);
        await iUSDx.connect(user1).borrow(0);
        await iUSDT.connect(user1).borrow(0);

        let caseArgs = [
          [
            [iUSDx, iUSDT],
            [1, 0],
            [true, true],
          ],
          [
            [iUSDx, iUSDT],
            [1, 1],
            [false, true],
          ],
          [
            [iUSDx, iUSDT],
            [0, 1],
            [true, true],
          ],
          [
            [iUSDx, iUSDT],
            [1, 1],
            [true, false],
          ],
        ];

        for (args of caseArgs) {
          await setOraclePrices(mockPriceOracle, ...args);
          await expect(
            controllerStock.calcAccountEquity(account1)
          ).to.revertedWith("Invalid price to calculate account equity");
        }
      });
    });
  });
});
