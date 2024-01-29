import { run, sendTransaction } from "./helpers/utils";
import { deployContracts, deployContract } from "./helpers/deploy";

let task = { name: "dForceLending" };

const network = {
  2222: "kava",
};

const deployInfo = {
  kava: {
    maxSwing: ethers.utils.parseEther("0.1"),
    liquidationIncentive: ethers.utils.parseEther("1.07"),
    closeFactor: ethers.utils.parseEther("0.5"),
    pauseGuardian: "0x491C366614b971596cFf5570665DD9d24966de49",
    DF: "",
    iMUSXBorrowRate: ethers.utils.parseUnits("0", "wei"),
    USX_MINT_CAP: ethers.utils.parseEther("100000000"),
    assets: {
      iUSDC: {
        underlying: "0x23367BEA9B6931690960d8c59f6e708630f24E58",
        name: "dForce USDC",
        symbol: "iUSDC",
        interestRateModel: "stablePrimaryInterestModel",
        price: ethers.utils.parseUnits("1", 30),
        collateralFactor: ethers.utils.parseEther("0.85"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseUnits("10000000", 6),
        borrowCapacity: ethers.utils.parseUnits("10000000", 6),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.1"),
      },
      iUSDT: {
        underlying: "0xfB1af1baFE108906C0f1f3B36D15919B95ee95BD",
        name: "dForce USDT",
        symbol: "iUSDT",
        interestRateModel: "stablePrimaryInterestModel",
        price: ethers.utils.parseUnits("1", 30),
        collateralFactor: ethers.utils.parseEther("0.85"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseUnits("10000000", 6),
        borrowCapacity: ethers.utils.parseUnits("10000000", 6),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.1"),
      },
      iUSX: {
        underlying: (task) => task.contracts.USX.address,
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
      // iWETH: {
      //   underlying: "0xa175D42Aa612E309C13Db642445B89657e1fdd33",
      //   name: "dForce WETH",
      //   symbol: "iWETH",
      //   interestRateModel: "stablePrimaryInterestModel",
      //   price: ethers.utils.parseEther("3200"),
      //   collateralFactor: ethers.utils.parseEther("0.80"),
      //   borrowFactor: ethers.utils.parseEther("1"),
      //   supplyCapacity: ethers.utils.parseEther("40000"),
      //   borrowCapacity: ethers.utils.parseEther("40000"),
      //   distributionFactor: ethers.utils.parseEther("1"),
      //   reserveRatio: ethers.utils.parseEther("0.15"),
      // },
      // iKAVA: {
      //   name: "dForce KAVA",
      //   symbol: "iKAVA",
      //   interestRateModel: "stablePrimaryInterestModel",
      //   price: ethers.utils.parseEther("6"),
      //   collateralFactor: ethers.utils.parseEther("0.8"),
      //   borrowFactor: ethers.utils.parseEther("1"),
      //   supplyCapacity: ethers.utils.parseUnits("100000", 18),
      //   borrowCapacity: ethers.utils.parseUnits("100000", 18),
      //   distributionFactor: ethers.utils.parseEther("1"),
      //   reserveRatio: ethers.utils.parseEther("0.2"),
      // },
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
  // 3600 * 24 * 365 // 6.3
  const blocksPerYear = 5005714;

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
    // stableSecondaryInterestModel: {
    //   contract: "StableSecondaryInterestModel@InterestRateModelV2",
    //   path: "contracts/InterestRateModel/",
    //   useProxy: false,
    //   getArgs: () => [blocksPerYear],
    // },
    // mainPrimaryInterestModel: {
    //   contract: "MainPrimaryInterestModel@InterestRateModelV2",
    //   path: "contracts/InterestRateModel/",
    //   useProxy: false,
    //   getArgs: () => [blocksPerYear],
    // },
    // mainSecondaryInterestModel: {
    //   contract: "MainSecondaryInterestModel@InterestRateModelV2",
    //   path: "contracts/InterestRateModel/",
    //   useProxy: false,
    //   getArgs: () => [blocksPerYear],
    // },
  };

  await deployContracts(task);
}

async function deployPriceOracle() {
  task.contractsToDeploy = {
    priceOracle: {
      contract: "PriceOracleV2",
      path: "contracts/",
      useProxy: false,
      getArgs: () => [
        task.signerAddr,
        deployInfo[network[task.chainId]].maxSwing,
      ],
    },
    aggregatorProxy: {
      contract: "AggregatorProxy",
      path: "contracts/aggregatorModelV2/",
      useProxy: false,
      getArgs: () => [],
    },
  };

  await deployContracts(task);

  await setAggregatorProxy();
}

async function setAggregatorProxy() {
  let aggregatorProxy = await task.contracts.priceOracle.aggregatorProxy();
  if (aggregatorProxy == task.contracts.aggregatorProxy.address) return;

  await sendTransaction(task, "priceOracle", "_setAggregatorProxy", [
    task.deployments.aggregatorProxy.address,
  ]);
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
    // EUX: {
    //   contract: "MSD",
    //   path: "contracts/msd/",
    //   useProxy: true,
    //   getArgs: () => ["dForce EUR", "EUX", 18],
    // },
  };

  await deployContracts(task);

  await sendTransaction(task, "USX", "_addMinter", [
    task.contracts.msdController.address,
  ]);

  //   await sendTransaction(task, "EUX", "_addMinter", [
  //     task.contracts.msdController.address,
  //   ]);
}

async function deployGeneralPool() {
  const info = deployInfo[network[task.chainId]];

  task.contractsToDeploy = {
    controller: {
      contract: "Controller",
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
  const priceOraclePrice = await task.contracts.priceOracle.callStatic.getUnderlyingPrice(
    iToken
  );
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

    if (key == iKAVA) {
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

    // Add aggregator into set list
    if (config.hasOwnProperty("price")) {
      await setPriceIfNeeded(task.contracts[key].address, config.price);
    } else {
      if (
        (await task.contracts.priceOracle.aggregator(
          task.contracts[key].address
        )) != config.aggregator
      ) {
        iTokens.push(task.contracts[key].address);
        aggregators.push(config.aggregator);
      }
    }
  }

  // set Price
  if (iTokens.length > 0) {
    await sendTransaction(task, "priceOracle", "_setAssetAggregatorBatch", [
      iTokens,
      aggregators,
    ]);
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

async function deployiMUSX() {
  const info = deployInfo[network[task.chainId]];

  task.contractsToDeploy = {
    iMUSX: {
      contract: "iMSD",
      path: "contracts/msd/",
      useProxy: true,
      getArgs: (deployments) => [
        deployments.USX.address,
        "dForce USD",
        "iMUSX",
        deployments.controller.address,
        deployments.fixedInterestRateModel.address,
        deployments.msdController.address,
      ],
    },
  };

  await deployContracts(task);

  // No need to set reserve ratio it is fixed to 1

  // Set Price
  await setPriceIfNeeded(
    task.contracts.iMUSX.address,
    ethers.utils.parseEther("1")
  );

  // Add Market
  if (
    !(await task.contracts.controller.hasiToken(task.contracts.iMUSX.address))
  ) {
    await sendTransaction(task, "controller", "_addMarket", [
      task.contracts.iMUSX.address,
      ethers.utils.parseEther("0.7"), //   collateralFactor,
      ethers.utils.parseEther("1"), //   borrowFactor,
      ethers.utils.parseEther("0"), //   supplyCapacity,
      info.USX_MINT_CAP, //   borrowCapacity,
      ethers.utils.parseEther("1"), //   distributionFactor,
    ]);
  }

  // Add iMUSX to MSDController
  await sendTransaction(task, "msdController", "_addMSD", [
    task.contracts.USX.address,
    [task.contracts.iMUSX.address],
    [info.USX_MINT_CAP],
  ]);

  // Set Borrow Rate
  if (
    !(
      await task.contracts.fixedInterestRateModel.borrowRatesPerBlock(
        task.contracts.iMUSX.address
      )
    ).eq(info.iMUSXBorrowRate)
  ) {
    await sendTransaction(task, "fixedInterestRateModel", "_setBorrowRate", [
      task.contracts.iMUSX.address,
      info.iMUSXBorrowRate,
    ]);
  }
}

async function deployLendingData() {
  task.contractsToDeploy = {
    lendingData: {
      contract: "LendingDataV2",
      path: "contracts/helper/",
      useProxy: true,
      getArgs: (deployments) => [
        deployments.controller.address,
        deployments.iUSDC.address,
      ],
    },
  };

  await deployContracts(task);
}

async function transferOwnership() {}

async function dForceLending() {
  await run(task, deployAdministrative);
  await run(task, deployInterestRateModel);
  await run(task, deployPriceOracle);
  await run(task, deployMSD);
  await run(task, deployGeneralPool);
  await run(task, deployAssets);
  await run(task, addMarket);
  await run(task, deployiMUSX);
  await run(task, deployLendingData);
}

dForceLending();