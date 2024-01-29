import { run, sendTransaction } from "./helpers/utils";
import { deployContracts, deployContract } from "./helpers/deploy";

let task = { name: "dForceLending" };

const network = {
  59140: "lineaTestnet",
  534353: "scrollAlphaTestnet",
};

const deployInfo = {
  lineaTestnet: {
    blockTime: 12,
    liquidationIncentive: ethers.utils.parseEther("1.07"),
    closeFactor: ethers.utils.parseEther("0.5"),
    pauseGuardian: "0x6b29b8af9AF126170513AE6524395E09025b214E",
    DF: "",
    USX_MINT_CAP: ethers.utils.parseEther("100000000"),
    assets: {
      iETH: {
        underlying: ethers.constants.AddressZero,
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
      iUSDC: {
        underlying: "0xf56dc6695cF1f5c364eDEbC7Dc7077ac9B586068",
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
      iUSDT: {
        underlying: "0x1990BC6dfe2ef605Bfc08f5A23564dB75642Ad73",
        name: "dForce USDT",
        symbol: "iUSDT",
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
  scrollAlphaTestnet: {
    blockTime: 3,
    liquidationIncentive: ethers.utils.parseEther("1.07"),
    closeFactor: ethers.utils.parseEther("0.5"),
    pauseGuardian: "0x6b29b8af9AF126170513AE6524395E09025b214E",
    DF: "",
    USX_MINT_CAP: ethers.utils.parseEther("100000000"),
    assets: {
      iETH: {
        underlying: ethers.constants.AddressZero,
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
      iUSDC: {
        underlying: "0x67aE69Fd63b4fc8809ADc224A9b82Be976039509",
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
      iUSDT: {
        underlying: "0xf2719572e4E9369cDC061Ef602D0F20f8a42234d",
        name: "dForce USDT",
        symbol: "iUSDT",
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
  const blocksPerYear = Math.floor(
    (3600 * 24 * 365) / deployInfo[network[task.chainId]].blockTime
  );

  console.log("blocksPerYear:", blocksPerYear);

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

async function deployHelpers() {
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
    multicall: {
      contract: "Multicall3",
      path: "contracts/helper/",
      useProxy: false,
      getArgs: () => [],
    },
    lendingHelper: {
      contract: "LendingHelper",
      path: "contracts/helper/",
      useProxy: false,
      getArgs: () => [],
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
  // await addMarket();
  await deployHelpers();
}

run(task, dForceLending);
