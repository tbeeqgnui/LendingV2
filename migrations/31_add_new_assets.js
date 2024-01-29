import {
  run,
  sendTransaction,
  printTransactionInsteadOfSend,
} from "./helpers/utils";
import { deployContracts, deployContract } from "./helpers/deploy";

let task = { name: "dForceLending" };

const network = {
  10: "optimism",
  137: "polygon",
  42161: "arbitrum",
  1: "mainnet",
};

const deployInfo = {
  optimism: {
    // 3600 * 24 * 365 // 13
    blocksPerYear: 2425846,
    assets: {
      isUSD: {
        underlying: "0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9",
        name: "dForce sUSD",
        symbol: "isUSD",
        interestRateModel: "stablePrimaryInterestModel",
        aggregator: "0x7f99817d87baD03ea21E05112Ca799d715730efe",
        collateralFactor: ethers.utils.parseEther("0"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("15000000"),
        borrowCapacity: ethers.utils.parseEther("15000000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
      iAAVE: {
        underlying: "0x76FB31fb4af56892A25e32cFC43De717950c9278",
        name: "dForce AAVE",
        symbol: "iAAVE",
        interestRateModel: "mainSecondaryInterestModel",
        aggregator: "0x338ed6787f463394D24813b297401B9F05a8C9d1",
        collateralFactor: ethers.utils.parseEther("0.7"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("100000"),
        borrowCapacity: ethers.utils.parseEther("100000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
      iCRV: {
        underlying: "0x0994206dfE8De6Ec6920FF4D779B0d950605Fb53",
        name: "dForce CRV",
        symbol: "iCRV",
        interestRateModel: "mainSecondaryInterestModel",
        aggregator: "0xbD92C6c284271c227a1e0bF1786F468b539f51D9",
        collateralFactor: ethers.utils.parseEther("0.65"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("50000000"),
        borrowCapacity: ethers.utils.parseEther("50000000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
      iDF: {
        underlying: "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3",
        name: "dForce DF",
        symbol: "iDF",
        interestRateModel: "mainSecondaryInterestModel",
        reader: "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3",
        collateralFactor: ethers.utils.parseEther("0.6"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("10000000"),
        borrowCapacity: ethers.utils.parseEther("10000000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.25"),
      },
      OP: {
        underlying: "0x4200000000000000000000000000000000000042",
        name: "dForce OP",
        symbol: "OP",
        interestRateModel: "mainSecondaryInterestModel",
        aggregator: "0x0D276FC14719f9292D5C1eA2198673d1f4269246",
        collateralFactor: ethers.utils.parseEther("0.65"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("50000000"),
        borrowCapacity: ethers.utils.parseEther("50000000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
      iwstETH: {
        underlying: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb",
        name: "dForce wstETH",
        symbol: "iwstETH",
        interestRateModel: "mainPrimaryInterestModel",
        aggregator: "0x0000000000000000000000000000000000000000", //wstETH-stETH
        collateralFactor: ethers.utils.parseEther("0.75"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("5000"),
        borrowCapacity: ethers.utils.parseEther("0"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.1"),
      },
    },
  },
  polygon: {
    // 3600 * 24 * 365 // 2.3
    blocksPerYear: 13711304,
    assets: {
      iAAVE: {
        underlying: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B",
        name: "dForce AAVE",
        symbol: "iAAVE",
        interestRateModel: "mainSecondaryInterestModel",
        aggregator: "0x72484B12719E23115761D5DA1646945632979bB6",
        collateralFactor: ethers.utils.parseEther("0.7"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("100000"),
        borrowCapacity: ethers.utils.parseEther("100000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
      iCRV: {
        underlying: "0x172370d5Cd63279eFa6d502DAB29171933a610AF",
        name: "dForce CRV",
        symbol: "iCRV",
        interestRateModel: "mainSecondaryInterestModel",
        aggregator: "0x336584C8E6Dc19637A5b36206B1c79923111b405",
        collateralFactor: ethers.utils.parseEther("0.65"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("50000000"),
        borrowCapacity: ethers.utils.parseEther("50000000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
      iDF: {
        underlying: "0x08C15FA26E519A78a666D19CE5C646D55047e0a3",
        name: "dForce DF",
        symbol: "iDF",
        interestRateModel: "mainSecondaryInterestModel",
        reader: "0x08C15FA26E519A78a666D19CE5C646D55047e0a3",
        collateralFactor: ethers.utils.parseEther("0.6"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("10000000"),
        borrowCapacity: ethers.utils.parseEther("10000000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.25"),
      },
      iETH: {
        name: "dForce MATIC",
        symbol: "iMATIC",
        interestRateModel: "mainPrimaryInterestModel",
        aggregator: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
        collateralFactor: ethers.utils.parseEther("0.7"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("50000000"),
        borrowCapacity: ethers.utils.parseEther("50000000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
    },
  },
  arbitrum: {
    // 3600 * 24 * 365 // 13
    blocksPerYear: 2425846,
    assets: {
      iAAVE: {
        underlying: "0xba5DdD1f9d7F570dc94a51479a000E3BCE967196",
        name: "dForce AAVE",
        symbol: "iAAVE",
        interestRateModel: "mainSecondaryInterestModel",
        aggregator: "0xaD1d5344AaDE45F43E596773Bcc4c423EAbdD034",
        collateralFactor: ethers.utils.parseEther("0.7"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("100000"),
        borrowCapacity: ethers.utils.parseEther("100000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
      iCRV: {
        underlying: "0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978",
        name: "dForce CRV",
        symbol: "iCRV",
        interestRateModel: "mainSecondaryInterestModel",
        aggregator: "0xaebDA2c976cfd1eE1977Eac079B4382acb849325",
        collateralFactor: ethers.utils.parseEther("0.65"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("50000000"),
        borrowCapacity: ethers.utils.parseEther("50000000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
      iwstETH: {
        underlying: "0x5979D7b546E38E414F7E9822514be443A4800529",
        name: "dForce wstETH",
        symbol: "iwstETH",
        interestRateModel: "mainPrimaryInterestModel",
        aggregator: "0x0000000000000000000000000000000000000000", //wstETH-stETH
        collateralFactor: ethers.utils.parseEther("0.75"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("5000"),
        borrowCapacity: ethers.utils.parseEther("0"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.1"),
      },
      iARB: {
        underlying: "0x912CE59144191C1204E64559FE8253a0e49E6548",
        name: "dForce ARB",
        symbol: "iARB",
        interestRateModel: "mainSecondaryInterestModel",
        aggregator: "0x0000000000000000000000000000000000000000", //ARB-USD
        collateralFactor: ethers.utils.parseEther("0.8"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("10000000"),
        borrowCapacity: ethers.utils.parseEther("10000000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
    },
  },
  mainnet: {
    // 3600 * 24 * 365 // 13
    blocksPerYear: 2425846,
    assets: {
      iAAVE: {
        underlying: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
        name: "dForce AAVE",
        symbol: "iAAVE",
        interestRateModel: "mainSecondaryInterestModel",
        aggregator: "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
        collateralFactor: ethers.utils.parseEther("0.7"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("100000"),
        borrowCapacity: ethers.utils.parseEther("100000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
      iCRV: {
        underlying: "0xD533a949740bb3306d119CC777fa900bA034cd52",
        name: "dForce CRV",
        symbol: "iCRV",
        interestRateModel: "mainSecondaryInterestModel",
        aggregator: "0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f",
        collateralFactor: ethers.utils.parseEther("0.65"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("50000000"),
        borrowCapacity: ethers.utils.parseEther("50000000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
      irenFIL: {
        underlying: "0xD5147bc8e386d91Cc5DBE72099DAC6C9b99276F5",
        name: "dForce renFIL",
        symbol: "irenFIL",
        interestRateModel: "mainSecondaryInterestModel",
        aggregator: "0x1A31D42149e82Eb99777f903C08A2E41A00085d3",
        collateralFactor: ethers.utils.parseEther("0.65"),
        borrowFactor: ethers.utils.parseEther("1"),
        supplyCapacity: ethers.utils.parseEther("50000000"),
        borrowCapacity: ethers.utils.parseEther("50000000"),
        distributionFactor: ethers.utils.parseEther("1"),
        reserveRatio: ethers.utils.parseEther("0.15"),
      },
    },
  },
};

async function deployInterestRateModel() {
  const blocksPerYear = deployInfo[network[task.chainId]].blocksPerYear;

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

async function setPriceIfNeeded(iToken, price) {
  const priceOraclePrice =
    await task.contracts.priceOracle.callStatic.getUnderlyingPrice(iToken);
  if (priceOraclePrice.eq(price)) return;

  await sendTransaction(task, "priceOracle", "setPrice", [iToken, price]);
}

async function setReaderIfNeeded(iToken, readFrom) {
  const reader = await task.contracts.priceOracle.callStatic.readers(iToken);
  if (reader === readFrom) return;

  await sendTransaction(task, "priceOracle", "setReaders", [iToken, readFrom]);
}

async function deployAssets() {
  for (const [key, config] of Object.entries(
    deployInfo[network[task.chainId]].assets
  )) {
    // deploy assets
    const underlying = config.hasOwnProperty("getUnderlying")
      ? config.getUnderlying(task)
      : config.underlying;

    if (key == "iETH") {
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

async function feedPrices() {
  let iTokens = [];
  let aggregators = [];

  for (const [key, config] of Object.entries(
    deployInfo[network[task.chainId]].assets
  )) {
    // Add aggregator into set list
    if (config.hasOwnProperty("price")) {
      await setPriceIfNeeded(task.contracts[key].address, config.price);
    } else if (config.hasOwnProperty("reader")) {
      await setReaderIfNeeded(task.contracts[key].address, config.reader);
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

async function addNewAssets() {
  await run(task, deployInterestRateModel);
  await run(task, deployAssets);
  await run(task, feedPrices); //by anchorAdmin

  printTransactionInsteadOfSend();
  await run(task, addMarket);
}

addNewAssets();
