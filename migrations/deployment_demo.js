import { run } from "./helpers/utils";
import { deployContracts } from "./helpers/deploy";

let task = { name: "demo" };
async function deploy() {
  task.contractsToDeploy = {
    proxyAdmin: {
      contract: "ProxyAdmin",
      path: "contracts/library/",
      useProxy: false,
      getArgs: () => [],
    },
    priceOracle: {
      contract: "PriceOracleV2",
      useProxy: false,
      getArgs: () => [task.signerAddr, ethers.utils.parseEther("0.1")],
    },
    stableInterestModel: {
      contract: "StablecoinInterestRateModel",
      path: "contracts/InterestRateModel/",
      useProxy: false,
      getArgs: () => [],
    },
    fixedInterestModel: {
      contract: "FixedInterestRateModel",
      path: "contracts/InterestRateModel/",
      useProxy: false,
      getArgs: () => [],
    },
    generalPoolController: {
      contract: "Controller",
      useProxy: true,
      getArgs: () => [],
    },
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
      getArgs: () => ["USX", "USX", 18],
    },
    //   iUSDT: {
    //      contract: "iToken",
    //      useProxy: true,
    //      getArgs: (deployments) => [
    //       deployments["USDT"].address,
    //       "iUSDT",
    //       "iUSDT",
    //       deployments["generalPoolController"].address,
    //       deployments["stableInterestModel"].address,
    //      ],
    //   },
    iMUSX: {
      contract: "iMSD",
      path: "contracts/msd/",
      useProxy: true,
      getArgs: (deployments) => [
        deployments["USX"].address,
        "iMUSX",
        "iMUSX",
        deployments["generalPoolController"].address,
        deployments["fixedInterestModel"].address,
        deployments["msdController"].address,
      ],
    },
  };

  await deployContracts(task);

  console.log(await task.contracts["proxyAdmin"].owner());
  console.log(await task.contracts["generalPoolController"].isController());
  console.log(await task.contracts["iMUSX"].name());
}

run(task, deploy);
