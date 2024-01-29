const { expect } = require("chai");
// const { utils, BigNumber } = require("ethers");
const {
  loadFixture,
  fixtureDefault,
  increaseBlock,
  increaseTime,
} = require("../helpers/fixtures.js");

const BASE = ethers.utils.parseEther("1");
const MAX = ethers.constants.MaxUint256;

describe.skip("Test for iMSD Flash Mint", function () {
  // common variables
  let USX, iUSX, fixedInterestRateModel;
  let accounts, owner;

  let arbitrumControler, vUSX, ivUSX, priceOracle, arbitrumOperator;

  before(async function () {
    ({
      USX,
      iUSX,
      accounts,
      fixedInterestRateModel,
      controller,
      msdController,
      owner,
    } = await loadFixture(fixtureDefault));

    // Deploy flash vault controller on the arbitrum
    const ArbitrumControlerFactory = await ethers.getContractFactory(
      "ControllerFlashVault"
    );
    arbitrumControler = await ArbitrumControlerFactory.deploy();
    // The contract is NOT deployed yet; we must wait until it is mined
    await arbitrumControler.deployed();

    // Initialize contract
    await arbitrumControler.initialize();

    // // Set some configs in the controller
    // await arbitrumControler._setCloseFactor(ethers.utils.parseEther("0.5"));

    // Deploy vToken to deposit USX that are transfered through cross-chain and borrow USX
    const vTokenFactory = await ethers.getContractFactory("vToken");
    vUSX = await vTokenFactory.deploy();
    // The contract is NOT deployed yet; we must wait until it is mined
    await vUSX.deployed();

    // Initialize contract
    await vUSX.initialize(
      USX.address,
      "vToken USD",
      "vUSX",
      arbitrumControler.address,
      fixedInterestRateModel.address
    );

    // Deploy ivToken to deposit lending iUSX
    const ivUSXFactory = await ethers.getContractFactory("viToken");
    ivUSX = await ivUSXFactory.deploy();
    // The contract is NOT deployed yet; we must wait until it is mined
    await ivUSX.deployed();

    // Initialize contract
    await ivUSX.initialize(
      iUSX.address,
      "ivToken USD",
      "ivUSX",
      arbitrumControler.address,
      fixedInterestRateModel.address
    );

    // Deploy oracle contract
    const OracleFactory = await ethers.getContractFactory("PriceOracleV2");
    priceOracle = await OracleFactory.deploy(
      owner.address,
      ethers.utils.parseEther("0.01")
    );
    // The contract is NOT deployed yet; we must wait until it is mined
    await priceOracle.deployed();

    // Set oracle in the arbitrum controller contract
    await arbitrumControler._setPriceOracle(priceOracle.address);

    // Use the new oralce in the lending protocol
    await controller._setPriceOracle(priceOracle.address);

    // Deploy aggregator proxy contract
    const AggregatorProxyFactory = await ethers.getContractFactory(
      "AggregatorProxy"
    );
    const aggregatorProxy = await AggregatorProxyFactory.deploy();
    // The contract is NOT deployed yet; we must wait until it is mined
    await aggregatorProxy.deployed();

    // Deploy iToken aggregator contract
    const iTokenAggregatorFactory = await ethers.getContractFactory(
      "FVAggregatorModel"
    );
    const iTokenAggregator = await iTokenAggregatorFactory.deploy();
    // The contract is NOT deployed yet; we must wait until it is mined
    await iTokenAggregator.deployed();

    // Set config in the oracle
    await priceOracle._setAggregatorProxy(aggregatorProxy.address);

    // Set assets price in the oralce
    await priceOracle.setPrices(
      [USX.address, iUSX.address, vUSX.address],
      [BASE, BASE, BASE]
    );
    await priceOracle._setAssetAggregator(
      ivUSX.address,
      iTokenAggregator.address
    );

    console.log(
      "USX price: ",
      (await priceOracle.callStatic.getUnderlyingPrice(USX.address)).toString()
    );
    console.log(
      "iUSX price ",
      (await priceOracle.callStatic.getUnderlyingPrice(iUSX.address)).toString()
    );
    console.log(
      "vUSX price ",
      (await priceOracle.callStatic.getUnderlyingPrice(vUSX.address)).toString()
    );
    console.log(
      "ivUSX price",
      (
        await priceOracle.callStatic.getUnderlyingPrice(ivUSX.address)
      ).toString()
    );

    // Add flash vault assets to the market
    await arbitrumControler._addMarket(
      vUSX.address,
      BASE, // collateralFactor
      BASE, // borrowFactor
      ethers.utils.parseEther("70000000"), // supplyCapacity,
      ethers.utils.parseEther("70000000"), // borrowCapacity,
      BASE // distributionFactor
    );

    await arbitrumControler._addMarket(
      ivUSX.address,
      BASE, // collateralFactor
      BASE, // borrowFactor
      ethers.utils.parseEther("70000000"), // supplyCapacity,
      ethers.utils.parseEther("70000000"), // borrowCapacity,
      BASE // distributionFactor
    );

    // Deploy arbitrum operator.
    const FalshVaultOperatorFactory = await ethers.getContractFactory(
      "ArbOPerator"
    );
    arbitrumOperator = await FalshVaultOperatorFactory.deploy();
    // The contract is NOT deployed yet; we must wait until it is mined
    await arbitrumOperator.deployed();

    // Initialize contract
    await arbitrumOperator.initialize(
      vUSX.address,
      ivUSX.address,
      vUSX.address, // fake cBridge contract address
      ivUSX.address // fake arbitrum bridge address
    );

    console.log("ivUSX contract address: ", ivUSX.address);
    console.log(
      "getEnteredMarkets",
      await arbitrumControler.getEnteredMarkets(arbitrumOperator.address)
    );

    // Add whitelist in arbitrum operator
    await arbitrumOperator._addToWhitelists(owner.address);

    // Add whitelist in vUSX contract.
    await vUSX._addToWhitelists(arbitrumOperator.address);
    await vUSX._addToWhitelists(owner.address);

    // Add whitelist in ivUSX contract.
    await ivUSX._addToWhitelists(arbitrumOperator.address);
  });

  it("When lending iUSX exchange rate is 1", async function () {
    const faucetAmount = ethers.utils.parseEther("700000");
    // Add owner as USX minter to mint USX
    await USX._addMinter(owner.address);
    await USX.mint(owner.address, faucetAmount);
    console.log((await USX.balanceOf(owner.address)).toString());

    // Deposit USX to vUSX
    const mintAmount = ethers.utils.parseEther("70000");
    await USX.approve(vUSX.address, MAX);
    await vUSX.mint(owner.address, mintAmount);
    console.log("vUSX total supply: ", (await vUSX.totalSupply()).toString());

    const flashBorrowAmount = ethers.utils.parseEther("10000");
    console.log("make a flash borrow: ", flashBorrowAmount.toString());
    console.log(
      "before ivUSX total supply: ",
      (await ivUSX.totalSupply()).toString()
    );
    await arbitrumOperator.flashBorrow(flashBorrowAmount);
    console.log(
      "after  ivUSX total supply: ",
      (await ivUSX.totalSupply()).toString(),
      "\n"
    );

    // console.log("operator equity", (await arbitrumControler.calcAccountEquity(arbitrumOperator.address)).toString());
    const operatorDetails = await arbitrumControler.getBorrowedAssets(
      arbitrumOperator.address
    );
    console.log("operator borrowed assets: ", operatorDetails.toString());
    console.log("vUSX address is: ", vUSX.address);

    const flashRepayAmount = ethers.utils.parseEther("10000");
    console.log("make a flash repay: ", flashRepayAmount.toString());
    await arbitrumOperator.flashRepayUnderlying(flashRepayAmount);
    console.log(
      "after  ivUSX total supply: ",
      (await ivUSX.totalSupply()).toString()
    );
  });

  it("Generate interests in lending iUSX", async function () {
    let mintAmount = ethers.utils.parseEther("99999999");
    await USX.mint(owner.address, mintAmount);

    await USX.approve(iUSX.address, MAX);
    await iUSX.mint(owner.address, ethers.utils.parseEther("100000"));
    await controller.connect(owner).enterMarkets([iUSX.address]);
    await iUSX.borrow(ethers.utils.parseEther("50000"));

    // pass 100 blocks
    await increaseBlock(100);
    await increaseTime(100);

    await iUSX.exchangeRateCurrent();
    console.log(
      "exchange rate is: ",
      (await iUSX.exchangeRateStored()).toString()
    );
  });

  it("Make a flash borrow successfully when exchange rate of lending iUSX is not 1.", async function () {
    let borrowAmount = ethers.utils.parseEther("1000");
    await arbitrumOperator.flashBorrow(borrowAmount);
  });

  it("Make a flash redeem successfully when exchange rate of lending iUSX is not 1.", async function () {
    let redeemAmount = ethers.utils.parseEther("1000");
    await arbitrumOperator.flashRepayUnderlying(redeemAmount);
  });
});
