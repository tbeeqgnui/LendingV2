import { run, sendTransaction } from "./helpers/utils";
import { deployContracts, deployContract } from "./helpers/deploy";

let task = { name: "dForceLending" };

const network = {
  71: "ConfluxeSpaceTestnet",
  1030: "ConfluxeSpace",
};

const deployInfo = {
  ConfluxeSpaceTestnet: {
    liquidationIncentive: ethers.utils.parseEther("1.07"),
    closeFactor: ethers.utils.parseEther("0.5"),
    pauseGuardian: "0x6b29b8af9AF126170513AE6524395E09025b214E",
    DF: "",
    USX_MINT_CAP: ethers.utils.parseEther("100000000"),
    assets: {
      iETH: {
        underlying: "0xcd71270f82f319e0498ff98af8269c3f0d547c65",
        name: "dForce ETH",
        symbol: "iETH",
        interestRateModel: "mainPrimaryInterestModel",
        collateralFactor: ethers.utils.parseEther("0.80"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseUnits("40000", 18),
        borrowCapacity: ethers.utils.parseUnits("40000", 18),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
      iCFX: {
        underlying: ethers.constants.AddressZero,
        name: "dForce CFX",
        symbol: "iCFX",
        interestRateModel: "mainPrimaryInterestModel",
        collateralFactor: ethers.utils.parseEther("0.7"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseUnits("10000000", 18),
        borrowCapacity: ethers.utils.parseUnits("10000000", 18),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
      iUSX: {
        getUnderlying: (task) => task.contracts.USX.address,
        name: "dForce USX",
        symbol: "iUSX",
        interestRateModel: "stablePrimaryInterestModel",
        price: ethers.utils.parseUnits("1", 18),
        collateralFactor: ethers.utils.parseEther("0.85"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("20000000"),
        borrowCapacity: ethers.utils.parseEther("20000000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.1"),
      },
      iWBTC: {
        underlying: "0x54593e02c39aeff52b166bd036797d2b1478de8d",
        name: "dForce WBTC",
        symbol: "iWBTC",
        interestRateModel: "mainPrimaryInterestModel",
        collateralFactor: ethers.utils.parseEther("0.8"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseUnits("3000", 18),
        borrowCapacity: ethers.utils.parseUnits("3000", 18),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.2"),
      },
      iUSDC: {
        underlying: "0x349298b0e20df67defd6efb8f3170cf4a32722ef",
        name: "dForce USDC",
        symbol: "iUSDC",
        interestRateModel: "stablePrimaryInterestModel",
        collateralFactor: ethers.utils.parseEther("0.85"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseUnits("50000000", 18),
        borrowCapacity: ethers.utils.parseUnits("50000000", 18),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.1"),
      },
      iUSDT: {
        underlying: "0x7d682e65efc5c13bf4e394b8f376c48e6bae0355",
        name: "dForce USDT",
        symbol: "iUSDT",
        interestRateModel: "stablePrimaryInterestModel",
        aggregator: "0x0a6513e40db6eb1b165753ad52e80663aea50545",
        collateralFactor: ethers.utils.parseEther("0.85"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseUnits("50000000", 18),
        borrowCapacity: ethers.utils.parseUnits("50000000", 18),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.1"),
      },
      // Test for usdc upgrade
      iUSDCT: {
        underlying: "0x3CE4e9c2a4Aba765F7C1f62a9E20206fEf5f97CF",
        name: "dForce USDC",
        symbol: "iUSDC",
        interestRateModel: "stablePrimaryInterestModel",
        collateralFactor: ethers.utils.parseEther("0.85"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseUnits("50000000", 6),
        borrowCapacity: ethers.utils.parseUnits("50000000", 6),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.1"),
      },
    },
  },
  ConfluxeSpace: {
    liquidationIncentive: ethers.utils.parseEther("1.07"),
    closeFactor: ethers.utils.parseEther("0.5"),
    pauseGuardian: "0x491C366614b971596cFf5570665DD9d24966de49",
    DF: "",
    assets: {
      iWBTC: {
        underlying: "0x1f545487c62e5acfea45dcadd9c627361d1616d8",
        name: "dForce WBTC",
        symbol: "iWBTC",
        interestRateModel: "mainPrimaryInterestModel",
        collateralFactor: ethers.utils.parseEther("0.8"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseUnits("35", 18),
        borrowCapacity: ethers.utils.parseUnits("35", 18),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.2"),
      },
      iETH: {
        underlying: "0xa47f43de2f9623acb395ca4905746496d2014d57",
        name: "dForce ETH",
        symbol: "iETH",
        interestRateModel: "mainPrimaryInterestModel",
        collateralFactor: ethers.utils.parseEther("0.85"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseUnits("500", 18),
        borrowCapacity: ethers.utils.parseUnits("500", 18),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
      // iCFX: {
      //   underlying: ethers.constants.AddressZero,
      //   name: "dForce CFX",
      //   symbol: "iCFX",
      //   interestRateModel: "mainPrimaryInterestModel",
      //   collateralFactor: ethers.utils.parseEther("0.7"),
      //   borrowFactor: ethers.utils.parseEther("1"),
      //   supplyCapacity: ethers.utils.parseUnits("10000000", 18),
      //   borrowCapacity: ethers.utils.parseUnits("10000000", 18),
      //   distributionFactor: ethers.utils.parseEther("1"),
      //   reserveRatio: ethers.utils.parseEther("0.15"),
      // },
      iUSDT: {
        underlying: "0xfe97e85d13abd9c1c33384e796f10b73905637ce",
        name: "dForce USDT",
        symbol: "iUSDT",
        interestRateModel: "stablePrimaryInterestModel",
        aggregator: "0x0a6513e40db6eb1b165753ad52e80663aea50545",
        collateralFactor: ethers.utils.parseEther("0.85"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseUnits("2000000", 18),
        borrowCapacity: ethers.utils.parseUnits("2000000", 18),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.1"),
      },
      iUSDC: {
        underlying: "0x6963efed0ab40f6c3d7bda44a05dcf1437c44372",
        name: "dForce USDC",
        symbol: "iUSDC",
        interestRateModel: "stablePrimaryInterestModel",
        collateralFactor: ethers.utils.parseEther("0.85"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseUnits("2000000", 18),
        borrowCapacity: ethers.utils.parseUnits("2000000", 18),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.1"),
      },
      iUSX: {
        getUnderlying: (task) => task.contracts.USX.address,
        name: "dForce USX",
        symbol: "iUSX",
        interestRateModel: "stablePrimaryInterestModel",
        price: ethers.utils.parseUnits("1", 18),
        collateralFactor: ethers.utils.parseEther("0.85"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("2000000"),
        borrowCapacity: ethers.utils.parseEther("2000000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.1"),
      },
    },
  },
};

async function deployAdministrative() {
  task.contractsToDeploy = {
    proxyAdmin: {
      contract: "ProxyAdmin",
      path: "contracts/library/",
      useProxy: false,
      getArgs: () => [],
    },
    timelock: {
      contract: "Timelock",
      path: "contracts/governance/",
      useProxy: false,
      getArgs: () => [],
    },
  };

  await deployContracts(task);
}

async function deployInterestRateModel() {
  // 3600 * 24 * 365 // 1.25
  const blocksPerYear = 25228800;

  task.contractsToDeploy = {
    fixedInterestRateModel: {
      contract: "FixedInterestRateModel",
      path: "contracts/InterestRateModel/",
      useProxy: false,
      getArgs: () => [],
    },
    stablePrimaryInterestModel: {
      contract: "StablePrimaryInterestModel@InterestRateModelV2",
      path: "contracts/InterestRateModel/",
      useProxy: false,
      getArgs: () => [blocksPerYear],
    },
    stableSecondaryInterestModel: {
      contract: "StableSecondaryInterestModel@InterestRateModelV2",
      path: "contracts/InterestRateModel/",
      useProxy: false,
      getArgs: () => [blocksPerYear],
    },
    mainPrimaryInterestModel: {
      contract: "MainPrimaryInterestModel@InterestRateModelV2",
      path: "contracts/InterestRateModel/",
      useProxy: false,
      getArgs: () => [blocksPerYear],
    },
    mainSecondaryInterestModel: {
      contract: "MainSecondaryInterestModel@InterestRateModelV2",
      path: "contracts/InterestRateModel/",
      useProxy: false,
      getArgs: () => [blocksPerYear],
    },
  };

  await deployContracts(task);
}

async function deployMSD() {
  task.contractsToDeploy = {
    msdController: {
      contract: "MSDControllerV2",
      path: "contracts/msd/",
      useProxy: true,
      getArgs: () => [],
    },
    USX: {
      contract: "MSD",
      path: "contracts/msd/",
      useProxy: true,
      getArgs: () => ["dForce USD", "USX", 18],
    },
  };

  await deployContracts(task);

  await sendTransaction(task, "USX", "_addMinter", [
    task.contracts.msdController.address,
  ]);
}

async function deployGeneralPool() {
  const info = deployInfo[network[task.chainId]];

  task.contractsToDeploy = {
    controller: {
      contract: "ControllerStock",
      useProxy: true,
      getArgs: () => [],
    },
    rewardDistributor: {
      contract: "RewardDistributorV3",
      useProxy: true,
      getArgs: (deployments) => [deployments.controller.address],
    },
  };

  await deployContracts(task);

  if (
    (await task.contracts.controller.priceOracle()) !=
    task.contracts.priceOracle.address
  ) {
    await sendTransaction(task, "controller", "_setPriceOracle", [
      task.contracts.priceOracle.address,
    ]);
  }

  if (
    (await task.contracts.controller.rewardDistributor()) !=
    task.contracts.rewardDistributor.address
  ) {
    await sendTransaction(task, "controller", "_setRewardDistributor", [
      task.contracts.rewardDistributor.address,
    ]);
  }

  // Close Factor
  if (
    !(await task.contracts.controller.closeFactorMantissa()).eq(
      info.closeFactor
    )
  ) {
    await sendTransaction(task, "controller", "_setCloseFactor", [
      info.closeFactor,
    ]);
  }

  // Liquidation Incentive
  if (
    !(await task.contracts.controller.liquidationIncentiveMantissa()).eq(
      info.liquidationIncentive
    )
  ) {
    await sendTransaction(task, "controller", "_setLiquidationIncentive", [
      info.liquidationIncentive,
    ]);
  }

  // Pause Guardian
  if ((await task.contracts.controller.pauseGuardian()) != info.pauseGuardian) {
    await sendTransaction(task, "controller", "_setPauseGuardian", [
      info.pauseGuardian,
    ]);
  }

  // Set reward Token
  //   await sendTransaction(task, "rewardDistributor", "_setRewardToken", [
  //     info.DF,
  //   ]);
}

async function setPriceIfNeeded(iToken, price) {
  const priceOraclePrice =
    await task.contracts.priceOracle.callStatic.getUnderlyingPrice(iToken);
  if (priceOraclePrice.eq(price)) return;

  await sendTransaction(task, "priceOracle", "setPrice", [iToken, price]);
}

async function deployAssets() {
  let iTokens = [];
  let aggregators = [];

  for (const [key, config] of Object.entries(
    deployInfo[network[task.chainId]].assets
  )) {
    // deploy assets

    const underlying = config.hasOwnProperty("getUnderlying")
      ? config.getUnderlying(task)
      : config.underlying;

    // underlying = 0x0000000000000000000000000000000000000000 => iETH
    if (underlying === ethers.constants.AddressZero) {
      await deployContract(
        task.contracts,
        task.deployments,
        task.signer,
        task.proxyAdmin,
        key,
        {
          contract: "iETH",
          useProxy: true,
          getArgs: (deployments) => [
            config.name,
            config.symbol,
            deployments.controller.address,
            deployments[config.interestRateModel].address,
          ],
        }
      );
    } else {
      await deployContract(
        task.contracts,
        task.deployments,
        task.signer,
        task.proxyAdmin,
        key,
        {
          contract: "iToken",
          useProxy: true,
          getArgs: (deployments) => [
            underlying,
            config.name,
            config.symbol,
            deployments.controller.address,
            deployments[config.interestRateModel].address,
          ],
        }
      );
    }

    // set reserve ratio
    if (!(await task.contracts[key].reserveRatio()).eq(config.reserveRatio)) {
      await sendTransaction(task, key, "_setNewReserveRatio", [
        config.reserveRatio,
      ]);
    }
  }
}

async function addMarket() {
  for (const [key, config] of Object.entries(
    deployInfo[network[task.chainId]].assets
  )) {
    // Add Market
    if (
      !(await task.contracts.controller.hasiToken(task.contracts[key].address))
    ) {
      await sendTransaction(task, "controller", "_addMarket", [
        task.contracts[key].address,
        config.collateralFactor,
        config.borrowFactor,
        config.supplyCapacity,
        config.borrowCapacity,
        config.distributionFactor,
      ]);
    }
  }
}

async function deployLendingData() {
  task.contractsToDeploy = {
    lendingData: {
      contract: "LendingDataV2",
      path: "contracts/helper/",
      useProxy: false,
      getArgs: (deployments) => [
        deployments.controller.address,
        deployments.iUSX.address,
      ],
    },
  };

  await deployContracts(task);
}

async function dForceLending() {
  // await deployAdministrative();
  // await deployInterestRateModel();

  // Oracle has been move to a new repo, deploy and copy the oracle address
  // await deployPriceOracle();

  // await deployMSD();

  // await deployGeneralPool();
  // await deployAssets();

  // Set Price in the Oracle repo
  await addMarket();
  // await deployLendingData();
}

run(task, dForceLending);
