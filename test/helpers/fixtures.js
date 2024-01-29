const { utils, BigNumber } = require("ethers");
const { network, ethers } = require("hardhat");
const {
  loadFixture: loadFixtureHardHat,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");
const { deployMockContract } = require("@ethereum-waffle/mock-contract");

const {
  getProxyAdmin,
  deployProxy,
  deployProxyWithConstructor,
  upgradeProxy,
  txWait,
  setOraclePrices,
  LOG,
  MAX,
} = require("./utils");

const MockPriceOracle = require("../../artifacts/contracts/interface/IPriceOracle.sol/IPriceOracle.json");
const { expect } = require("chai");

// Wrap hardhat's loadFixture, the one from waffle is deprecated
const loadFixture = loadFixtureHardHat;

// const blockSleep = 2;
// const sleepTime = 10000; // 10s
let tx;

const collateralFactor = utils.parseEther("0.9");
const liquidationThreshold = utils.parseEther("0.92");
const borrowFactor = utils.parseEther("1");
const supplyCapacity = ethers.constants.MaxUint256;
const borrowCapacity = ethers.constants.MaxUint256;
const distributionFactor = utils.parseEther("1");

let reserveRatio = "0.075";
let flashloanFeeRatio = "0.0009";
let protocolFeeRatio = "0.1";

async function setiTokenConfig(
  iToken,
  reserveRatio,
  flashloanFeeRatio,
  protocolFeeRatio
) {
  await iToken._setNewReserveRatio(utils.parseEther(reserveRatio.toString()));
  await iToken._setNewFlashloanFeeRatio(
    utils.parseEther(flashloanFeeRatio.toString())
  );
  await iToken._setNewProtocolFeeRatio(
    utils.parseEther(protocolFeeRatio.toString())
  );
}

async function setPrices(oracle, iToken) {
  const [owner, ...accounts] = await ethers.getSigners();
  const decimals = await iToken.decimals();

  // Price based on USD
  const autualFeedingPrice = utils.parseUnits("1", 36 - decimals);

  // Sets price.
  tx = await oracle
    .connect(owner)
    .setPrices([iToken.address], [autualFeedingPrice]);

  await txWait(network.name, tx);
}

async function distributeUnderlying(underlying, iToken) {
  const [owner, ...accounts] = await ethers.getSigners();

  let actualAmount = utils.parseUnits(
    "1000000000",
    await underlying.decimals()
  );

  for (const account of accounts) {
    await underlying.mint(await account.getAddress(), actualAmount);

    await underlying
      .connect(account)
      .approve(iToken.address, ethers.constants.MaxUint256);
  }
}

// Simulate to mine new blocks.
async function increaseBlock(blockNumber) {
  while (blockNumber > 0) {
    blockNumber--;
    await hre.network.provider.request({
      method: "evm_mine",
      params: [],
    });
  }
}

// Simulate the time passed.
async function increaseTime(time) {
  await hre.network.provider.request({
    method: "evm_increaseTime",
    params: [time],
  });
}

// Get current block number.
async function getBlock() {
  const rawBlockNumber = await hre.network.provider.request({
    method: "eth_blockNumber",
    params: [],
  });
  return parseInt(rawBlockNumber, 16);
}

// Get account eth balance
async function getEthBalance(account) {
  return await ethers.provider.getBalance(account);
}

// Get current timestamp
async function getCurrentTime() {
  return await time.latest();
}

// Pause/Unpause mining automatically.
async function miningAutomatically(automatic) {
  await hre.network.provider.send("evm_setAutomine", [automatic]);
}

// Get current chain id
async function getChainId() {
  return hre.network.provider.request({
    method: "eth_chainId",
    params: [],
  });
}

async function setConfigForiToken(
  iToken,
  reserveRatio,
  flashloanFeeRatio,
  protocolFeeRatio
) {
  let currentReserveRatio = await iToken.reserveRatio();
  let toWriteReserveRatio = utils.parseEther(reserveRatio.toString());
  if (currentReserveRatio.toString() != toWriteReserveRatio.toString()) {
    LOG(
      "\ncurrent reserve ratio is:   ",
      currentReserveRatio.toString() / 1e18
    );
    LOG("going to set reserve ratio: ", reserveRatio);
    tx = await iToken._setNewReserveRatio(toWriteReserveRatio);
    await txWait(network.name, tx);
    LOG("finish to set reserve ratio\n");
  }

  let currentFlashloanFeeRatio = await iToken.flashloanFeeRatio();
  let toWriteFlashloanFeeRatio = utils.parseEther(flashloanFeeRatio.toString());
  if (
    currentFlashloanFeeRatio.toString() != toWriteFlashloanFeeRatio.toString()
  ) {
    LOG(
      "\ncurrent flashloan fee ratio is:   ",
      currentFlashloanFeeRatio.toString() / 1e18
    );
    LOG("going to set flashloan fee ratio: ", flashloanFeeRatio);
    tx = await iToken._setNewFlashloanFeeRatio(toWriteFlashloanFeeRatio);
    await txWait(network.name, tx);
    LOG("finish to set flashloan fee ratio\n");
  }

  let currentProtocolFeeRatio = await iToken.protocolFeeRatio();
  let toWriteProtocolFeeRatio = utils.parseEther(protocolFeeRatio.toString());
  if (
    currentProtocolFeeRatio.toString() != toWriteProtocolFeeRatio.toString()
  ) {
    LOG(
      "\ncurrent protocol fee ratio is:   ",
      currentProtocolFeeRatio.toString() / 1e18
    );
    LOG("going to set protocol fee ratio: ", protocolFeeRatio);
    tx = await iToken._setNewProtocolFeeRatio(toWriteProtocolFeeRatio);
    await txWait(network.name, tx);
    LOG("finish to set protocol fee ratio\n");
  }
}

async function deployiToken(
  underlyingAddress,
  iTokenName,
  iTokenSymbol,
  controllerAddress,
  interestRateModelAddress,
  implementationAddress,
  iTokenContract = "iToken"
) {
  const [owner, ...accounts] = await ethers.getSigners();
  const IToken = await ethers.getContractFactory(iTokenContract);
  const iToken = await deployProxy(
    IToken,
    [
      underlyingAddress,
      iTokenName,
      iTokenSymbol,
      controllerAddress,
      interestRateModelAddress,
    ],
    {
      unsafeAllowCustomTypes: true,
      initializer: "initialize",
    },
    implementationAddress
  );

  return { iToken };
}

async function deployMockFlashVault(
  _iiTokenAddress,
  _iMTokenAddress,
  // _underlyingTokenAddress,
  // _iTokenAddress,
  // controllerFlashMinterAddress,
  implementationAddress
) {
  const [owner, ...accounts] = await ethers.getSigners();
  const MockFlashMinter = await ethers.getContractFactory("L1Operator");
  const mockFlashMinter = await deployProxy(
    MockFlashMinter,
    [
      _iiTokenAddress,
      _iMTokenAddress,
      // _underlyingTokenAddress,
      // _iTokenAddress,
      // controllerFlashMinterAddress,
    ],
    {
      unsafeAllowCustomTypes: true,
      initializer: "initialize",
    },
    implementationAddress
  );

  return { mockFlashMinter };
}

async function deployiETH(
  iTokenName,
  iTokenSymbol,
  controllerAddress,
  interestRateModelAddress,
  iETHContract = "iETH"
) {
  const IETH = await ethers.getContractFactory(iETHContract);
  const iETH = await deployProxy(
    IETH,
    [
      // underlying.address,
      iTokenName,
      iTokenSymbol,
      controllerAddress,
      interestRateModelAddress,
    ],
    {
      unsafeAllowCustomTypes: true,
      initializer: "initialize",
    }
  );

  return { iETH };
}

// For MSD
async function deployFixedInterestRateModel() {
  const model = await (
    await ethers.getContractFactory("FixedInterestRateModel")
  ).deploy();
  await model.deployed();

  return model;
}

async function deployMSD(name, symbol, decimals, implementationAddress) {
  const MSD = await deployProxy(
    await ethers.getContractFactory("MSD"),
    [name, symbol, decimals],
    {
      initializer: "initialize",
    },
    implementationAddress
  );

  return MSD;
}

async function deployMSDController() {
  const msdController = await deployProxy(
    await ethers.getContractFactory("MSDControllerV2"),
    [],
    {
      initializer: "initialize",
    }
  );

  return msdController;
}

async function deployMSDS(
  name,
  symbol,
  underlyingAddress,
  interestRateModelAddress,
  msdControllerAddress,
  implementationAddress
) {
  const MSDS = await deployProxy(
    await ethers.getContractFactory("MSDS"),
    [
      name,
      symbol,
      underlyingAddress,
      interestRateModelAddress,
      msdControllerAddress,
    ],
    {
      initializer: "initialize",
    },
    implementationAddress
  );

  return MSDS;
}

async function deployiMSD(
  name,
  symbol,
  underlyingAddress,
  controllerAddress,
  interestRateModelAddress,
  msdControllerAddress,
  implementationAddress
) {
  const iMSD = await deployProxy(
    await ethers.getContractFactory("iMSD"),
    [
      underlyingAddress,
      name,
      symbol,
      controllerAddress,
      interestRateModelAddress,
      msdControllerAddress,
    ],
    {
      unsafeAllowCustomTypes: true,
      initializer: "initialize",
    },
    implementationAddress
  );

  return iMSD;
}

async function deployiMSDFlashMint(
  name,
  symbol,
  underlyingAddress,
  controllerAddress,
  interestRateModelAddress,
  msdControllerAddress,
  implementationAddress
) {
  const iMSDFlashMint = await deployProxy(
    await ethers.getContractFactory("vMSD"),
    [
      underlyingAddress,
      name,
      symbol,
      controllerAddress,
      interestRateModelAddress,
      msdControllerAddress,
    ],
    {
      unsafeAllowCustomTypes: true,
      initializer: "initialize",
    },
    implementationAddress
  );

  return iMSDFlashMint;
}

async function deployiMSDMiniPool(
  name,
  symbol,
  underlyingAddress,
  controllerAddress,
  interestRateModelAddress,
  msdControllerAddress,
  collateralAddress,
  originationFeeRecipient,
  originationFeeRatio,
  implementationAddress
) {
  const iMSDMiniPool = await deployProxy(
    await ethers.getContractFactory("iMSDMiniPool"),
    [
      underlyingAddress,
      name,
      symbol,
      controllerAddress,
      interestRateModelAddress,
      msdControllerAddress,
      collateralAddress,
      originationFeeRecipient,
      originationFeeRatio,
    ],
    {
      unsafeAllowCustomTypes: true,
      initializer:
        "initialize(address,string,string,address,address,address,address,address,uint256)",
    },
    implementationAddress
  );

  return iMSDMiniPool;
}

async function deployMSDAndSetConfigs(name, symbol, decimals, msdController) {
  const MSD = await deployMSD(name, symbol, decimals);

  // Set msdController as the only minter
  await MSD._addMinter(msdController.address);

  // Add MSD into MSD Controller's token list
  await msdController._addMSD(MSD.address, [], []);

  return MSD;
}

async function deployiMSDAndSetConfigs(
  iMSDName,
  iMSDSymbol,
  MSD,
  controller,
  controllerStock,
  msdController,
  fixedInterestRateModel,
  priceOracle,
  addToMarket,
  borrowRate,
  iMSDContract = "iMSD",
  collateral = ""
) {
  let iMSD;
  if (iMSDContract == "iMSDMiniPool") {
    iMSD = await deployiMSDMiniPool(
      iMSDName,
      iMSDSymbol,
      MSD.address,
      controller.address,
      fixedInterestRateModel.address,
      msdController.address,
      collateral.address,
      // TODO: add fee recipient parameter
      await (await ethers.getSigners())[0].getAddress(),
      0
    );
  } else {
    iMSD = await deployiMSD(
      iMSDName,
      iMSDSymbol,
      MSD.address,
      controller.address,
      fixedInterestRateModel.address,
      msdController.address
    );
  }

  // Set the price
  await setOraclePrices(priceOracle, [iMSD], [1]);

  if (addToMarket) {
    const config = {
      collateralFactor: utils.parseEther("0.9"),
      borrowFactor: utils.parseEther("1"),
      supplyCapacity: 0,
      borrowCapacity: ethers.constants.MaxUint256,
      distributionFactor: utils.parseEther("1"),
    };
    const {
      collateralFactor,
      borrowFactor,
      supplyCapacity,
      borrowCapacity,
      distributionFactor,
    } = config;

    await controller._addMarket(
      iMSD.address,
      collateralFactor,
      borrowFactor,
      supplyCapacity,
      borrowCapacity,
      distributionFactor
    );

    // await controllerStock._addMarket(
    //   iMSD.address,
    //   collateralFactor,
    //   borrowFactor,
    //   supplyCapacity,
    //   borrowCapacity,
    //   distributionFactor
    // );
  }

  // Add USX into MSD Controller's token list
  await msdController._addMinters(
    MSD.address,
    [iMSD.address],
    [ethers.constants.MaxUint256]
  );

  await fixedInterestRateModel._setBorrowRate(iMSD.address, borrowRate);

  const [owner, ...accounts] = await ethers.getSigners();

  for (const account of accounts) {
    await MSD.connect(account).approve(
      iMSD.address,
      ethers.constants.MaxUint256
    );
  }

  return iMSD;
}

async function deployiMSDFlashMintAndSetConfigs(
  iMSDName,
  iMSDSymbol,
  MSD,
  controllerFlashMint,
  msdController,
  fixedInterestRateModel,
  priceOracle,
  addToMarket,
  borrowRate
) {
  const iMSD = await deployiMSDFlashMint(
    iMSDName,
    iMSDSymbol,
    MSD.address,
    controllerFlashMint.address,
    fixedInterestRateModel.address,
    msdController.address
  );

  // Set the price
  await setOraclePrices(priceOracle, [iMSD], [1]);

  if (addToMarket) {
    const config = {
      collateralFactor: utils.parseEther("0.9"),
      borrowFactor: utils.parseEther("1"),
      supplyCapacity: 0,
      borrowCapacity: ethers.constants.MaxUint256,
      distributionFactor: utils.parseEther("1"),
    };
    const {
      collateralFactor,
      borrowFactor,
      supplyCapacity,
      borrowCapacity,
      distributionFactor,
    } = config;

    await controllerFlashMint._addMarket(
      iMSD.address,
      collateralFactor,
      borrowFactor,
      supplyCapacity,
      borrowCapacity,
      distributionFactor
    );
  }

  // Add USX into MSD Controller's token list
  await msdController._addMinters(
    MSD.address,
    [iMSD.address],
    [ethers.constants.MaxUint256]
  );

  await fixedInterestRateModel._setBorrowRate(iMSD.address, borrowRate);

  return iMSD;
}

async function deployMSDSAndSetConfigs(
  MSDSName,
  MSDSSymbol,
  MSD,
  msdController,
  fixedInterestRateModel,
  supplyRate
) {
  const MSDS = await deployMSDS(
    MSDSName,
    MSDSSymbol,
    MSD.address,
    fixedInterestRateModel.address,
    msdController.address
  );

  // Add USDS into MSD's minter list
  await msdController._addMinters(
    MSD.address,
    [MSDS.address],
    [ethers.constants.MaxUint256]
  );

  await fixedInterestRateModel._setSupplyRate(MSDS.address, supplyRate);

  return MSDS;
}

async function deployiTokenAndSetConfigs(
  underlyingName,
  underlyingSymbol,
  underlyingDecimals,
  iTokenName,
  iTokenSymbol,
  controller,
  controllerStock,
  interestRateModel,
  priceOracle,
  addToMarket,
  reserveRatio,
  flashloanFeeRatio,
  protocolFeeRatio,
  contracts = { underlyingContract: "Token", iTokenContract: "iToken" }
) {
  const ERC20 = await ethers.getContractFactory(contracts.underlyingContract);
  const underlying = await ERC20.deploy(
    underlyingName,
    underlyingSymbol,
    underlyingDecimals
  );
  await underlying.deployed();

  const { iToken } = await deployiToken(
    underlying.address,
    iTokenName,
    iTokenSymbol,
    controller.address,
    interestRateModel.address,
    "", //implementationAddress
    contracts.iTokenContract
  );

  await setConfigForiToken(
    iToken,
    reserveRatio,
    flashloanFeeRatio,
    protocolFeeRatio
  );

  await distributeUnderlying(underlying, iToken);

  await setPrices(priceOracle, iToken);

  if (addToMarket) {
    await controller._addMarket(
      iToken.address,
      collateralFactor,
      borrowFactor,
      supplyCapacity,
      borrowCapacity,
      distributionFactor
    );

    // await controllerStock._addMarket(
    //   iToken.address,
    //   collateralFactor,
    //   borrowFactor,
    //   supplyCapacity,
    //   borrowCapacity,
    //   distributionFactor
    // );
  }

  return { underlying, iToken };
}

async function deployiETHAndSetConfigs(
  iTokenName,
  iTokenSymbol,
  controller,
  controllerStock,
  interestRateModel,
  priceOracle,
  addToMarket,
  reserveRatio,
  flashloanFeeRatio,
  protocolFeeRatio
) {
  // const ERC20 = await ethers.getContractFactory("Token");
  // const underlying = await ERC20.deploy(underlyingName, underlyingSymbol, underlyingDecimals);
  // await underlying.deployed();

  const IETH = await ethers.getContractFactory("iETH");
  const { iETH: iETH } = await deployiETH(
    iTokenName,
    iTokenSymbol,
    controller.address,
    interestRateModel.address
  );

  await setConfigForiToken(
    iETH,
    reserveRatio,
    flashloanFeeRatio,
    protocolFeeRatio
  );

  const [owner, ...accounts] = await ethers.getSigners();

  // Sets price.
  await priceOracle
    .connect(owner)
    .setPrices([iETH.address], [utils.parseEther("600")]);

  if (addToMarket) {
    // Need to set price before before add market
    await controller._addMarket(
      iETH.address,
      collateralFactor,
      borrowFactor,
      supplyCapacity,
      borrowCapacity,
      distributionFactor
    );

    // await controllerStock._addMarket(
    //   iETH.address,
    //   collateralFactor,
    //   borrowFactor,
    //   supplyCapacity,
    //   borrowCapacity,
    //   distributionFactor
    // );
  }

  return { iETH };
}

async function deployRewardDistributor(controller) {
  const [owner, ...accounts] = await ethers.getSigners();
  const RewardDistributor = await ethers.getContractFactory(
    "RewardDistributorV3"
  );

  const rewardDistributor = await deployProxy(
    RewardDistributor,
    [controller.address],
    {
      unsafeAllowCustomTypes: true,
      initializer: "initialize",
    }
  );

  await controller._setRewardDistributor(rewardDistributor.address);

  return { rewardDistributor };
}

async function deployController(controllerContract = "Controller") {
  const Controller = await ethers.getContractFactory(controllerContract);

  const controller = await deployProxy(Controller, [], {
    unsafeAllowCustomTypes: true,
    initializer: "initialize",
  });

  return controller;
}

async function deployControllerFlashMint(proxyAdminAddress) {
  const Controller = await ethers.getContractFactory("ControllerFlashVault");

  const controllerFlashMint = await deployProxy(Controller, [], {
    unsafeAllowCustomTypes: true,
    initializer: "initialize",
  });

  return controllerFlashMint;
}

async function deployControllerStock(proxyAdminAddress) {
  return await deployController("ControllerStock");
}

async function deployControllerAndConfig(
  closeFactor,
  liquidationIncentive,
  controllerContract
) {
  const controller = await deployController(controllerContract);

  // Init close factor
  await controller._setCloseFactor(utils.parseUnits(closeFactor, 18));

  // Init liquidation incentive
  await controller._setLiquidationIncentive(
    utils.parseUnits(liquidationIncentive, 18)
  );

  return controller;
}

async function fixtureControllers(proxyAdminAddress) {
  const controller = await deployController();
  const controllerStock = await deployControllerStock();
  const controllerFlashMint = await deployControllerFlashMint();

  // Init close factor
  let closeFactor = utils.parseUnits("0.5", 18);
  await controller._setCloseFactor(closeFactor);
  await controllerStock._setCloseFactor(closeFactor);
  await controllerFlashMint._setCloseFactor(closeFactor);

  // Init liquidation incentive
  let liquidationIncentive = utils.parseUnits("1.1", 18);
  await controller._setLiquidationIncentive(liquidationIncentive);
  await controllerStock._setLiquidationIncentive(liquidationIncentive);
  await controllerFlashMint._setLiquidationIncentive(liquidationIncentive);

  return { controller, controllerStock, controllerFlashMint };
}

// Deploys the actually price oracle contract.
async function deployOracle(posterAddress, maxSwing) {
  const [owner, ...accounts] = await ethers.getSigners();
  const Oracle = await ethers.getContractFactory("PriceOracle");
  const oracle = await Oracle.deploy(
    posterAddress,
    utils.parseEther(maxSwing.toString())
  );
  await oracle.deployed();
  tx = oracle.deployTransaction;

  await txWait(network.name, tx);

  return oracle;
}

// Deploy status oracle.
async function deployStatusOracle(pauser, timeZone, openTime, duration) {
  const StatusOracle = await ethers.getContractFactory("StatusOracle");
  let statusOracle = await StatusOracle.deploy(
    pauser,
    timeZone,
    openTime,
    duration
  );
  await statusOracle.deployed();
  tx = statusOracle.deployTransaction;

  await txWait(network.name, tx);

  return statusOracle;
}

// Deploys the mock aggregator contract.
async function deployMockAggregator() {
  const MockAggregator = await ethers.getContractFactory("MockAggregator");
  aggregator = await MockAggregator.deploy();
  await aggregator.deployed();
  tx = aggregator.deployTransaction;

  await txWait(network.name, tx);

  return aggregator;
}

// Deploys the ExchangeRateModel contract.
async function deployExchangeRateModel(token) {
  const GOLDxExchangeRateModel = await ethers.getContractFactory(
    "GOLDxExchangeRateModel"
  );
  const exchangeRateModel = await GOLDxExchangeRateModel.deploy(token);
  await exchangeRateModel.deployed();
  tx = exchangeRateModel.deployTransaction;

  await txWait(network.name, tx);

  return exchangeRateModel;
}

// Deploys the MockGOLDx contract.
async function deployMockGOLDx() {
  const MockGOLDx = await ethers.getContractFactory("MockGOLDx");
  const GOLDx = await MockGOLDx.deploy();
  await GOLDx.deployed();
  tx = GOLDx.deployTransaction;

  await txWait(network.name, tx);

  return GOLDx;
}

// deploys stablecoin intereset rate model contract.
async function deployStablecoinInterestRateModel() {
  const StablecoinInterestRateModel = await ethers.getContractFactory(
    "StablecoinInterestRateModel"
  );
  const stablecoinInterestRateModel =
    await StablecoinInterestRateModel.deploy();
  await stablecoinInterestRateModel.deployed();
  tx = stablecoinInterestRateModel.deployTransaction;

  await txWait(network.name, tx);

  return stablecoinInterestRateModel;
}

// deploys non-stablecoin interest rate model contract.
async function deployNonStablecoinInterestRateModel(threshold) {
  const NonStablecoinInterestRateModel = await ethers.getContractFactory(
    "StandardInterestRateModel"
  );
  const nonstablecoinInterestRateModel =
    await NonStablecoinInterestRateModel.deploy(
      utils.parseEther(threshold.toString())
    );
  await nonstablecoinInterestRateModel.deployed();
  tx = nonstablecoinInterestRateModel.deployTransaction;

  await txWait(network.name, tx);

  return nonstablecoinInterestRateModel;
}

// deploys interest rate model contract.
async function deployInterestRateModel(
  baseInterestPerYear,
  interestPerYear,
  highInterestPerYear,
  high
) {
  const [owner, ...accounts] = await ethers.getSigners();
  const InterestRateModel = await ethers.getContractFactory(
    "InterestRateModel"
  );
  const interestRateModel = await InterestRateModel.deploy(
    utils.parseEther(baseInterestPerYear.toString()),
    utils.parseEther(interestPerYear.toString()),
    utils.parseEther(highInterestPerYear.toString()),
    utils.parseEther(high.toString())
  );
  await interestRateModel.deployed();
  tx = interestRateModel.deployTransaction;

  await txWait(network.name, tx);

  return interestRateModel;
}

// deploys lending data contract.
async function deployLendingData(
  controlleAddress,
  anchorPriceToken,
  blocksPerYear,
  implementationAddress,
  constructorArguments
) {
  let LendingData, initializerArguments;

  if (constructorArguments.length != 2 && constructorArguments.length != 3) {
    LOG("Please check the lending data parameters for constructor!");
    return;
  }
  if (constructorArguments.length == 2) {
    LendingData = await ethers.getContractFactory("LendingData");
    initializerArguments = [controlleAddress, anchorPriceToken];
  }

  if (constructorArguments.length == 3) {
    LendingData = await ethers.getContractFactory("LendingDataV2");
    initializerArguments = [controlleAddress, anchorPriceToken, blocksPerYear];
  }

  LOG("Deploy proxy with constructor");

  let lendingData = await deployProxyWithConstructor(
    LendingData,
    initializerArguments,
    {
      unsafeAllowCustomTypes: true,
      initializer: "initialize",
    },
    implementationAddress,
    constructorArguments
  );

  return lendingData;
}

async function deployTreasury(rewardTokenAddress) {
  const treasury = await (
    await ethers.getContractFactory("MockTreasury")
  ).deploy(rewardTokenAddress);
  await treasury.deployed();

  return treasury;
}

async function deployTreasuryAndConfig(rewardTokenAddress, rewardDistributor) {
  const treasury = await deployTreasury(rewardTokenAddress);

  await treasury.addRecipient(rewardDistributor.address);
  await rewardDistributor._setTreasury(treasury.address);

  return treasury;
}

async function fixtureMarketsAdded() {
  const [owner, ...accounts] = await ethers.getSigners();
  const { controller, controllerStock, controllerFlashMint } =
    await loadFixture(fixtureControllers);

  const interestRateModel = await deployInterestRateModel(0, 0.08, 1, 0.75);

  const priceOracle = await deployOracle(owner.getAddress(), "0.01");
  await controller._setPriceOracle(priceOracle.address);
  await controllerStock._setPriceOracle(priceOracle.address);
  await controllerFlashMint._setPriceOracle(priceOracle.address);

  // Reward Distributor
  let rewardDistributor = (await deployRewardDistributor(controller))
    .rewardDistributor;

  await deployRewardDistributor(controllerStock);
  await deployRewardDistributor(controllerFlashMint);

  const { underlying: USDx, iToken: iUSDx } = await deployiTokenAndSetConfigs(
    "USDx Token",
    "USDx",
    18,
    "dForce lending token USDx",
    "iToken USDx",
    controller,
    controllerStock,
    interestRateModel,
    priceOracle,
    true,
    reserveRatio,
    flashloanFeeRatio,
    protocolFeeRatio
  );

  const { underlying: USDT, iToken: iUSDT } = await deployiTokenAndSetConfigs(
    "USDT Token",
    "USDT",
    6,
    "dForce lending token USDT",
    "iToken USDT",
    controller,
    controllerStock,
    interestRateModel,
    priceOracle,
    true,
    reserveRatio,
    flashloanFeeRatio,
    protocolFeeRatio
  );

  const { underlying: WBTC, iToken: iWBTC } = await deployiTokenAndSetConfigs(
    "WBTC Token",
    "WBTC",
    8,
    "dForce lending token WBTC",
    "iToken WBTC",
    controller,
    controllerStock,
    interestRateModel,
    priceOracle,
    true,
    reserveRatio,
    flashloanFeeRatio,
    protocolFeeRatio
  );

  const { iETH: iETH } = await deployiETHAndSetConfigs(
    "dForce lending ETH",
    "iETH",
    controller,
    controllerStock,
    interestRateModel,
    priceOracle,
    true,
    reserveRatio,
    flashloanFeeRatio,
    protocolFeeRatio
  );

  const { underlying: xTSLA, iToken: ixTSLA } = await deployiTokenAndSetConfigs(
    "xTSLA Token",
    "xTSLA",
    18,
    "dForce lending token xTSLA",
    "ixTSLA",
    controller,
    controllerStock,
    interestRateModel,
    priceOracle,
    true,
    reserveRatio,
    flashloanFeeRatio,
    protocolFeeRatio
  );

  const { underlying: xAAPL, iToken: ixAAPL } = await deployiTokenAndSetConfigs(
    "xAAPL Token",
    "xAAPL",
    18,
    "dForce lending token xAAPL",
    "ixAAPL",
    controller,
    controllerStock,
    interestRateModel,
    priceOracle,
    true,
    reserveRatio,
    flashloanFeeRatio,
    protocolFeeRatio
  );

  const { underlying: USDC, iToken: iUSDC } = await deployiTokenAndSetConfigs(
    "USDC Token",
    "USDC",
    6,
    "dForce lending token USDC",
    "iToken USDC",
    controller,
    controllerStock,
    interestRateModel,
    priceOracle,
    true,
    reserveRatio,
    flashloanFeeRatio,
    protocolFeeRatio
  );

  return {
    controller,
    controllerStock,
    controllerFlashMint,
    iUSDx,
    USDx,
    iUSDT,
    USDT,
    iWBTC,
    WBTC,
    ixTSLA,
    xTSLA,
    ixAAPL,
    xAAPL,
    iUSDC,
    USDC,
    iETH,
    interestRateModel,
    priceOracle,
    rewardDistributor,
  };
}

async function fixtureiToken() {
  const results = await loadFixture(fixtureMarketsAdded);
  const { controller, controllerStock, iUSDx, iUSDT, iToken6, iETH } = results;

  const [owner, ...accounts] = await ethers.getSigners();

  // Deploys lending data contract.
  const lendingData = await deployLendingData(
    controller.address,
    iUSDx.address,
    0,
    "",
    [controller.address, iUSDx.address]
  );

  // TODO: remove out: flashloan executor.
  // Deploys flashloan executor contract.
  const FlashloanExecutor = await ethers.getContractFactory(
    "FlashloanExecutor"
  );
  const flashloanExecutor = await FlashloanExecutor.deploy();
  await flashloanExecutor.deployed();

  // Deploys a bad flashloan executor contract.
  const FlashloanExecutorFailure = await ethers.getContractFactory(
    "FlashloanExecutorFailure"
  );
  const flashloanExecutorFailure = await FlashloanExecutorFailure.deploy();
  await flashloanExecutorFailure.deployed();

  // Init Mock Price Oracle
  const mockPriceOracle = await deployMockContract(owner, MockPriceOracle.abi);

  await setOraclePrices(mockPriceOracle, [iUSDx, iUSDT, iETH], [1, 1, 600]);

  return {
    ...results,
    owner,
    accounts,
    lendingData,
    flashloanExecutor,
    flashloanExecutorFailure,
    mockPriceOracle,
  };
}

async function fixtureMSD() {
  const results = await loadFixture(fixtureiToken);
  const { controller, controllerStock, priceOracle } = results;

  // 0.05 * 10 ** 18 / 2102400
  let borrowRate = BigNumber.from(23782343987);
  // 0.03 * 10 ** 18 / 2102400
  let supplyRate = BigNumber.from(14269406392);

  // Fixed Rate Interest Model
  const fixedInterestRateModel = await deployFixedInterestRateModel();

  const msdController = await deployMSDController();

  const USX = await deployMSDAndSetConfigs("USX", "USX", 18, msdController);
  const EUX = await deployMSDAndSetConfigs("EUX", "EUX", 18, msdController);

  // iMUSX
  const iMUSX = await deployiMSDAndSetConfigs(
    "iMUSX",
    "iMUSX",
    USX,
    controller,
    controllerStock,
    msdController,
    fixedInterestRateModel,
    priceOracle,
    true,
    borrowRate
  );

  // USXS
  const USXS = await deployMSDSAndSetConfigs(
    "USXS",
    "USX Saving",
    USX,
    msdController,
    fixedInterestRateModel,
    supplyRate
  );

  // iMEUX
  const iMEUX = await deployiMSDAndSetConfigs(
    "iMEUX",
    "iMEUX",
    EUX,
    controller,
    controllerStock,
    msdController,
    fixedInterestRateModel,
    priceOracle,
    true,
    borrowRate
  );

  // EUXS
  const EUXS = await deployMSDSAndSetConfigs(
    "EUXS",
    "EUX Saving",
    EUX,
    msdController,
    fixedInterestRateModel,
    supplyRate
  );

  return {
    ...results,
    msdController,
    fixedInterestRateModel,
    USX,
    iMUSX,
    USXS,
    EUX,
    iMEUX,
    EUXS,
  };
}

async function fixtureShortfall() {
  const results = await loadFixture(fixtureDefault);
  const {
    controller,
    controllerStock,
    iUSDx,
    iUSDT,
    mockPriceOracle,
    accounts,
  } = results;

  const [user0, user1] = accounts;
  const account0 = await user0.getAddress();
  const account1 = await user1.getAddress();
  let rawAmount = BigNumber.from("1000");
  const iUSDxDecimals = await iUSDx.decimals();
  const iUSDTDecimals = await iUSDT.decimals();
  let mintiUSDxAmount = rawAmount.mul(BigNumber.from(10).pow(iUSDxDecimals));
  let mintiUSDTAmount = rawAmount.mul(BigNumber.from(10).pow(iUSDTDecimals));
  let amount = mintiUSDxAmount;

  // Use mock oracle
  await controller._setPriceOracle(mockPriceOracle.address);
  await controllerStock._setPriceOracle(mockPriceOracle.address);

  await iUSDx.connect(user0).mint(account0, amount);
  await iUSDT.connect(user1).mint(account1, mintiUSDTAmount);

  // User use iUSDx as collateral, and borrow some USDT
  await controller.connect(user0).enterMarkets([iUSDx.address, iUSDT.address]);

  await controllerStock
    .connect(user0)
    .enterMarkets([iUSDx.address, iUSDT.address]);

  await iUSDT.connect(user0).borrow(mintiUSDTAmount.div(2).mul(9).div(10));

  // USDx price drop to 0.5
  await setOraclePrices(mockPriceOracle, [iUSDx], [0.5]);

  return results;
}

async function deployNonListed(
  controller,
  controllerStock,
  msdController,
  interestRateModel,
  fixedInterestRateModel,
  priceOracle,
  type
) {
  switch (type) {
    case "iToken":
      const { iToken: nonListediToken, underlying: nonListedUnderlying } =
        await deployiTokenAndSetConfigs(
          "NLToken",
          "NLToken",
          18,
          "Non Listed iToken",
          "Non Listed iToken",
          controller,
          controllerStock,
          interestRateModel,
          priceOracle,
          false,
          reserveRatio,
          flashloanFeeRatio,
          protocolFeeRatio
        );
      return { nonListediToken, nonListedUnderlying };

    case "iETH":
      const { iETH: nonListediETH } = await deployiETHAndSetConfigs(
        "Non Listed iETH",
        "Non Listed iETH",
        controller,
        controllerStock,
        interestRateModel,
        priceOracle,
        false,
        reserveRatio,
        flashloanFeeRatio,
        protocolFeeRatio
      );
      return nonListediETH;

    case "iMSD":
      const borrowRate = BigNumber.from(23782343987);
      const nonListedMSD = await deployMSDAndSetConfigs(
        "Non Listed MSD",
        "Non Listed MSD",
        18,
        msdController
      );
      const nonListediMSD = await deployiMSDAndSetConfigs(
        "Non Listed iMSD",
        "Non Listed iMSD",
        nonListedMSD,
        controller,
        controllerStock,
        msdController,
        fixedInterestRateModel,
        priceOracle,
        false,
        borrowRate
      );
      return { nonListediMSD, nonListedMSD };

    default:
      throw "Unsupported type";
  }
}

async function getiTokenCurrentData(iTokenContract, increaseblock = 0) {
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

async function fixtureiUSX() {
  const results = await loadFixture(fixtureMSD);
  const {
    controller,
    controllerStock,
    controllerFlashMint,
    msdController,
    interestRateModel,
    fixedInterestRateModel,
    priceOracle,
    USX,
    EUX,
    owner,
  } = results;

  // Deploy new iToken that uses USX as the underlying.
  const iUSX = (
    await deployiToken(
      USX.address,
      "dForce iUSX",
      "iUSX",
      controller.address,
      interestRateModel.address
    )
  ).iToken;

  await setConfigForiToken(
    iUSX,
    reserveRatio,
    flashloanFeeRatio,
    protocolFeeRatio
  );

  await setPrices(priceOracle, iUSX);

  await controller._addMarket(
    iUSX.address,
    collateralFactor,
    borrowFactor,
    supplyCapacity,
    borrowCapacity,
    distributionFactor
  );

  // await controllerStock._addMarket(
  //   iUSX.address,
  //   collateralFactor,
  //   borrowFactor,
  //   supplyCapacity,
  //   borrowCapacity,
  //   distributionFactor
  // );

  // Deploy new iToken that uses EUX as the underlying.
  const iEUX = (
    await deployiToken(
      EUX.address,
      "dForce iEUX",
      "iEUX",
      controller.address,
      interestRateModel.address
    )
  ).iToken;

  await setConfigForiToken(
    iEUX,
    reserveRatio,
    flashloanFeeRatio,
    protocolFeeRatio
  );

  await setPrices(priceOracle, iEUX);

  await controller._addMarket(
    iEUX.address,
    collateralFactor,
    borrowFactor,
    supplyCapacity,
    borrowCapacity,
    distributionFactor
  );

  // await controllerStock._addMarket(
  //   iEUX.address,
  //   collateralFactor,
  //   borrowFactor,
  //   supplyCapacity,
  //   borrowCapacity,
  //   distributionFactor
  // );

  // // // -----------------------------------
  // // // -------- Flash mint system --------
  // // // -----------------------------------
  // // Borrow interest rate should be zero, avoid to generate shortfall.
  // let borrowRate = BigNumber.from(0);
  // // IMUSX Flash Mint
  // const iMUSXFlashMint = await deployiMSDFlashMintAndSetConfigs(
  //   "iMUSXFlashVault",
  //   "iMUSXFlashVault",
  //   USX,
  //   controllerFlashMint,
  //   msdController,
  //   fixedInterestRateModel,
  //   priceOracle,
  //   true,
  //   borrowRate
  // );

  // // TODO: Should use `deployiTokenAndSetConfigs`
  // const iiUSX = (
  //   await deployiToken(
  //     iUSX.address,
  //     "iiUSX",
  //     "iiUSX",
  //     controllerFlashMint.address,
  //     interestRateModel.address,
  //     "",
  //     "viToken"
  //   )
  // ).iToken;

  // await setConfigForiToken(
  //   iiUSX,
  //   reserveRatio,
  //   flashloanFeeRatio,
  //   protocolFeeRatio
  // );

  // await setPrices(priceOracle, iiUSX);

  // await controllerFlashMint._addMarket(
  //   iiUSX.address,
  //   borrowFactor, //collateralFactor,
  //   borrowFactor,
  //   supplyCapacity,
  //   borrowCapacity,
  //   distributionFactor
  // );

  // // Flash Minter
  // const flashMinter = (
  //   await deployMockFlashVault(
  //     iiUSX.address,
  //     iMUSXFlashMint.address
  //     // USX.address,
  //     // iUSX.address,
  //     // controllerFlashMint.address
  //   )
  // ).mockFlashMinter;

  // await iMUSXFlashMint._addToWhitelists(flashMinter.address);
  // await iiUSX._addToWhitelists(flashMinter.address);
  // // await flashMinter.approveAll();
  // await flashMinter._addToWhitelists(owner.address);

  return {
    ...results,
    iUSX,
    iEUX,
    // iiUSX,
    // flashMinter,
    // iMUSXFlashMint,
  };
}

async function fixtureNonListediTokens() {
  const results = await loadFixture(fixtureiUSX);
  const {
    controller,
    controllerStock,
    interestRateModel,
    fixedInterestRateModel,
    msdController,
    priceOracle,
  } = results;

  const {
    nonListediToken: nonListediToken,
    nonListedUnderlying: nonListedUnderlying,
  } = await deployNonListed(
    controller,
    controllerStock,
    msdController,
    interestRateModel,
    fixedInterestRateModel,
    priceOracle,
    "iToken"
  );

  const nonListediETH = await deployNonListed(
    controller,
    controllerStock,
    msdController,
    interestRateModel,
    fixedInterestRateModel,
    priceOracle,
    "iETH"
  );

  const { nonListediMSD: nonListediMSD, nonListedMSD: nonListedMSD } =
    await deployNonListed(
      controller,
      controllerStock,
      msdController,
      interestRateModel,
      fixedInterestRateModel,
      priceOracle,
      "iMSD"
    );

  return {
    ...results,
    nonListediToken,
    nonListedUnderlying,
    nonListediETH,
    nonListediMSD,
    nonListedMSD,
  };
}

async function fixtureReentrancyToken() {
  const results = await loadFixture(fixtureNonListediTokens);
  const {
    controller,
    controllerStock,
    interestRateModel,
    fixedInterestRateModel,
    msdController,
    priceOracle,
  } = results;

  const { underlying: reentrancyToken, iToken: reentrancyiToken } =
    await deployiTokenAndSetConfigs(
      "Reentrancy Token",
      "Reentrancy Token",
      18,
      "Reentrancy iToken",
      "Reentrancy iToken",
      controller,
      controllerStock,
      interestRateModel,
      priceOracle,
      true,
      reserveRatio,
      flashloanFeeRatio,
      protocolFeeRatio,
      { underlyingContract: "ReentrancyToken", iTokenContract: "iToken" }
    );

  return {
    ...results,
    reentrancyToken,
    reentrancyiToken,
  };
}

async function fixtureiMSDMiniPool() {
  const results = await loadFixture(fixtureReentrancyToken);
  const {
    owner,
    interestRateModel,
    fixedInterestRateModel,
    msdController,
    priceOracle,
    USX,
    accounts,
    controllerStock,
  } = results;

  // 0.05 * 10 ** 18 / 2102400
  let borrowRate = BigNumber.from(23782343987);

  const controller = await deployControllerAndConfig(
    "0.5",
    "1.1",
    "ControllerMiniPool"
  );

  await controller._setPriceOracle(priceOracle.address);

  const { underlying: collateralUnderlying, iToken: collateral } =
    await deployiTokenAndSetConfigs(
      "MiniPool Collateral",
      "COL",
      18,
      "dForce lending MiniPool Collateral",
      "iCOL",
      controller,
      controllerStock,
      interestRateModel,
      priceOracle,
      true,
      reserveRatio,
      flashloanFeeRatio,
      protocolFeeRatio
    );

  const iMSDMiniPool = await deployiMSDAndSetConfigs(
    // TODO: Some meaningful symbol
    "iMMiniPool",
    "iMMiniPool",
    USX,
    controller,
    controllerStock,
    msdController,
    fixedInterestRateModel,
    priceOracle,
    true,
    borrowRate,
    "iMSDMiniPool",
    collateral
  );

  return {
    ...results,
    collateral,
    collateralUnderlying,
    controllerMiniPool: controller,
    iMSDMiniPool,
    USX: USX,
  };
}

async function deployMiniMinter(msd, msdController) {
  const miniMinter = await deployProxy(
    await ethers.getContractFactory("MiniMinter"),
    [msd.address, msdController.address],
    {
      unsafeAllowCustomTypes: true,
      initializer: "initialize",
    }
  );

  // const miniMinter = await (
  //   await ethers.getContractFactory("MiniMinter")
  // ).deploy();
  // await miniMinter.deployed();
  // await miniMinter.initialize(msd.address, msdController.address);

  return miniMinter;
}

async function fixtureMiniMinter() {
  const results = await loadFixture(fixtureiMSDMiniPool);
  const { msdController, USX } = results;

  const miniMinter = await deployMiniMinter(USX, msdController);

  await msdController._addMinters(
    USX.address,
    [miniMinter.address],
    [utils.parseEther("10000000000")]
  );

  return {
    ...results,
    miniMinter,
  };
}

async function deployL1BridgeOperator(USX, miniMinter, l1Gateway, l1cBridge) {
  const l1BridgeOperator = await deployProxy(
    await ethers.getContractFactory("L1BridgeOperator"),
    [
      USX.address,
      miniMinter.address,
      l1Gateway.address,
      l1Gateway.address, // L2 Operator address
      l1cBridge.address,
    ],
    {
      unsafeAllowCustomTypes: true,
      initializer: "initialize",
    }
  );

  return l1BridgeOperator;
}

async function fixtureL1BridgeOperator() {
  const results = await loadFixture(fixtureMiniMinter);
  const { USX, miniMinter, owner } = results;

  const l1Gateway = await (
    await ethers.getContractFactory("MockL1Gateway")
  ).deploy();
  await l1Gateway.deployed();

  const l1cBridge = await (
    await ethers.getContractFactory("MockCBridge")
  ).deploy();
  await l1cBridge.deployed();

  const l1BridgeOperator = await deployL1BridgeOperator(
    USX,
    miniMinter,
    l1Gateway,
    l1cBridge
  );

  await l1BridgeOperator._addToWhitelists(await owner.getAddress());

  // await miniMinter._setPendingOwner(l1BridgeOperator.address);
  // await l1BridgeOperator.acceptOwner();

  return {
    ...results,
    l1BridgeOperator,
    l1Gateway,
    l1cBridge,
  };
}

async function transferOwnership(
  proxyAdmin,
  controller,
  rewardDistributor,
  curOwner,
  newOwner,
  timelock
) {
  const abiCoder = new ethers.utils.AbiCoder();

  async function transferAndAccept(contract) {
    if (curOwner.address === timelock.address) {
      await timelock.executeTransaction(
        contract.address,
        0,
        "_setPendingOwner(address)",
        abiCoder.encode(["address"], [newOwner.address])
      );
    } else {
      await contract.connect(curOwner)._setPendingOwner(newOwner.address);
    }

    if (newOwner.address === timelock.address) {
      await timelock.executeTransaction(
        contract.address,
        0,
        "_acceptOwner()",
        "0x"
      );
    } else {
      await contract.connect(newOwner)._acceptOwner();
    }
  }

  await transferAndAccept(proxyAdmin);
  await transferAndAccept(controller);
  await transferAndAccept(rewardDistributor);

  const iTokens = await controller.getAlliTokens();
  for (iTokenAddress of iTokens) {
    let iToken = new ethers.Contract(
      iTokenAddress,
      require("../../artifacts/contracts/iTokenV2.sol/iTokenV2.json").abi,
      // FIXME: better way to decide the default signer
      curOwner === timelock ? newOwner : curOwner
    );

    await transferAndAccept(iToken);
  }
}

async function upgradeToV2(contracts) {
  const controller = contracts.controller;
  const iETH = contracts.iETH;
  const owner = contracts.owner;
  const rewardDistributor = contracts.rewardDistributor;

  const proxyAdmin = await getProxyAdmin();

  // Upgrade Helper execute admin functions via timelock
  const timelock = await (await ethers.getContractFactory("Timelock")).deploy();
  await timelock.deployed();

  // all related contracts ownership transfered to timelock
  await transferOwnership(
    proxyAdmin,
    controller,
    rewardDistributor,
    owner,
    timelock,
    timelock
  );

  const extraImplicit = await (
    await ethers.getContractFactory("ControllerV2ExtraImplicit")
  ).deploy();
  await extraImplicit.deployed();

  const extraExplicit = await (
    await ethers.getContractFactory("ControllerV2ExtraExplicit")
  ).deploy();
  await extraExplicit.deployed();

  const controllerImpl = await (
    await ethers.getContractFactory("ControllerV2")
  ).deploy(extraImplicit.address, extraExplicit.address);
  await controllerImpl.deployed();

  const rewardDistributorImpl = await (
    await ethers.getContractFactory("RewardDistributorSecondV3")
  ).deploy();
  await rewardDistributorImpl.deployed();

  const iTokenImpl = await (
    await ethers.getContractFactory("iTokenV2")
  ).deploy();
  await iTokenImpl.deployed();

  const iETHImpl = await (await ethers.getContractFactory("iETHV2")).deploy();
  await iETHImpl.deployed();

  const iMSDImpl = await (await ethers.getContractFactory("iMSDV2")).deploy();
  await iMSDImpl.deployed();

  // Deploy iToken interest model V2 that calculates with seconds.
  const interestModelV2 = await (
    await ethers.getContractFactory("StablePrimaryInterestSecondModel")
  ).deploy();
  await interestModelV2.deployed();

  // Deploy iMSD fixed interest model V2 that calculates with seconds.
  const fixedInterestModelV2 = await (
    await ethers.getContractFactory("FixedInterestRateSecondModelV2")
  ).deploy();
  await fixedInterestModelV2.deployed();

  const upgradeHelper = await (
    await ethers.getContractFactory("UpgradeHelper")
  ).deploy(
    proxyAdmin.address,
    timelock.address,
    controller.address,
    rewardDistributor.address,
    controllerImpl.address,
    extraImplicit.address,
    extraExplicit.address,
    rewardDistributorImpl.address,
    iTokenImpl.address,
    iETHImpl.address,
    iMSDImpl.address
  );
  await upgradeHelper.deployed();

  // set corresponding interest rate model
  const iTokens = await controller.getAlliTokens();
  const interestRateModels = await Promise.all(
    iTokens.map(async (iTokenAddress) => {
      let iToken = new ethers.Contract(
        iTokenAddress,
        require("../../artifacts/contracts/iTokenV2.sol/iTokenV2.json").abi,
        owner
      );

      return (await iToken.isiToken())
        ? interestModelV2.address
        : fixedInterestModelV2.address;
    })
  );

  await upgradeHelper._setInterestRateModelsOf(iTokens, interestRateModels);

  // temporarily transfer the ownership of timelock to upgradeHelper
  // restore to previous owner after upgrade
  //  the owner of each contract is a EOA instead of timelock
  await timelock._setPendingOwner(upgradeHelper.address);
  await upgradeHelper.acceptOwnershipOf(timelock.address);

  await upgradeHelper.upgrade();

  await upgradeHelper.transferOwnershipOf(timelock.address, owner.address);
  await timelock.connect(owner)._acceptOwner();

  // For conveniece in test cases, ownership transfer to EOA owner discarding timelock
  await transferOwnership(
    proxyAdmin,
    controller,
    rewardDistributor,
    timelock,
    owner,
    timelock
  );

  const controllerV2 = new ethers.Contract(
    controller.address,
    require("../../artifacts/contracts/interface/IController.sol/IController.json").abi,
    owner
  );

  return controllerV2;
}

async function fixtureIsolationMode() {
  const results = await loadFixture(fixtureiMSDMiniPool);

  const {
    owner,
    controller,
    controllerStock,
    interestRateModel,
    priceOracle,
    USX,
    iUSX,
    iUSDC,
    iUSDT,
    iETH,
    iMEUX,
    iMUSX,
    rewardDistributor,
  } = results;

  const collateralFactor = utils.parseEther("0.9");
  const borrowFactor = utils.parseEther("1");
  const supplyCapacity = MAX;
  const borrowCapacity = MAX;
  const distributionFactor = utils.parseEther("1");
  // DEBT_CEILING_DECIMALS = 2 => 1000000 means $10000
  const debtCeiling = 100000;

  const controllerV2 = await upgradeToV2({
    controller: controller,
    iETH: iETH,
    owner: owner,
    rewardDistributor: rewardDistributor,
  });

  // deploy a new token
  const { underlying: ARB, iToken: iARB } = await deployiTokenAndSetConfigs(
    "Arbitrum",
    "ARB",
    18,
    "dForce ARB",
    "iARB",
    controllerV2,
    controllerStock,
    interestRateModel,
    priceOracle,
    false, // do not add to market
    "0.075",
    "0.0009",
    "0.1",
    { iTokenContract: "iTokenV2", underlyingContract: "Token" }
  );

  // Set the new asset as isolated asset when adding to Markets
  await controllerV2._addMarketV2({
    _iToken: iARB.address,
    _collateralFactor: collateralFactor,
    _borrowFactor: borrowFactor,
    _supplyCapacity: supplyCapacity,
    _borrowCapacity: borrowCapacity,
    _distributionFactor: distributionFactor,
    _eModeID: 0,
    _eModeLtv: 0,
    _eModeLiqThreshold: 0,
    _liquidationThreshold: liquidationThreshold,
    _debtCeiling: debtCeiling,
    _borrowableInIsolation: false,
  });

  // deploy another new token
  const { underlying: OP, iToken: iOP } = await deployiTokenAndSetConfigs(
    "Optimism",
    "OP",
    18,
    "dForce Optimism",
    "iOP",
    controllerV2,
    controllerStock,
    interestRateModel,
    priceOracle,
    false, // do not add to market
    "0.075",
    "0.0009",
    "0.1",
    { iTokenContract: "iTokenV2", underlyingContract: "Token" }
  );

  // Set the new asset as isolated asset when adding to Markets
  await controllerV2._addMarketV2({
    _iToken: iOP.address,
    _collateralFactor: collateralFactor,
    _borrowFactor: borrowFactor,
    _supplyCapacity: supplyCapacity,
    _borrowCapacity: borrowCapacity,
    _distributionFactor: distributionFactor,
    _eModeID: 0,
    _eModeLtv: 0,
    _eModeLiqThreshold: 0,
    _liquidationThreshold: liquidationThreshold,
    _debtCeiling: debtCeiling,
    _borrowableInIsolation: false,
  });

  await controllerV2._setBorrowableInIsolation(iUSDC.address, true);
  await controllerV2._setBorrowableInIsolation(iUSDT.address, true);
  await controllerV2._setBorrowableInIsolation(iUSX.address, true);

  return {
    ...results,
    controllerV2,
    ARB,
    iARB,
    OP,
    iOP,
  };
}

async function fixtureEMode() {
  const results = await loadFixture(fixtureIsolationMode);
  const { controllerV2, iUSDC, iUSDT, iUSX } = results;

  let eModeLTV = utils.parseEther("0.97"); // 97%
  let eModeLiquidationThreshold = utils.parseEther("0.98"); //98%
  let eModeLiquidationIncentive = utils.parseEther("1.01"); // 1%
  let eModeCloseFactor = utils.parseEther("0.4"); // 40%

  await controllerV2._addEMode(
    eModeLiquidationIncentive,
    eModeCloseFactor,
    "stable coin" // label
  );

  await controllerV2._addEMode(
    ethers.utils.parseEther("1.01"), // liquidationIncentive
    ethers.utils.parseEther("0.4"), // closeFactor
    "ETH" // label
  );

  await controllerV2._setEMode(
    iUSDC.address,
    1, // stable coin
    eModeLTV,
    eModeLiquidationThreshold
  );

  await controllerV2._setEMode(
    iUSDT.address,
    1, // stable coin
    eModeLTV,
    eModeLiquidationThreshold
  );

  return results;
}

async function fixtureOutDelay() {
  const results = await loadFixture(fixtureEMode);
  const { controllerV2 } = results;

  // Deploy time lock strategy contract.
  const minSingleWaitBlocks = 0;
  const midSingleWaitBlocks = 30;
  const maxSingleWaitBlocks = 100;

  const minSingleLimit = utils.parseEther("1000");
  const midSingleLimit = utils.parseEther("10000");

  const minDailyWaitBlocks = 0;
  const midDailyWaitBlocks = 50;
  const maxDailyWaitBlocks = 200;

  const minDailyLimit = utils.parseEther("50000");
  const midDailyLimit = utils.parseEther("100000");

  const timeLockStrategyConstructorArguments = [
    controllerV2.address,
    minSingleWaitBlocks,
    midSingleWaitBlocks,
    maxSingleWaitBlocks,
    minDailyWaitBlocks,
    midDailyWaitBlocks,
    maxDailyWaitBlocks,
  ];

  const TimeLockStrategyFactory = await ethers.getContractFactory(
    "TimeLockStrategy"
  );
  // TODO: Proxy
  const timeLockStrategy = await deployProxyWithConstructor(
    TimeLockStrategyFactory,
    timeLockStrategyConstructorArguments,
    {
      unsafeAllowCustomTypes: true,
      initializer: "initialize",
    },
    "", // implementation contract address
    timeLockStrategyConstructorArguments
  );

  // Set some configs.
  (await controllerV2.getAlliTokens()).forEach(async (iTokenAsset) => {
    await timeLockStrategy._setAssetLimitConfig(iTokenAsset, {
      minSingleLimit: minSingleLimit,
      midSingleLimit: midSingleLimit,
      minDailyLimit: minDailyLimit,
      midDailyLimit: midDailyLimit,
    });
  });

  // NOTICE: No whitelist when initialize time lock strategy contract.

  // Deploy time lock contract.
  const timeLockConstructorArguments = [controllerV2.address];
  const TimeLockFactory = await ethers.getContractFactory("DefaultTimeLock");
  // TODO: Proxy?
  const timeLock = await deployProxyWithConstructor(
    TimeLockFactory,
    timeLockConstructorArguments,
    {
      unsafeAllowCustomTypes: true,
      initializer: "initialize",
    },
    "", // implementation contract
    timeLockConstructorArguments
  );

  // Update controller to V2 to contain time lock strategy.
  await controllerV2._setTimeLock(timeLock.address);
  await controllerV2._setTimeLockStrategy(timeLockStrategy.address);

  return {
    ...results,
    timeLockStrategy,
    timeLock,
  };
}

async function fixtureDefault() {
  return await loadFixture(fixtureiMSDMiniPool);
}

async function fixtureV2() {
  return await loadFixture(fixtureOutDelay);
}

module.exports = {
  deployController,
  deployControllerFlashMint,
  deployiETH,
  deployStablecoinInterestRateModel,
  deployNonStablecoinInterestRateModel,
  deployInterestRateModel,
  deployiToken,
  deployMockFlashVault,
  deployiTokenAndSetConfigs,
  deployRewardDistributor,
  deployTreasuryAndConfig,
  deployMSD,
  deployMSDController,
  deployiMSD,
  deployiMSDFlashMint,
  deployMSDS,
  deployFixedInterestRateModel,
  deployMockAggregator,
  deployExchangeRateModel,
  deployMockGOLDx,
  deployLendingData,
  deployOracle,
  deployStatusOracle,
  deployMiniMinter,
  fixtureControllers,
  fixtureDefault,
  fixtureShortfall,
  fixtureV2,
  getiTokenCurrentData,
  getBlock,
  getChainId,
  getEthBalance,
  getCurrentTime,
  increaseBlock,
  increaseTime,
  miningAutomatically,
  setConfigForiToken,
  deployNonListed,
  loadFixture,
  upgradeToV2,
};
