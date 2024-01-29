import { run } from "./helpers/utils";
import { attachContractAtAdddress, printParam } from "./helpers/contract";

let task = { name: "Lending" };

const ZERO = ethers.utils.parseEther("0");
const BASE = ethers.utils.parseEther("1");
const MIN_VALUE = ethers.utils.parseEther("5000").mul(BASE);
const owner = '0xbD206d0677BEf61f3abA309f84473fCF5C44C880';

async function withdrawEarning() {

  let priceOracleAddress = await task.contracts.controller.priceOracle();
  let priceOracle = ethers.version[0] == 4 ? await attachContractAtAdddress(task.signer, priceOracleAddress, "IPriceOracle", "contracts/interface/") : await attachContractAtAdddress(task.signer, priceOracleAddress, "PriceOracleV2");
  
  let iTokens = await task.contracts.controller.getAlliTokens();
  let iTokenInfo = {};
  let transferAmount = {};
  await Promise.all(iTokens.map(async (iToken) => {
    let contract = await attachContractAtAdddress(task.signer, iToken, "iToken");
    let totalReserves = await contract.totalReserves();
    if (totalReserves == '0')
      return;

    let underlying = await contract.underlying();
    transferAmount[underlying] = transferAmount.hasOwnProperty(underlying) ? transferAmount[underlying].add(totalReserves) : totalReserves;
    // if (underlying == '0x0000000000000000000000000000000000000000')
    //   return;

      let price = ethers.version[0] == 4 ? await priceOracle.getUnderlyingPrice(iToken) : await priceOracle.callStatic.getUnderlyingPrice(iToken);

    iTokenInfo[iToken] = {
      contract:       contract,
      address:        iToken,
      underlying:     underlying,
      totalReserves:  totalReserves,
      price:          price
    };
  }));

  let msds = await task.contracts.msdController.getAllMSDs();
  let msdInfo = {};
  await Promise.all(msds.map(async (msd) => {
    let equity = (await task.contracts.msdController.calcEquity(msd))[0];
    if (equity == '0')
      return;

    msdInfo[msd] = {address: msd, equity: equity};
    transferAmount[msd] = transferAmount.hasOwnProperty(msd) ? transferAmount[msd].add(equity) : equity;
  }));

  let withdrawiToken = {};
  let withdrawMsd = {};
  Object.keys(iTokenInfo).map(iToken => {
    if (transferAmount[iTokenInfo[iToken].underlying].mul(iTokenInfo[iToken].price).lt(MIN_VALUE)) {

      delete transferAmount[iTokenInfo[iToken].underlying];
      return;
    }

    withdrawiToken[iToken] = iTokenInfo[iToken].totalReserves.toString();
    if (msdInfo.hasOwnProperty(iTokenInfo[iToken].underlying))
      withdrawMsd[iTokenInfo[iToken].underlying] = msdInfo[iTokenInfo[iToken].underlying].equity.toString();
  });

  let iTokenTransactions = Object.keys(withdrawiToken).map(iToken => {
    return {
      contract: iTokenInfo[iToken].contract,
      method:   "_withdrawReserves",
      args:     [withdrawiToken[iToken]]
    };
  });
  printParam(iTokenTransactions, 'iToken withdraw reserve!');

  let msdTransactions = Object.keys(withdrawMsd).map(msd => {
    return {
      contract: task.contracts.msdController,
      method:   "_withdrawReserves",
      args:     [msd, withdrawMsd[msd]]
    };
  });
  printParam(msdTransactions, 'msd withdraw reserve!');

  let tokenTransactions = await Promise.all(Object.keys(transferAmount).map(async (underlying) => {
    let contract = await attachContractAtAdddress(task.signer, underlying, "iToken");
    return {
      contract: contract,
      method:   "transfer",
      args:     [owner, transferAmount[underlying].toString()]
    };
  }));
  printParam(tokenTransactions, 'asset transfer!');
}

run(task, withdrawEarning);
