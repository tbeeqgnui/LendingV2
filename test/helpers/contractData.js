const { expect } = require("chai");
const { ethers } = require("hardhat");

const { utils, BigNumber } = require("ethers");
const {
  parseTokenAmount,
  verifyAllowError,
  formatTokenAmount,
  calcSeizeTokens,
  divup,
  rmul,
  rdiv,
  rdivup,
} = require("./utils.js");
const {
  getBlock,
  increaseBlock,
  getiTokenCurrentData,
} = require("./fixtures.js");
const { formatEther } = require("ethers/lib/utils");

const BASE = ethers.utils.parseEther("1");
const ZERO = ethers.BigNumber.from(0);
const zeroAddress = ethers.constants.AddressZero;

// Get current contract data.
async function checkContractData(data) {
  let isBefore = data.isBefore;
  let iToken = data.iToken;
  let underlying = data.underlying;
  let spender = data.from;
  let recipient = data.to;
  if (isBefore) {
    await iToken.exchangeRateCurrent();
    let beforeTotalSupply = await iToken.totalSupply();
    let beforeCash = await iToken.getCash();
    let beforeReserves = await iToken.totalReserves();
    let beforeTotalBorrow = await iToken.totalBorrows();
    let beforeSpenderUnderlyingBalance = await underlying.balanceOf(spender);
    let beforeSpenderiTokenBalance = await iToken.balanceOf(spender);
    let beforeRecipientUnderlyingBalance = await underlying.balanceOf(
      recipient
    );
    let beforeRecipientiTokenBalance = await iToken.balanceOf(recipient);
    let beforeBorrowBalance = await iToken.borrowBalanceStored(spender);
    let beforeBehalfBorrowBalance = await iToken.borrowBalanceStored(recipient);
    return {
      beforeTotalSupply: beforeTotalSupply,
      beforeCash: beforeCash,
      beforeTotalBorrow: beforeTotalBorrow,
      beforeReserves: beforeReserves,
      beforeSpenderUnderlyingBalance: beforeSpenderUnderlyingBalance,
      beforeSpenderiTokenBalance: beforeSpenderiTokenBalance,
      beforeRecipientUnderlyingBalance: beforeRecipientUnderlyingBalance,
      beforeRecipientiTokenBalance: beforeRecipientiTokenBalance,
      beforeBorrowBalance: beforeBorrowBalance,
      beforeBehalfBorrowBalance: beforeBehalfBorrowBalance,
      iToken: iToken,
      from: spender,
      to: recipient,
      underlying: underlying,
    };
  } else if (data.functionName == "redeem") {
    let exchangeRate = await iToken.exchangeRateStored();
    let afterTotalSupply = await iToken.totalSupply();
    let afterCash = await iToken.getCash();
    let afterSpenderiTokenBalance = await iToken.balanceOf(spender);
    let afterRecipientUnderlyingBalance = await underlying.balanceOf(recipient);

    let underlyingChanged = Number(
      data.redeemAmount.mul(exchangeRate).div(BASE).toString()
    );
    let delta = 10000;

    expect(
      data.beforeSpenderiTokenBalance.sub(afterSpenderiTokenBalance)
    ).to.equal(data.redeemAmount);

    expect(
      Number(
        afterRecipientUnderlyingBalance
          .sub(data.beforeRecipientUnderlyingBalance)
          .toString()
      )
    ).to.closeTo(underlyingChanged, delta);

    expect(data.beforeTotalSupply.sub(afterTotalSupply)).to.equal(
      data.redeemAmount
    );

    expect(Number(data.beforeCash.sub(afterCash).toString())).to.closeTo(
      underlyingChanged,
      delta
    );
  } else if (data.functionName == "redeemUnderlying") {
    let exchangeRate = await iToken.exchangeRateStored();
    let afterTotalSupply = await iToken.totalSupply();
    let afterCash = await iToken.getCash();
    let afterSpenderiTokenBalance = await iToken.balanceOf(spender);
    let afterRecipientUnderlyingBalance = await underlying.balanceOf(recipient);

    let iTokenChanged = Number(
      data.redeemAmount.mul(BASE).div(exchangeRate).toString()
    );
    let delta = 10000;

    expect(
      afterRecipientUnderlyingBalance.sub(data.beforeRecipientUnderlyingBalance)
    ).to.equal(data.redeemAmount);
    expect(
      Number(
        data.beforeSpenderiTokenBalance
          .sub(afterSpenderiTokenBalance)
          .toString()
      )
    ).to.closeTo(iTokenChanged, delta);

    expect(data.beforeCash.sub(afterCash)).to.equal(data.redeemAmount);
    expect(data.beforeTotalSupply.sub(afterTotalSupply)).to.equal(
      data.redeemAmount.mul(BASE).add(exchangeRate.sub(1)).div(exchangeRate)
    );
  } else if (data.functionName == "borrow") {
    let afterTotalBorrow = await iToken.totalBorrows();
    let afterSpenderUnderlyingBalance = await underlying.balanceOf(spender);
    let afterBorrowBalance = await iToken.borrowBalanceStored(spender);

    expect(afterBorrowBalance.sub(data.beforeBorrowBalance)).to.equal(
      data.borrowAmount
    );
    expect(afterTotalBorrow.sub(data.beforeTotalBorrow)).to.equal(
      data.borrowAmount
    );
    expect(
      afterSpenderUnderlyingBalance.sub(data.beforeSpenderUnderlyingBalance)
    ).to.equal(data.borrowAmount);
  } else if (data.functionName == "repay") {
    let afterTotalBorrow = await iToken.totalBorrows();
    let afterSpenderUnderlyingBalance = await underlying.balanceOf(spender);
    let afterBorrowBalance = await iToken.borrowBalanceStored(recipient);

    let borrowChanged = Number(
      data.beforeBehalfBorrowBalance.sub(afterBorrowBalance).toString()
    );
    let delta = 10000;

    expect(
      data.beforeSpenderUnderlyingBalance.sub(afterSpenderUnderlyingBalance)
    ).to.equal(data.repayAmount);
  } else if (data.functionName == "liquidateBorrow") {
    let afterSpenderiTokenBalance = await iToken.balanceOf(spender);
    let afterRecipientiTokenBalance = await iToken.balanceOf(recipient);

    expect(afterRecipientiTokenBalance).to.gt(
      data.beforeRecipientiTokenBalance
    );
    expect(data.beforeSpenderiTokenBalance).to.gt(afterSpenderiTokenBalance);
  }
}

async function getAccountEquity(controller, account) {
  let userEquity = await controller.calcAccountEquity(account);

  return {
    validBorrowed: userEquity[0],
    shortfall: userEquity[1],
    collateral: userEquity[2],
    borrowed: userEquity[3],
  };
}

async function getAccountTotalValue(lendingData, account) {
  let userData = await lendingData.callStatic.getAccountTotalValueForTest(
    account
  );

  return {
    totalSupplyBalanceValue: userData[0],
    collateralBalanceValue: userData[1],
    borrowBalanceValue: userData[2],
    healthyFactor: userData[3],
  };
}

async function getAccountBorrowData(
  lendingData,
  iToken,
  account,
  safeMaxFactor
) {
  let accountBorrowData =
    await lendingData.callStatic.getAccountBorrowDataForTest(
      iToken.address,
      account,
      safeMaxFactor
    );

  return {
    borrowBalance: accountBorrowData[0],
    availableBorrow: accountBorrowData[1],
    safeAvailableToBorrow: accountBorrowData[2],
    // underlying balance.
    accountBalance: accountBorrowData[3],
    maxRepay: accountBorrowData[4],
    decimals: accountBorrowData[5],
  };
}

async function getAccountSupplyInfo(
  lendingData,
  iToken,
  account,
  safeMaxFactor
) {
  let accountSupplyInfo = await lendingData.callStatic.getAccountSupplyInfo(
    iToken.address,
    account,
    safeMaxFactor
  );

  return {
    supplyBalanceValue: accountSupplyInfo[0],
  };
}

async function getAccountSupplyData(
  lendingData,
  iToken,
  account,
  safeMaxFactor
) {
  let accountSupplyData =
    await lendingData.callStatic.getAccountSupplyDataForTest(
      iToken.address,
      account,
      safeMaxFactor
    );

  return {
    supplyBalanceValue: accountSupplyData[0],
    underlyingBalance: accountSupplyData[1],
    maxSupplyAmount: accountSupplyData[2],
    availableToWithdraw: accountSupplyData[3],
    safeAvailableToWithdraw: accountSupplyData[4],
    iTokenBalance: accountSupplyData[5],
    iTokenDecimals: accountSupplyData[6],
  };
}

async function getSupplyAPY(lendingData, iToken) {
  let result = await lendingData.getSupplyTokenData(iToken.address);
  return {
    supplyAPY: result[0],
  };
}

async function getBorrowAPY(lendingData, iToken) {
  let result = await lendingData.getBorrowTokenData(iToken.address);
  return {
    borrowAPY: result[2],
  };
}

async function getAllData(
  oracle,
  controller,
  lendingData,
  account,
  iToken,
  isStableCoin,
  safeFactor
) {
  let price;
  let tokenDecimals = await iToken.decimals();
  if (isStableCoin) {
    price = ethers.BigNumber.from("1");
  } else {
    price = ethers.utils
      .parseEther("1")
      .mul(ethers.BigNumber.from("10").pow(18 - tokenDecimals))
      .div(await oracle.getUnderlyingPrice(iToken.address));
  }
  let accountiTokenBalance = await iToken.balanceOf(account);
  let accountiTokenBalanceValue = accountiTokenBalance.mul(price);
  let iTokenLiquidity = await iToken.getCash();
  let totalSupply = await iToken.totalSupply();

  const {
    // collateral - borrowed
    validBorrowed,
    // borrowed -collateral
    shortfall,
    collateral,
    borrowed,
  } = await getAccountEquity(controller, account);

  const {
    // all supply assets * its price
    totalSupplyBalanceValue,
    // all assets as collateral * its price
    collateralBalanceValue,
    // all assets as borrowed * its price
    borrowBalanceValue,
    // collateralBalance / borrowBalance
    healthyFactor,
  } = await getAccountTotalValue(lendingData, account);

  // const {
  //   supplyBalanceValue
  // } = await getAccountSupplyInfo(lendingData, iToken, account, safeFactor);

  const {
    supplyBalanceValue,
    underlyingBalance,
    maxSupplyAmount,
    availableToWithdraw,
    safeAvailableToWithdraw,
    iTokenBalance,
    iTokenDecimals,
  } = await getAccountSupplyData(lendingData, iToken, account, safeFactor);

  const {
    borrowBalance,
    availableBorrow,
    safeAvailableToBorrow,
    accountBalance,
    maxRepay,
    decimals,
  } = await getAccountBorrowData(lendingData, iToken, account, safeFactor);

  return {
    accountiTokenBalance,
    accountiTokenBalanceValue,
    iTokenLiquidity,
    totalSupply,
    validBorrowed,
    shortfall,
    collateral,
    borrowed,
    totalSupplyBalanceValue,
    collateralBalanceValue,
    borrowBalance,
    healthyFactor,
    borrowBalanceValue,
    availableBorrow,
    safeAvailableToBorrow,
    accountBalance,
    maxRepay,
    decimals,
    // getAccountSupplyData
    supplyBalanceValue,
    underlyingBalance,
    maxSupplyAmount,
    availableToWithdraw,
    safeAvailableToWithdraw,
    iTokenBalance,
    iTokenDecimals,
  };
}

async function afterExecutionData(iToken, underlying, user) {
  let currentExchangeRate = await iToken.exchangeRateStored();
  let afterUserUnderlyingBalance;
  if (underlying == zeroAddress) {
    afterUserUnderlyingBalance = await user.provider.getBalance(user.address);
  } else {
    afterUserUnderlyingBalance = await underlying.balanceOf(user.address);
  }
  let afterUseriTokenBalance = await iToken.balanceOf(user.address);
  let afterTotalSupply = await iToken.totalSupply();
  let afterTotalBorrows = await iToken.totalBorrows();
  let afterCash = await iToken.getCash();
  let afterTotalReserves = await iToken.totalReserves();
  let afterBorrowIndex = await iToken.borrowIndex();

  return {
    underlying: afterUserUnderlyingBalance,
    iToken: afterUseriTokenBalance,
    supply: afterTotalSupply,
    borrow: afterTotalBorrows,
    cash: afterCash,
    exchangeRate: currentExchangeRate,
    reserve: afterTotalReserves,
    borrowIndex: afterBorrowIndex,
  };
}

async function manuallyCheck(caseDetail, expectResults) {
  let result0, result1, result2;

  if (expectResults.length != 0) {
    hasExpectResult = true;
    result0 = expectResults[0];
    result1 = expectResults[1];
    result2 = expectResults[2];
  }
  // common data
  let iToken = caseDetail.asset;
  let underlying = caseDetail.underlying;
  let user = caseDetail.user;
  let actualAmount = caseDetail.amount;
  let isStableCoin = caseDetail.isStableCoin;
  let safeFactor = caseDetail.safeFactor
    ? caseDetail.safeFactor
    : ethers.utils.parseEther("0.8");
  let lendingDataContract = caseDetail.lendingData;
  let controllerContract = caseDetail.controller;
  let oracleContract = caseDetail.oracle;
  let interestRateModelContract = caseDetail.interestRateModel;

  let delta = 0.0001; // 10**-4

  let allDataOfUser1ForUSDx = await getAllData(
    oracleContract,
    controllerContract,
    lendingDataContract,
    result0.user.address,
    result0.asset,
    isStableCoin,
    safeFactor
  );
  // console.log("iToken is: ", await result0.asset.symbol(), "\n");

  // console.log("expect iToken balance is: ", await formatTokenAmount(result0.asset, result0.expectiTokenBalance));
  // console.log( "actual iToken balance is: ", await formatTokenAmount(result0.asset, allDataOfUser1ForUSDx.iTokenBalance),"\n");

  verifyAllowError(
    allDataOfUser1ForUSDx.iTokenBalance,
    result0.expectiTokenBalance,
    delta
  );

  // console.log("expect iToken balance value is: ", await formatTokenAmount(result0.asset, result0.expectiTokenTotalBalanceValue));
  // console.log("actual iToken balance value is: ", await formatTokenAmount(result0.asset, allDataOfUser1ForUSDx.totalSupplyBalanceValue), "\n");
  verifyAllowError(
    allDataOfUser1ForUSDx.totalSupplyBalanceValue,
    result0.expectiTokenTotalBalanceValue,
    delta
  );

  // console.log("expect collateral balance value is: ",await formatTokenAmount(result0.asset, result0.expectCollateralBalanceValue));
  // console.log("actual collateral balance value is: ",await formatTokenAmount(result0.asset, allDataOfUser1ForUSDx.collateralBalanceValue), "\n");

  verifyAllowError(
    allDataOfUser1ForUSDx.collateralBalanceValue,
    result0.expectCollateralBalanceValue,
    delta
  );

  // console.log("expect healthy factor is: ", await formatTokenAmount(result0.asset, result0.expectHealthyFactor) );
  // console.log("actual healthy factor is: ", await formatTokenAmount(result0.asset, allDataOfUser1ForUSDx.healthyFactor), "\n");

  verifyAllowError(
    allDataOfUser1ForUSDx.healthyFactor,
    result0.expectHealthyFactor,
    delta
  );

  // console.log("expect liquidity is: ", await formatTokenAmount(result0.asset, result0.expectLiquidity));
  // console.log("actual liquidity is: ", await formatTokenAmount(result0.asset,allDataOfUser1ForUSDx.iTokenLiquidity), "\n");

  verifyAllowError(
    allDataOfUser1ForUSDx.iTokenLiquidity,
    result0.expectLiquidity,
    delta
  );

  // console.log("expect max avaiable withdraw amount is: ", await formatTokenAmount(result0.asset, result0.expectMaxAvaiableWithdrawValue));
  // console.log("actual max avaiable withdraw anount is: ", await formatTokenAmount(result0.asset, allDataOfUser1ForUSDx.availableToWithdraw),"\n");
  verifyAllowError(
    allDataOfUser1ForUSDx.availableToWithdraw,
    result0.expectMaxAvaiableWithdrawValue,
    delta
  );

  // console.log("expect safe avaiable withdraw amount is: ", await formatTokenAmount(result0.asset, result0.expectMaxSafeAvaiableWithdrawValue));
  // console.log("actual safe avaiable withdraw anount is: ", await formatTokenAmount(result0.asset, allDataOfUser1ForUSDx.safeAvailableToWithdraw), "\n");

  verifyAllowError(
    allDataOfUser1ForUSDx.safeAvailableToWithdraw,
    result0.expectMaxSafeAvaiableWithdrawValue,
    delta
  );

  if (Object.keys(result1).length != 0) {
    let allDataOfUser1ForUSDT = await getAllData(
      oracleContract,
      controllerContract,
      lendingDataContract,
      result1.user.address,
      result1.asset,
      isStableCoin,
      safeFactor
    );
    // console.log("iToken is: ", await result1.asset.symbol(), "\n");

    // console.log("expect iToken borrowed balance is: ", await formatTokenAmount(result1.asset, result1.expectiTokenBorrowedBalance));
    // console.log("actual iToken borrowed balance is: ", await formatTokenAmount(result1.asset, allDataOfUser1ForUSDT.borrowBalance), "\n");

    verifyAllowError(
      allDataOfUser1ForUSDT.borrowBalance,
      result1.expectiTokenBorrowedBalance,
      delta
    );

    // console.log("expect iToken borrowed balance value is: ", await formatTokenAmount(result1.asset, result1.expectiTokenBorrowedBalanceValue));
    // console.log("actual iToken borrowed balance value is: ", await formatTokenAmount(result1.asset, allDataOfUser1ForUSDT.borrowBalanceValue), "\n");

    verifyAllowError(
      allDataOfUser1ForUSDT.borrowBalanceValue,
      result1.expectiTokenBorrowedBalanceValue,
      delta
    );

    // console.log("expect max avaiable borrow is: ", await formatTokenAmount(result1.asset, result1.expectMaxAvaiableBorrow));
    // console.log("actual max avaiable borrow is: ", await formatTokenAmount(result1.asset, allDataOfUser1ForUSDT.availableBorrow), "\n");

    verifyAllowError(
      allDataOfUser1ForUSDT.availableBorrow,
      result1.expectMaxAvaiableBorrow,
      delta
    );

    // console.log("expect safe avaiable borrow is: ", await formatTokenAmount(result1.asset, result1.expectSafeAvaiableBorrow));
    // console.log("actual safe avaiable borrow is: ", await formatTokenAmount(result1.asset, allDataOfUser1ForUSDT.safeAvailableToBorrow), "\n");

    verifyAllowError(
      allDataOfUser1ForUSDT.safeAvailableToBorrow,
      result1.expectSafeAvaiableBorrow,
      delta
    );

    // console.log("expect liquidity is: ", await formatTokenAmount(result1.asset, result1.expectLiquidity));
    // console.log("actual liquidity is: ", await formatTokenAmount(result1.asset, allDataOfUser1ForUSDT.iTokenLiquidity), "\n");

    verifyAllowError(
      allDataOfUser1ForUSDT.iTokenLiquidity,
      result1.expectLiquidity,
      delta
    );
  }

  if (Object.keys(result2).length != 0) {
    let allDataOfUser2ForUSDT = await getAllData(
      oracleContract,
      controllerContract,
      lendingDataContract,
      result2.user.address,
      result2.asset,
      isStableCoin,
      safeFactor
    );
    // console.log("iToken is: ", await result2.asset.symbol(), "\n");

    // console.log("expect iToken balance is: ", await formatTokenAmount(result2.asset, result2.expectiTokenBalance));
    // console.log("actual iToken balance is: ", await formatTokenAmount(result2.asset, allDataOfUser2ForUSDT.iTokenBalance), "\n");

    verifyAllowError(
      allDataOfUser2ForUSDT.iTokenBalance,
      result2.expectiTokenBalance,
      delta
    );

    // console.log("expect iToken balance value is: ", await formatTokenAmount(result2.asset, result2.expectiTokenTotalBalanceValue));
    // console.log("actual iToken balance value is: ", await formatTokenAmount(result2.asset, allDataOfUser2ForUSDT.supplyBalanceValue), "\n");

    verifyAllowError(
      allDataOfUser2ForUSDT.supplyBalanceValue,
      result2.expectiTokenTotalBalanceValue,
      delta
    );

    // console.log("expect collateral balance value is: ", await formatTokenAmount(result2.asset, result2.expectCollateralBalanceValue));
    // console.log("actual collateral balance value is: ", await formatTokenAmount(result2.asset, allDataOfUser2ForUSDT.collateralBalanceValue), "\n");

    verifyAllowError(
      allDataOfUser2ForUSDT.collateralBalanceValue,
      result2.expectCollateralBalanceValue,
      delta
    );

    // console.log("expect healthy factor is: ", await formatTokenAmount(result2.asset, result2.expectHealthyFactor));
    // console.log("actual healthy factor is: ", await formatTokenAmount(result2.asset, allDataOfUser2ForUSDT.healthyFactor), "\n");

    verifyAllowError(
      allDataOfUser2ForUSDT.healthyFactor,
      result2.expectHealthyFactor,
      delta
    );

    const { supplyAPY } = await getSupplyAPY(
      lendingDataContract,
      result2.asset
    );
    // console.log("usdt supply APY is: ", supplyAPY.toString());
    const { borrowAPY } = await getBorrowAPY(
      lendingDataContract,
      result2.asset
    );
    // console.log("usdt borrow APY is: ", borrowAPY.toString());
  }
}

async function callFunctions(
  action,
  underlying,
  iToken,
  executor,
  borrower,
  amount,
  collateralToken
) {
  switch (action) {
    case "mint":
      if (underlying != zeroAddress) {
        await iToken.connect(executor).mint(executor.address, amount);
      } else {
        await iToken
          .connect(executor)
          .mint(executor.address, { value: amount });
      }
      break;
    case "redeem":
      await iToken.connect(executor).redeem(executor.address, amount);
      break;
    case "redeemUnderlying":
      await iToken.connect(executor).redeemUnderlying(executor.address, amount);
      break;
    case "borrow":
      await iToken.connect(executor).borrow(amount);
      break;
    case "repay":
      if (underlying != zeroAddress) {
        await iToken.connect(executor).repayBorrow(amount);
      } else {
        await iToken.connect(executor).repayBorrow({ value: amount });
      }
      break;
    case "repayBorrowBehalf":
      if (underlying != zeroAddress) {
        await iToken
          .connect(executor)
          .repayBorrowBehalf(borrower.address, amount);
      } else {
        await iToken
          .connect(executor)
          .repayBorrowBehalf(borrower.address, { value: amount });
      }
      break;
    case "transfer":
      await iToken.connect(executor).transfer(borrower.address, amount);
      break;
    case "liquidateBorrow":
      if (underlying != zeroAddress) {
        await iToken
          .connect(executor)
          .liquidateBorrow(borrower.address, amount, collateralToken.address);
      } else {
        await iToken
          .connect(executor)
          .liquidateBorrow(borrower.address, collateralToken.address, {
            value: amount,
          });
      }
      break;
  }
}

async function calculateResult(
  isiToken,
  action,
  amount,
  exchangeRate,
  underlying,
  iToken,
  collateralToken
) {
  let expectBorrowedDelta,
    expectSuppliedDelta,
    expectUnderlyingDelta,
    expectiTokenDelta,
    expectCashDelta;
  switch (action) {
    case "mint":
      expectUnderlyingDelta = amount.mul(-1);
      expectiTokenDelta = amount.mul(BASE).div(exchangeRate);
      expectBorrowedDelta = ZERO;
      expectSuppliedDelta = expectiTokenDelta;
      expectCashDelta = amount;
      break;
    case "redeem":
      expectUnderlyingDelta = amount.mul(exchangeRate).div(BASE);
      expectiTokenDelta = amount.mul(-1);
      expectBorrowedDelta = ZERO;
      expectSuppliedDelta = amount.mul(-1);
      expectCashDelta = amount.mul(exchangeRate).div(BASE).mul(-1);
      break;
    case "redeemUnderlying":
      expectUnderlyingDelta = amount;
      expectiTokenDelta = rdivup(amount, exchangeRate).mul(-1);
      expectBorrowedDelta = ZERO;
      expectSuppliedDelta = rdivup(amount, exchangeRate).mul(-1);
      expectCashDelta = amount.mul(-1);
      break;
    case "borrow":
      expectUnderlyingDelta = amount;
      expectiTokenDelta = ZERO;
      expectBorrowedDelta = amount;
      expectSuppliedDelta = ZERO;
      expectCashDelta = amount.mul(-1);
      if (!isiToken) {
        expectCashDelta = ZERO;
      }
      break;
    case "repay":
    case "repayBorrowBehalf":
      expectUnderlyingDelta = amount.mul(-1);
      expectiTokenDelta = ZERO;
      expectBorrowedDelta = amount.mul(-1);
      expectSuppliedDelta = ZERO;
      expectCashDelta = amount;
      if (!isiToken) {
        expectCashDelta = ZERO;
      }
      break;
    case "transfer":
      expectUnderlyingDelta = ZERO;
      expectiTokenDelta = amount.mul(-1);
      expectBorrowedDelta = ZERO;
      expectSuppliedDelta = ZERO;
      expectCashDelta = ZERO;
      break;
    case "liquidateBorrow":
      expectUnderlyingDelta = amount.mul(-1);
      expectiTokenDelta = ZERO;
      expectBorrowedDelta = amount.mul(-1);
      expectSuppliedDelta = ZERO;
      expectCashDelta = amount;
      if (!isiToken) {
        expectCashDelta = ZERO;
      }
      if (iToken.address == collateralToken.address) {
        expectiTokenDelta = amount;
        expectCashDelta = ZERO;
      }
      break;
  }

  return {
    underlyingBalance: expectUnderlyingDelta,
    iTokenBalance: expectiTokenDelta,
    totalBorrows: expectBorrowedDelta,
    totalSupply: expectSuppliedDelta,
    totalCash: expectCashDelta,
    underlyingToken: underlying,
    action: action,
  };
}

async function getBorrowedSnapshot(iToken, account) {
  return await iToken.borrowSnapshot(account.address);
}

async function getAssetInfo(iToken) {
  let totalBorrows = await iToken.callStatic.totalBorrowsCurrent();
  return { totalBorrows };
}

async function executeOperations(caseDetails, expectResults = []) {
  const caseLength = caseDetails.length;
  let hasExpectResult = false;
  let delta = 50000;
  if (expectResults.length != 0) {
    hasExpectResult = true;
  }
  for (let i = 0; i < caseLength; i++) {
    let caseDetail = caseDetails[i];
    let expectResult = expectResults[i];
    let iToken = caseDetail.asset;
    let isiToken = await iToken.isiToken();
    let underlying = caseDetail.underlying;
    let executor = caseDetail.user;
    let borrower;
    let collateralToken;
    let action = caseDetail.action;
    let actualAmount = caseDetail.amount;
    let blockDelta = caseDetail.blockDelta;
    let lendingData = caseDetail.lendingData;
    let controller = caseDetail.controller;
    let oracle = caseDetail.oracle;

    if (action == "repay") {
      borrower = executor;
    } else {
      borrower = caseDetail.borrower;
    }

    let beforeCollateralDetails;
    let expectCollateralDetails;
    let afterCollateralDetails;

    let beforeBorrowerBorrowedAmount, afterBorrowerBorrowedAmount;
    let beforeBorrowerCollateralAmount, afterBorrowerCollateralAmount;
    let beforeLiquidatorUnderlyingAmount, afterLiquidatorUnderlyingAmount;
    let beforeLiquidatorCollateralAmount, afterLiquidatorCollateralAmount;

    let actualSeizeAmount, expectSeizeAmount;

    let delta = 0.001;
    let liquidateIncentive;

    if (action == "liquidateBorrow") {
      liquidateIncentive = await controller.liquidationIncentiveMantissa();
      collateralToken = caseDetail.collateral;
      // calculate expected status for collateral token when liquidate
      expectCollateralDetails = await getAccruedData(collateralToken, 1);
      beforeCollateralDetails = await getAssetInfo(collateralToken);
      beforeBorrowerBorrowedAmount =
        await iToken.callStatic.borrowBalanceCurrent(borrower.address);
      beforeBorrowerCollateralAmount = await collateralToken.balanceOf(
        borrower.address
      );

      if (underlying == zeroAddress) {
        beforeLiquidatorUnderlyingAmount = await executor.provider.getBalance(
          executor.address
        );
      } else {
        beforeLiquidatorUnderlyingAmount = await underlying.balanceOf(
          executor.address
        );
      }
      beforeLiquidatorCollateralAmount = await collateralToken.balanceOf(
        executor.address
      );

      expectSeizeAmount = await calcSeizeTokens(
        iToken,
        collateralToken,
        controller,
        expectCollateralDetails.exchangeRate,
        actualAmount,
        oracle
      );
    }

    let beforeState = await getContractData(
      controller,
      iToken,
      underlying,
      executor
    );

    // calculate expected status
    const { totalReserves, borrowIndex, interestAccumulated } =
      await getAccruedData(iToken, 1);

    let deltaResults;

    if (actualAmount.toString() == "0") {
      return;
    }
    await callFunctions(
      action,
      underlying,
      iToken,
      executor,
      borrower,
      actualAmount,
      collateralToken
    );

    let afterState = await getContractData(
      controller,
      iToken,
      underlying,
      executor
    );

    if (action == "liquidateBorrow") {
      afterCollateralDetails = await getAssetInfo(collateralToken);

      afterBorrowerBorrowedAmount =
        await iToken.callStatic.borrowBalanceCurrent(borrower.address);
      afterBorrowerCollateralAmount = await collateralToken.balanceOf(
        borrower.address
      );

      if (underlying == zeroAddress) {
        afterLiquidatorUnderlyingAmount = await executor.provider.getBalance(
          executor.address
        );
      } else {
        afterLiquidatorUnderlyingAmount = await underlying.balanceOf(
          executor.address
        );
      }
      afterLiquidatorCollateralAmount = await collateralToken.balanceOf(
        executor.address
      );

      actualSeizeAmount = beforeBorrowerCollateralAmount.sub(
        afterBorrowerCollateralAmount
      );

      // cause rounding calculation
      if (underlying == zeroAddress) {
        verifyAllowError(
          beforeBorrowerBorrowedAmount
            .add(interestAccumulated)
            .sub(afterBorrowerBorrowedAmount),
          actualAmount,
          delta
        );
        verifyAllowError(
          beforeLiquidatorUnderlyingAmount.sub(afterLiquidatorUnderlyingAmount),
          actualAmount,
          delta
        );
      } else {
        expect(
          beforeBorrowerBorrowedAmount
            .add(interestAccumulated)
            .sub(afterBorrowerBorrowedAmount)
            .sub(actualAmount)
        ).to.lt("50000");
        expect(
          beforeLiquidatorUnderlyingAmount.sub(afterLiquidatorUnderlyingAmount)
        ).to.equal(actualAmount);
      }
      expect(actualSeizeAmount).to.equal(
        afterLiquidatorCollateralAmount.sub(beforeLiquidatorCollateralAmount)
      );
      expect(actualSeizeAmount).to.equal(expectSeizeAmount);
    }

    deltaResults = await calculateResult(
      isiToken,
      action,
      actualAmount,
      afterState.exchangeRate,
      underlying,
      // controller,
      iToken,
      collateralToken
    );

    if (action != "transfer") {
      expect(totalReserves).to.equal(afterState.reserve);
      expect(borrowIndex).to.equal(afterState.borrowIndex);
    } else {
      expect(beforeState["equity"]).to.gt(afterState["equity"]);
    }

    let checkingKeies = [
      "underlyingBalance",
      "iTokenBalance",
      "totalBorrows",
      "totalSupply",
      "totalCash",
    ];
    for (key of checkingKeies) {
      let actualInterestAccumulated = ZERO;
      if (
        deltaResults.underlyingToken == zeroAddress &&
        key == "underlyingBalance"
      ) {
        verifyAllowError(
          beforeState[key].add(deltaResults[key]),
          afterState[key],
          delta
        );
        continue;
      }

      if (key == "totalBorrows" && action != "transfer") {
        actualInterestAccumulated = interestAccumulated;
      }

      expect(
        beforeState[key].add(actualInterestAccumulated).add(deltaResults[key])
      ).to.equal(afterState[key]);
    }

    if (hasExpectResult) {
      await manuallyCheck(caseDetail, expectResults);
    }
  }
}

async function getContractData(controller, iToken, underlying, user) {
  let exchangeRate = await iToken.exchangeRateStored();
  let userUnderlyingBalance;
  if (underlying == zeroAddress) {
    userUnderlyingBalance = await user.provider.getBalance(user.address);
  } else {
    userUnderlyingBalance = await underlying.balanceOf(user.address);
  }
  let useriTokenBalance = await iToken.balanceOf(user.address);
  let totalSupply = await iToken.totalSupply();
  let totalBorrows = await iToken.totalBorrows();
  let cash = await iToken.getCash();
  let totalReserves = await iToken.totalReserves();
  let borrowIndex = await iToken.borrowIndex();
  let equity = (await controller.calcAccountEquity(user.address))[0];

  return {
    underlyingBalance: userUnderlyingBalance,
    iTokenBalance: useriTokenBalance,
    totalSupply: totalSupply,
    totalBorrows: totalBorrows,
    totalCash: cash,
    exchangeRate: exchangeRate,
    reserve: totalReserves,
    borrowIndex: borrowIndex,
    equity: equity,
  };
}

async function getAccruedData(iTokenContract, increaseblock = 0) {
  let accrualBlockNumber = ethers.BigNumber.from(await getBlock()).add(
    ethers.BigNumber.from(increaseblock)
  );
  let borrowRate = await iTokenContract.borrowRatePerUnit();
  let simpleInterestFactor = borrowRate.mul(
    accrualBlockNumber.sub(await iTokenContract.accrualBlockNumber())
  );

  let totalBorrows = await iTokenContract.totalBorrows();
  let base = ethers.utils.parseEther("1");
  let interestAccumulated = simpleInterestFactor.mul(totalBorrows).div(base);
  totalBorrows = interestAccumulated.add(totalBorrows);

  let totalReserves = await iTokenContract.totalReserves();
  let reserveRatio = await iTokenContract.reserveRatio();
  totalReserves = reserveRatio
    .mul(interestAccumulated)
    .div(base)
    .add(totalReserves);

  let borrowIndex = await iTokenContract.borrowIndex();
  borrowIndex = simpleInterestFactor
    .mul(borrowIndex)
    .div(base)
    .add(borrowIndex);

  let totalSupply = await iTokenContract.totalSupply();
  let cash = await iTokenContract.getCash();
  let exchangeRate =
    totalSupply.toString() == "0"
      ? base
      : cash.add(totalBorrows).sub(totalReserves).mul(base).div(totalSupply);

  return {
    cash,
    borrowRate,
    accrualBlockNumber,
    totalSupply,
    totalBorrows,
    totalReserves,
    exchangeRate,
    borrowIndex,
    interestAccumulated,
  };
}

// Use the evm_snapshot to try to go forward and back in time
async function getContractDataWithBlockDelta(
  calls,
  iTokenToInteract,
  blockDelta
) {
  const snapshotId = await ethers.provider.send("evm_snapshot", []);

  if (blockDelta > 0) {
    // updateInterest will forword 1 block
    await increaseBlock(blockDelta - 1);
    await iTokenToInteract.updateInterest();
  }

  const results = await Promise.all(
    calls.map(async ([contract, func, args]) =>
      contract.functions[func](...args)
    )
  );

  await ethers.provider.send("evm_revert", [snapshotId]);

  return results;
}

async function getMaxRedeemable(
  controller,
  priceOracle,
  account,
  iTokenToRedeem,
  blockDelta
) {
  const [accountEquity, [exchangeRate]] = await getContractDataWithBlockDelta(
    [
      [controller, "calcAccountEquity", [account]],
      [iTokenToRedeem, "exchangeRateStored", []],
    ],
    iTokenToRedeem,
    blockDelta
  );

  const market = await controller.markets(iTokenToRedeem.address);

  // TODO: take borrow factor into account
  let maxRedeemableUnderlying = rdiv(accountEquity[0], market[0]).div(
    await priceOracle.getUnderlyingPrice(iTokenToRedeem.address)
  );

  const maxRedeemable = rdiv(maxRedeemableUnderlying, exchangeRate);

  if (maxRedeemableUnderlying.gt(0)) {
    maxRedeemableUnderlying = maxRedeemableUnderlying.sub(1);
  }

  return { maxRedeemable, maxRedeemableUnderlying };
}

async function getMaxBorrowable(
  controller,
  priceOracle,
  account,
  iTokenToBorrow,
  blockDelta
) {
  const [accountEquity] = await getContractDataWithBlockDelta(
    [[controller, "calcAccountEquity", [account]]],
    iTokenToBorrow,
    blockDelta
  );

  // const market = await controller.markets(iTokenToRedeem.address);

  // TODO: take borrow factor into account
  const maxBorrowable = accountEquity[0].div(
    await priceOracle.getUnderlyingPrice(iTokenToBorrow.address)
  );

  return maxBorrowable;
}

async function getiTokenBasicData(iToken) {
  const totalSupply = await iToken.totalSupply();
  const cash = await iToken.getCash();
  const totalReserves = await iToken.totalReserves();
  const totalBorrows = await iToken.totalBorrows();

  return {
    totalSupply,
    cash,
    totalReserves,
    totalBorrows,
  };
}

async function getAccountiTokenData(account, iToken) {
  const balance = await iToken.balanceOf(account);
  const borrowBalance = await iToken.borrowBalanceStored(account);

  const underlying = await iToken.underlying();

  let underlyingBalance;
  if (underlying == zeroAddress) {
    underlyingBalance = await ethers.provider.getBalance(account);
  } else {
    // TODO: To read the underlying contract from some global mapping
    const underlyingToken = await (
      await ethers.getContractFactory("Token")
    ).attach(underlying);
    underlyingBalance = await underlyingToken.balanceOf(account);
  }

  const borrowSnapshot = await iToken.borrowSnapshot(account);

  return { balance, borrowBalance, underlyingBalance, borrowSnapshot };
}

async function getAccountData(account, iTokens) {
  let result = {};

  result.iTokens = {};
  for (iToken of iTokens) {
    result.iTokens[iToken.address] = await getAccountiTokenData(
      account,
      iToken
    );
  }

  // TODO: Equity?

  return result;
}

async function getiTokensData(iTokens, accounts) {
  let result = {};

  result.iTokens = {};
  for (iToken of iTokens) {
    result.iTokens[iToken.address] = await getiTokenBasicData(iToken);
  }

  result.accounts = {};
  for (account of accounts) {
    result.accounts[account] = await getAccountData(account, iTokens);
  }

  // console.log(JSON.stringify(result, null, 2));

  return result;
}

// Calculate user borrow amount
function calcBorrowBalance(currentBorrowIndex, lastBorrowSnapshot) {
  let zero = ethers.utils.parseUnits("0", "wei");
  if (lastBorrowSnapshot[0].eq(zero) || lastBorrowSnapshot[1].eq(zero))
    return zero;

  return divup(
    lastBorrowSnapshot[0].mul(currentBorrowIndex),
    lastBorrowSnapshot[1]
  );
}

async function calcExpectedForRedeem(before, action) {
  // This is a shallow copy, before should not be used any more
  let expected = before;

  // Simulates the updateInterest
  const {
    cash,
    borrowRate,
    accrualBlockNumber,
    totalSupply,
    totalBorrows,
    totalReserves,
    exchangeRate,
    borrowIndex,
    interestAccumulated,
  } = await getiTokenCurrentData(action.target, 1);

  // console.log(exchangeRate.mul(1));

  const redeemToken = action.target.address;
  const from = action.args[0];
  const to = await action.executor.getAddress();

  let redeemAmount, redeemUnderlying;
  if (action.func == "redeem") {
    redeemAmount = action.args[1];
    // Rounding down
    redeemUnderlying = rmul(redeemAmount, exchangeRate);
  } else {
    // redeeemUnderlying
    redeemUnderlying = action.args[1];

    // Rounding up
    redeemAmount = rdivup(redeemUnderlying, exchangeRate);
  }

  // iToken state changes
  let redeemTokenState = expected.iTokens[redeemToken];
  redeemTokenState.totalSupply = redeemTokenState.totalSupply.sub(redeemAmount);
  redeemTokenState.cash = redeemTokenState.cash.sub(redeemUnderlying);
  redeemTokenState.totalBorrows = totalBorrows;
  redeemTokenState.totalReserves = totalReserves;

  // Account state changes
  // From account
  let fromState = expected.accounts[from].iTokens[redeemToken];
  fromState.balance = fromState.balance.sub(redeemAmount);
  fromState.borrowBalance = calcBorrowBalance(
    borrowIndex,
    fromState.borrowSnapshot
  );

  // To account
  let toState = expected.accounts[to].iTokens[redeemToken];
  toState.underlyingBalance = toState.underlyingBalance.add(redeemUnderlying);
  toState.borrowBalance = calcBorrowBalance(
    borrowIndex,
    toState.borrowSnapshot
  );

  return expected;
}

async function calcExpectedForMint(before, action) {
  // This is a shallow copy, before should not be used any more
  let expected = before;

  // Simulates the updateInterest
  const {
    cash,
    borrowRate,
    accrualBlockNumber,
    totalSupply,
    totalBorrows,
    totalReserves,
    exchangeRate,
    borrowIndex,
    interestAccumulated,
  } = await getiTokenCurrentData(action.target, 1);

  const mintToken = action.target.address;
  const to = action.args[0];
  const from = await action.executor.getAddress();

  const underlying = await action.target.underlying();
  let mintUnderlying;
  if (underlying == zeroAddress) {
    mintUnderlying = action.args[1].value;
  } else {
    mintUnderlying = action.args[1];
  }

  // Rounding down
  const mintAmount = rdiv(mintUnderlying, exchangeRate);

  // iToken state changes
  let tokenState = expected.iTokens[mintToken];
  tokenState.totalSupply = tokenState.totalSupply.add(mintAmount);
  tokenState.cash = tokenState.cash.add(mintUnderlying);
  tokenState.totalBorrows = totalBorrows;
  tokenState.totalReserves = totalReserves;

  // Account state changes
  // From account
  let fromState = expected.accounts[from].iTokens[mintToken];
  fromState.underlyingBalance = fromState.underlyingBalance.sub(mintUnderlying);
  fromState.borrowBalance = calcBorrowBalance(
    borrowIndex,
    fromState.borrowSnapshot
  );

  // To account
  let toState = expected.accounts[to].iTokens[mintToken];
  toState.balance = toState.balance.add(mintAmount);
  toState.borrowBalance = calcBorrowBalance(
    borrowIndex,
    toState.borrowSnapshot
  );

  return expected;
}

async function calcExpectedForBorrow(before, action) {
  // This is a shallow copy, before should not be used any more
  let expected = before;

  // Simulates the updateInterest
  const {
    cash,
    borrowRate,
    accrualBlockNumber,
    totalSupply,
    totalBorrows,
    totalReserves,
    exchangeRate,
    borrowIndex,
    interestAccumulated,
  } = await getiTokenCurrentData(action.target, 1);

  const borrowToken = action.target.address;
  const account = await action.executor.getAddress();
  const borrowUnderlying = action.args[0];

  // iToken state changes
  let tokenState = expected.iTokens[borrowToken];
  tokenState.cash = tokenState.cash.sub(borrowUnderlying);
  tokenState.totalBorrows = totalBorrows.add(borrowUnderlying);
  tokenState.totalReserves = totalReserves;

  // Account state changes
  let accountState = expected.accounts[account].iTokens[borrowToken];
  accountState.underlyingBalance =
    accountState.underlyingBalance.add(borrowUnderlying);
  accountState.borrowBalance = calcBorrowBalance(
    borrowIndex,
    accountState.borrowSnapshot
  ).add(borrowUnderlying);

  return expected;
}

async function calcExpectedForRepay(before, action) {
  // This is a shallow copy, before should not be used any more
  let expected = before;

  // Simulates the updateInterest
  const {
    cash,
    borrowRate,
    accrualBlockNumber,
    totalSupply,
    totalBorrows,
    totalReserves,
    exchangeRate,
    borrowIndex,
    interestAccumulated,
  } = await getiTokenCurrentData(action.target, 1);

  const repayToken = action.target.address;
  const payer = await action.executor.getAddress();
  const borrower = action.func == "repayBorrow" ? payer : action.args[0];

  const underlying = await action.target.underlying();
  let repayUnderlying;
  if (underlying == zeroAddress) {
    // iETH
    if (action.func == "repayBorrow") {
      repayUnderlying = action.args[0].value;
    } else {
      repayUnderlying = action.args[1].value;
    }
  } else {
    if (action.func == "repayBorrow") {
      repayUnderlying = action.args[0];
    } else {
      repayUnderlying = action.args[1];
    }
  }

  // iToken state changes
  let tokenState = expected.iTokens[repayToken];
  tokenState.cash = tokenState.cash.add(repayUnderlying);
  tokenState.totalBorrows = totalBorrows.sub(repayUnderlying);
  tokenState.totalReserves = totalReserves;

  // Account state changes
  // payer account
  let payerState = expected.accounts[payer].iTokens[repayToken];
  payerState.underlyingBalance =
    payerState.underlyingBalance.sub(repayUnderlying);

  // borrower account
  let borrowerState = expected.accounts[borrower].iTokens[repayToken];
  borrowerState.borrowBalance = calcBorrowBalance(
    borrowIndex,
    borrowerState.borrowSnapshot
  ).sub(repayUnderlying);

  return expected;
}

async function calcExpectedForLiquidate(before, action) {
  // This is a shallow copy, before should not be used any more
  let expected = before;

  // Simulates the updateInterest
  const {
    cash,
    borrowRate,
    accrualBlockNumber,
    totalSupply,
    totalBorrows,
    totalReserves,
    exchangeRate,
    borrowIndex,
    interestAccumulated,
  } = await getiTokenCurrentData(action.target, 1);

  const repayToken = action.target.address;
  const payer = await action.executor.getAddress();
  const borrower = action.args[0];

  const underlying = await action.target.underlying();
  let repayUnderlying, seizeToken;
  if (underlying == zeroAddress) {
    repayUnderlying = action.args[2].value;
    seizeToken = action.args[1];
  } else {
    repayUnderlying = action.args[1];
    seizeToken = action.args[2];
  }

  const seizeTokenContract = await (
    await ethers.getContractFactory("iToken")
  ).attach(seizeToken);

  const seizeUnderlying = await seizeTokenContract.underlying();

  // Simulates the updateInterest of Seized Token
  const {
    totalBorrows: seizeTotalBorrows,
    totalReserves: seizeTotalReserves,
    exchangeRate: seizeExchangeRate,
    borrowIndex: seizeBorrowIndex,
  } = await getiTokenCurrentData(seizeTokenContract, 1);

  const controller = await (
    await ethers.getContractFactory("Controller")
  ).attach(await seizeTokenContract.controller());

  const oracle = await (
    await ethers.getContractFactory("PriceOracle")
  ).attach(await controller.priceOracle());

  const seizeAmount = await calcSeizeTokens(
    action.target,
    seizeTokenContract,
    controller,
    seizeExchangeRate,
    repayUnderlying,
    oracle
  );

  // iToken state changes
  let seizeTokenState = expected.iTokens[seizeToken];
  seizeTokenState.totalBorrows = seizeTotalBorrows;
  seizeTokenState.totalReserves = seizeTotalReserves;

  // If seizeToken == repayToken, repayToken should override totalBorrows
  let repayTokenState = expected.iTokens[repayToken];
  repayTokenState.cash = repayTokenState.cash.add(repayUnderlying);
  repayTokenState.totalBorrows = totalBorrows.sub(repayUnderlying);
  repayTokenState.totalReserves = totalReserves;

  // Account state changes
  // payer account
  let payerRepayState = expected.accounts[payer].iTokens[repayToken];
  let payerSeizeState = expected.accounts[payer].iTokens[seizeToken];
  payerRepayState.underlyingBalance =
    payerRepayState.underlyingBalance.sub(repayUnderlying);
  payerSeizeState.balance = payerSeizeState.balance.add(seizeAmount);

  // Note: for repay iMUSX to seize iUSX, both share the same underlying
  if (underlying == seizeUnderlying) {
    payerSeizeState.underlyingBalance = payerRepayState.underlyingBalance;
  }

  // Update interest for borrow balance
  payerRepayState.borrowBalance = calcBorrowBalance(
    borrowIndex,
    payerRepayState.borrowSnapshot
  );
  payerSeizeState.borrowBalance = calcBorrowBalance(
    seizeBorrowIndex,
    payerSeizeState.borrowSnapshot
  );

  // borrower account
  let borrowerRepayState = expected.accounts[borrower].iTokens[repayToken];
  let borrowerSeizeState = expected.accounts[borrower].iTokens[seizeToken];
  borrowerSeizeState.borrowBalance = calcBorrowBalance(
    seizeBorrowIndex,
    borrowerSeizeState.borrowSnapshot
  );
  // If seizeToken == repayToken repayToken should override borrowBalance
  borrowerRepayState.borrowBalance = calcBorrowBalance(
    borrowIndex,
    borrowerRepayState.borrowSnapshot
  ).sub(repayUnderlying);
  borrowerSeizeState.balance = borrowerSeizeState.balance.sub(seizeAmount);

  return expected;
}

async function calcExpectedForTransfer(before, action) {
  // This is a shallow copy, before should not be used any more
  let expected = before;

  // transfer/tranferFrom does not update interest

  const transferToken = action.target.address;

  let from, to, amount;
  if (action.func == "transfer") {
    from = await action.executor.getAddress();
    to = action.args[0];
    amount = action.args[1];
  } else {
    from = action.args[0];
    to = action.args[1];
    amount = action.args[2];
  }

  // iToken state have no changes

  // Account state changes
  // from account
  let fromState = expected.accounts[from].iTokens[transferToken];
  fromState.balance = fromState.balance.sub(amount);

  // to account
  let toState = expected.accounts[to].iTokens[transferToken];
  toState.balance = toState.balance.add(amount);

  return expected;
}

async function calcExpected(before, action) {
  let expected;

  switch (action.func) {
    case "mint":
      expected = await calcExpectedForMint(before, action);
      break;

    case "redeem":
    case "redeemUnderlying":
      expected = await calcExpectedForRedeem(before, action);
      break;

    case "borrow":
      expected = await calcExpectedForBorrow(before, action);
      break;

    case "repayBorrow":
    case "repayBorrowBehalf":
      expected = await calcExpectedForRepay(before, action);
      break;

    case "liquidateBorrow":
      expected = await calcExpectedForLiquidate(before, action);
      break;

    case "transfer":
    case "transferFrom":
      expected = await calcExpectedForTransfer(before, action);
      break;

    default:
      expected = before;
  }

  return expected;
}

async function verifyiTokensData(action, expected, actual) {
  // Ignore borrow snapshot
  for (account in expected.accounts) {
    for (address in expected.accounts[account].iTokens) {
      delete expected.accounts[account].iTokens[address].borrowSnapshot;
      delete actual.accounts[account].iTokens[address].borrowSnapshot;
    }
  }

  // Ignore cash for MSD
  const isiToken = await action.target.isiToken();
  if (!isiToken) {
    delete expected.iTokens[action.target.address].cash;
    delete actual.iTokens[action.target.address].cash;
  }

  expect(expected).to.deep.equal(actual);
}

async function updateETHBalanceForExecutor(action, expected, txFee) {
  const underlying = await action.target.underlying();

  if (underlying != zeroAddress) return;

  const executorAddr = await action.executor.getAddress();

  // Sub txFee from executor's ETH balance
  expected.accounts[executorAddr].iTokens[
    action.target.address
  ].underlyingBalance =
    expected.accounts[executorAddr].iTokens[
      action.target.address
    ].underlyingBalance.sub(txFee);
}

async function executeAndVerify(action, iTokens, accounts) {
  const beforeState = await getiTokensData(iTokens, accounts);

  // It reads from current token, needs to be called before action
  let expected = await calcExpected(beforeState, action);

  const txResponse = await action.target
    .connect(action.executor)
    .functions[action.func](...action.args);

  const txReceipt = await txResponse.wait();
  const gasPrice = txResponse.gasPrice;
  const gasUsed = txReceipt.gasUsed;
  const txFee = gasPrice.mul(gasUsed);

  // For iETH, the underlying balance check should take txFee into account
  await updateETHBalanceForExecutor(action, expected, txFee);

  const afterState = await getiTokensData(iTokens, accounts);
  await verifyiTokensData(action, expected, afterState);
}

module.exports = {
  checkContractData,
  executeOperations,
  getAllData,
  getAccountEquity,
  getAccountTotalValue,
  getAccountBorrowData,
  getAccountSupplyData,
  getSupplyAPY,
  getBorrowAPY,
  getContractDataWithBlockDelta,
  getMaxRedeemable,
  getMaxBorrowable,
  getiTokensData,
  verifyiTokensData,
  calcExpected,
  executeAndVerify,
};
