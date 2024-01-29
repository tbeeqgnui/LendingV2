// mainnet blockNumber 13145000
const { ethers } = require("hardhat");

let Oracle;
let anchorAdmin;

let Pair = {};
let AggregatorModel = {};
let Token0 = {};
let Token1 = {};
let lpToken = {};
let token0Aggregator = {};
let token1Aggregator = {};

let oracleAddress = '0x34BAf46eA5081e3E49c29fccd8671ccc51e61E79';

lpToken['WBTC-USDC'] = '0x004375Dff511095CC5A197A54140a24eFEF3A416';
token0Aggregator['WBTC-USDC'] = '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c';
token1Aggregator['WBTC-USDC'] = '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6';

lpToken['USDC-USDT'] = '0x3041CbD36888bECc7bbCBc0045E3B1f144466f5f';
token0Aggregator['USDC-USDT'] = '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6';
token1Aggregator['USDC-USDT'] = '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D';

lpToken['DAI-WETH'] = '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11';
token0Aggregator['DAI-WETH'] = '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9';
token1Aggregator['DAI-WETH'] = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';

lpToken['USDC-WETH'] = '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc';
token0Aggregator['USDC-WETH'] = '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6';
token1Aggregator['USDC-WETH'] = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';

lpToken['USDT-WETH'] = '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852';
token0Aggregator['USDT-WETH'] = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
token1Aggregator['USDT-WETH'] = '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D';

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
  Oracle = await ethers.getContractAt("PriceOracle", oracleAddress);
  
  let tokens = [];
  let aggregators = [];
  await Promise.all(Object.keys(lpToken).map(async (key) => {
  
    const LPAggregatorModel = await ethers.getContractFactory("LPAggregatorModel");
    AggregatorModel[key] = await LPAggregatorModel.deploy(lpToken[key]);
    await AggregatorModel[key].deployed();

    Pair[key] = await ethers.getContractAt("IPair", lpToken[key]);
    Token0[key] = await ethers.getContractAt("Token", await Pair[key].token0());
    Token1[key] = await ethers.getContractAt("Token", await Pair[key].token1());

    if (!tokens.includes(Pair[key].address)) {
      tokens.push(Pair[key].address);
      aggregators.push(AggregatorModel[key].address);
    }

    if (!tokens.includes(Token1[key].address)) {
      tokens.push(Token1[key].address);
      aggregators.push(token1Aggregator[key]);
    }

    if (!tokens.includes(Token0[key].address)) {
      tokens.push(Token0[key].address);
      aggregators.push(token0Aggregator[key]);
    }
  }));

  anchorAdmin = ethers.provider.getSigner(await Oracle.anchorAdmin());
  await impersonatedAccount(anchorAdmin._address);
  
  await Oracle.connect(anchorAdmin)._setAssetAggregatorBatch(tokens, aggregators);
  
  await stopImpersonatingAccount(anchorAdmin._address);
}

async function calcValueOfLPToken(key) {

  let lpPrice = await Oracle.getUnderlyingPrice(lpToken[key]);
  let token0Price = await Oracle.getUnderlyingPrice(Token0[key].address);
  let token1Price = await Oracle.getUnderlyingPrice(Token1[key].address);

  let pairToken0Balance = await Token0[key].balanceOf(lpToken[key]);
  let pairToken1Balance = await Token1[key].balanceOf(lpToken[key]);

  let lpTotalSupply = await Pair[key].totalSupply();

  let lpValue = token0Price.mul(pairToken0Balance).add(token1Price.mul(pairToken1Balance)).div(lpTotalSupply);
  return {price: lpPrice, value: lpValue};
}

describe("Verify LPToken price calculation", async function () {
  before(async function () {
    await initContract();
  });

  await Promise.all(Object.keys(lpToken).map(async (key) => {

    it(`Set LPToken ${key} price and compare with estimated price`, async function () {
      let data = await calcValueOfLPToken(key);
      console.log(key);
      console.log(data.price.toString());
      console.log(data.value.toString());
    });
  }));
});
