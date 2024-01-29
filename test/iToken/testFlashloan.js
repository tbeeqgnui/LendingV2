const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  fixtureDefault,
  getiTokenCurrentData,
} = require("../helpers/fixtures.js");

const { divup } = require("../helpers/utils.js");

const BASE = ethers.utils.parseEther("1");
const maxAmount = ethers.constants.MaxUint256;

let iToken, iUSDT, iETH, controller, interestRateModel;
let underlying, USDT;
let accounts, owner, minter, redeemer, borrower, liquidator, mintAnother;
let oracle;
let flashloanExecutor, flashloanExecutorFailure;
let iTokenDecimals, iUSDTDecimals;
let actualiTokenMintAmount, actualiUSDTMintAmount;
let lendingData;

describe.skip("Flashloan", async function () {
  // Initialize contract data
  async function init() {
    ({
      controller: controller,
      owner: owner,
      iUSDx: iToken,
      USDx: underlying,
      iUSDT: iUSDT,
      iETH: iETH,
      USDT: USDT,
      interestRateModel: interestRateModel,
      accounts: accounts,
      flashloanExecutor: flashloanExecutor,
      flashloanExecutorFailure: flashloanExecutorFailure,
      priceOracle: oracle,
      lendingData: lendingData,
    } = await loadFixture(fixtureDefault));

    // Use the FlashloanTest instead of the default flashloanExecutor
    const FlashloanExecutor = await ethers.getContractFactory("FlashloanTest");
    flashloanExecutor = await FlashloanExecutor.deploy();
    await flashloanExecutor.deployed();

    // Set user address
    [minter, redeemer, borrower, liquidator, mintAnother] = accounts;

    // Related user assets as collateral
    await controller.connect(borrower).enterMarkets([iToken.address]);

    // mint iToken
    let rawMintAmount = ethers.BigNumber.from("500000");
    iTokenDecimals = await iToken.decimals();
    actualiTokenMintAmount = rawMintAmount.mul(
      ethers.BigNumber.from("10").pow(iTokenDecimals)
    );
    iUSDTDecimals = await iUSDT.decimals();
    actualiUSDTMintAmount = rawMintAmount.mul(
      ethers.BigNumber.from("10").pow(iUSDTDecimals)
    );

    await iToken
      .connect(borrower)
      .mint(borrower.address, actualiTokenMintAmount);

    await iUSDT.connect(minter).mint(minter.address, actualiUSDTMintAmount);
  }

  it("Exchange rate should not change even when flashloan all cash", async function () {
    // Initialize environments.
    await init();

    // Deposit 200ETH
    let mintAmount = ethers.utils.parseEther("2000");
    await expect(() =>
      iETH.connect(borrower).mint(borrower.address, { value: mintAmount })
    ).to.changeEtherBalances(
      [borrower, iETH],
      [mintAmount.mul(-1), mintAmount]
    );

    let actualBorrowedAmount = ethers.BigNumber.from("300").mul(
      ethers.BigNumber.from("10").pow(iUSDTDecimals)
    );
    await expect(() =>
      iUSDT.connect(borrower).borrow(actualBorrowedAmount)
    ).to.be.changeTokenBalance(USDT, borrower, actualBorrowedAmount);

    let flashloanAmount = await iToken.getCash();
    let flashloanFeeAmount = (await iToken.flashloanFeeRatio())
      .mul(flashloanAmount)
      .div(BASE);
    // add enough underlying to the flashloan executor contract to repay.
    await underlying
      .connect(minter)
      .transfer(flashloanExecutor.address, flashloanFeeAmount);

    let actualAmount = ethers.BigNumber.from("10").mul(
      ethers.BigNumber.from("10").pow(iUSDTDecimals)
    );
    await USDT.connect(minter).transfer(
      flashloanExecutor.address,
      actualAmount
    );

    let redeemerEquityInfo = await controller.calcAccountEquity(
      borrower.address
    );
    // console.log(redeemerEquityInfo[0].toString());
    // console.log(redeemerEquityInfo[1].toString());
    // console.log(redeemerEquityInfo[2].toString());
    // console.log(redeemerEquityInfo[3].toString() + '\n');

    let iTokenBalanceBefore = await iETH.balanceOf(borrower.address);
    // console.log((await iETH.balanceOf(flashloanExecutor.address)).toString());
    // console.log(iTokenBalance.toString() + "\n");
    let data = "0x";
    data =
      data +
      lendingData.address.substring(2) +
      borrower.address.substring(2) +
      iUSDT.address.substring(2) +
      iETH.address.substring(2);
    // console.log(data)
    // console.log(iUSDT.address)
    // console.log(iUSDT.address)
    // console.log(aa);

    let exchangeRateBefore = await iToken.callStatic.exchangeRateCurrent();

    // console.log(exchangeRateBefore.toString());
    await iToken
      .connect(minter)
      .flashloan(flashloanExecutor.address, await iToken.getCash(), data);

    // Exchange Rate should not change
    let exchangeRateInFlashloan = await flashloanExecutor.exchangeRate();
    // console.log((await flashloanExecutor.exchangeRate()).toString());
    expect(exchangeRateInFlashloan).to.equal(exchangeRateBefore);

    // console.log((await flashloanExecutor.shortfall()).toString());
    // console.log((await iETH.balanceOf(flashloanExecutor.address)).toString());

    // Borrower's iETH balance should not change
    let iTokenBalanceAfter = await iETH.balanceOf(borrower.address);
    //console.log(iTokenBalanceAfter.toString() + "\n");
    expect(iTokenBalanceAfter).to.equal(iTokenBalanceBefore);

    // Borrower should not have shortfall
    redeemerEquityInfo = await controller.calcAccountEquity(borrower.address);
    // console.log(redeemerEquityInfo[0].toString());
    // console.log(redeemerEquityInfo[1].toString());
    // console.log(redeemerEquityInfo[2].toString());
    // console.log(redeemerEquityInfo[3].toString());
    expect(redeemerEquityInfo[1]).to.equal(0);
  });
});
