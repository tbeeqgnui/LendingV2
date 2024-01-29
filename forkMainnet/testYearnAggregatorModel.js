// mainnet blockNumber 13621160
const { ethers } = require("hardhat");
const { expect } = require("chai");

let aggregatorModels = [
  {
    // abracadabra: 0x6Ff9061bB8f97d948942cEF376d98b51fA38B91f
    token:'0xa9fE4601811213c340e850ea305481afF02f5b28', // yvWETH
    aggregator:'0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  },
  {
    // abracadabra: 0x920D9BD936Da4eAFb5E25c6bDC9f6CB528953F9f
    token:'0xa258C4606Ca8206D8aA700cE2143D7db854D168c', // yvWETH v2
    aggregator:'0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  },
  {
    // abracadabra: 0x6cbAFEE1FaB76cA5B5e144c43B3B50d42b7C8c8f
    token:'0x5f18C75AbDAe578b483E5F43f12a39cF75b973a9', // yvUSDC
    aggregator:'0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
  },
  {
    // abracadabra: 0x551a7CfF4de931F32893c928bBc3D25bF1Fc5147
    token:'0x7Da96a3891Add058AdA2E826306D812C638D87a7', // yvUSDT
    aggregator:'0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
  },
];

async function impersonatedAccount(address) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
}

async function stopImpersonatingAccount(address) {
  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [address],
  });
}

async function increaseBlock(blockNumber) {
  await hre.network.provider.request({
    method: "evm_mine",
    params: [],
  });
}

async function increaseTime(time) {
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [time],
  });
}

async function initContract() {
  
  for (let index = 0; index < aggregatorModels.length; index++) {
    const YearnAggregatorModel = await ethers.getContractFactory("YearnAggregatorModel");
    aggregatorModels[index].aggregatorModel = await YearnAggregatorModel.deploy(aggregatorModels[index].aggregator, aggregatorModels[index].token);
    await aggregatorModels[index].aggregatorModel.deployed();

    aggregatorModels[index].yearnVault = await ethers.getContractAt("IYearnVault", aggregatorModels[index].token);
    aggregatorModels[index].chainlinkAggregator = await ethers.getContractAt("IChainlinkAggregator", aggregatorModels[index].aggregator);
    
  }
}

async function checkData(aggregatorModelInfo) {

  let vaultInfo = await aggregatorModelInfo.aggregatorModel.yearnVaultInfo();

  console.log(`yearnVault:    ${vaultInfo[0]}`);
  console.log(`address:       ${vaultInfo[1]}`);
  console.log(`decimals:      ${vaultInfo[2]}`);
  console.log(`weiPerToken:   ${vaultInfo[1]}\n`);
  expect(aggregatorModelInfo.token).to.equal(vaultInfo[1]);
  
  let decimals = await aggregatorModelInfo.aggregatorModel.decimals();
  console.log(`Chainlink:     ${await aggregatorModelInfo.aggregatorModel.description()}`);
  console.log(`decimals:      ${decimals}\n`);
  expect(aggregatorModelInfo.aggregator).to.equal(await aggregatorModelInfo.aggregatorModel.getAggregators());

  let vaultPriceInfo = await aggregatorModelInfo.aggregatorModel.callStatic.getAssetPrice(aggregatorModelInfo.token);
  let exchangeRate = await aggregatorModelInfo.yearnVault.pricePerShare();
  let price = (await aggregatorModelInfo.chainlinkAggregator.latestRoundData())[1];
  console.log(`vaultPrice:    ${vaultPriceInfo[0].toString()}`);
  console.log(`price:         ${price.toString()}`);
  console.log(`Proportion:    ${vaultPriceInfo[0].mul(ethers.BigNumber.from("10").pow(decimals)).div(price).toString()}`);
  console.log(`exchangeRate:  ${exchangeRate.toString()}`);
  expect(price.mul(exchangeRate).div(ethers.BigNumber.from("10").pow(vaultInfo[2]))).to.equal(vaultPriceInfo[0]);
  console.log('-----------------------------------------\n');
}

describe("Verify yearn aggregator model", async function () {
  before(async function () {
    await initContract();
  });

  await Promise.all(aggregatorModels.map(async (aggregatorModelInfo) => {

    it(`Check the aggregator data`, async function () {
      await checkData(aggregatorModelInfo);
    });
  }));
});
