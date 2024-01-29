import { deployContracts, deployContract } from "./helpers/deploy";
import { printArgs } from "./helpers/timelock";
import {
  run,
  sendTransaction,
  sendTransactionInsteadOfPrint,
  printTransactionInsteadOfSend,
  printTenderlyInsteadOfSend,
} from "./helpers/utils.js";

const TENDERLY_FORK_ID = "0868fa5a-7403-4e8f-a094-ba32fb837e08";

const network = {
  1: "mainnet",
  4: "rinkeby",
  56: "bsc",
  42161: "arbitrum",
  421611: "arbitrum_test",
  42: "kovan",
  69: "optimism_kovan",
  10: "optimism",
  137: "polygon",
  2222: "kava",
  43114: "avalanche",
  1030: "ConfluxeSpace",
};

let task = { name: "FlashVault" };

let deployInfo = {
  mainnet: {
    DF: "0x431ad2ff6a9C365805eBaD47Ee021148d6f7DBe0",
    USX: "0x0a5E677a6A24b2F1A2Bf4F3bFfC443231d2fDEc8",
    iUSX: "0x1AdC34Af68e970a93062b67344269fD341979eb0",
    qUSX: "0xA5d65E3bD7411D409EC2CCFa30C6511bA8a99D2B",
    FIXED_INTEREST_RATE_MODEL: "0x22961D0Ba5150f97AE0F3248b4c415875cBf42d5",
    GUARDIAN: "0x491C366614b971596cFf5570665DD9d24966de49",
    VMUSX_MINT_CAP: ethers.utils.parseEther("100000000"),
    POSTER: "",
    MAX_SWING: "",
  },
  bsc: {
    DF: "0x4A9A2b2b04549C3927dd2c9668A5eF3fCA473623",
    USX: "0xB5102CeE1528Ce2C760893034A4603663495fD72",
    FIXED_INTEREST_RATE_MODEL: "0x0BCb6Be12022c1881031F86C502daA49909b74a1",
    GUARDIAN: "0x491C366614b971596cFf5570665DD9d24966de49",
    L1_CBRIDGE: "0xdd90E5E87A2081Dcf0391920868eBc2FFB81a1aF",
    vMSDs: {
      // vMUSX: {
      //   underlying: "0xB5102CeE1528Ce2C760893034A4603663495fD72", // USX
      //   name: "dForce Vault vMUSX",
      //   symbol: "vMUSX",
      //   price: ethers.utils.parseEther("1"),
      //   borrowCap: ethers.utils.parseEther("100000000"),
      //   operator: "",
      //   // For cBridge
      //   miniMinter: "",
      //   miniMinterCap: "ethers.utils.parseEther("100000000")",
      // },
      // vMEUX: {
      //   underlying: "0x367c17D19fCd0f7746764455497D63c8e8b2BbA3",
      //   name: "dForce Vault vMEUX",
      //   symbol: "vMEUX",
      //   aggregator: "0x0bf79F617988C472DcA68ff41eFe1338955b9A80",
      //   borrowCap: ethers.utils.parseEther("100000000"),
      //   operator: "0xf0D29c81d3ECdf0CeD8f7cB0B77E1907575fD30c",
      //   // For cBridge
      //   miniMinter: "0x999576cdfbbC06466AB828FcAf94af6c79f450C4",
      //   miniMinterCap: ethers.utils.parseEther("100000000"),
      // },
    },
    collaterals: {
      // viUSX: {
      //   underlying: "0x7B933e1c1F44bE9Fb111d87501bAADA7C8518aBe",
      //   name: "dForce Vault iUSX",
      //   symbol: "viUSX",
      //   supplyCap: ethers.utils.parseEther("100000000"),
      //   operator: "",
      // },
      vqUSX: {
        underlying: "0x450E09a303AA4bcc518b5F74Dd00433bd9555A77",
        name: "dForce Vault qUSX",
        symbol: "vqUSX",
        supplyCap: ethers.utils.parseEther("100000000"),
        operator: "0x6c69B26fBfdDA4d38e3aE2E32dCE0AB66Ba2C3c9",
      },
      // viEUX: {
      //   underlying: "0x983A727Aa3491AB251780A13acb5e876D3f2B1d8",
      //   name: "dForce Vault iEUX",
      //   symbol: "viEUX",
      //   supplyCap: ethers.utils.parseEther("100000000"),
      //   operator: "0xf0D29c81d3ECdf0CeD8f7cB0B77E1907575fD30c",
      // },
    },
  },
  kovan: {
    DF: "0x4A9A2b2b04549C3927dd2c9668A5eF3fCA473623",
    USX: "0xF76eAd4da04BbeB97d29F83e2Ec3a621d0FB3c6e",
    iUSX: "0x9778dde08eC20418DC735a94805c20F5e2E7e51E",
    qUSX: "0x391498abd69753f4343c12a210A0f0a9F510Ac44",
    FIXED_INTEREST_RATE_MODEL: "0xA54b568f30309c51648AD92Dbf049037f924B689",
    GUARDIAN: "",
    VMUSX_MINT_CAP: ethers.utils.parseEther("100000000"),
    POSTER: "",
    MAX_SWING: "",
  },
  arbitrum: {
    DF: "0xaE6aab43C4f3E0cea4Ab83752C278f8dEbabA689",
    USX: "0x641441c631e2F909700d2f41FD87F0aA6A6b4EDb",
    iUSX: "0x0385F851060c09A552F1A28Ea3f612660256cBAA",
    FIXED_INTEREST_RATE_MODEL: "0x96429fD3a3b29C918c3734b86871142aAA6ce2fd",
    GUARDIAN: "",
    POSTER: "",
    MAX_SWING: "",
    vTOKEN_SUPPLY_CAP: ethers.utils.parseEther("100000000"),
    vTOKEN_BORROW_CAP: ethers.utils.parseEther("100000000"),
    viTOKEN_SUPPLY_CAP: ethers.utils.parseEther("100000000"),
    // cBridge: "0x1619DE6B6B20eD217a58d00f37B9d47C7663feca",
    // arbiBridge: "0x1C4d5eCFBf2AF57251f20a524D0f0c1b4f6ED1C9",
  },
  arbitrum_test: {
    USX: "0x53876c224Ef395428c97b368236Eb7132400c4B3",
    iUSX: "0x11914e1754f2cb9b886766C8A06894fCF09127D3",
    FIXED_INTEREST_RATE_MODEL: "0xD854e5517829b1eD068712360e9E7d8503542Def",
    // GUARDIAN: "",
    vTOKEN_SUPPLY_CAP: ethers.utils.parseEther("100000000"),
    vTOKEN_BORROW_CAP: ethers.utils.parseEther("100000000"),
    viTOKEN_SUPPLY_CAP: ethers.utils.parseEther("100000000"),
    cBridge: "",
    arbiBridge: "",
  },
  optimism: {
    USX: "0xbfD291DA8A403DAAF7e5E9DC1ec0aCEaCd4848B9",
    iUSX: "0x7e7e1d8757b241Aa6791c089314604027544Ce43",
    FIXED_INTEREST_RATE_MODEL: "0xC5b1EC605738eF73a4EFc562274c1c0b6609cF59",
    GUARDIAN: "0x491C366614b971596cFf5570665DD9d24966de49",
    POSTER: "",
    MAX_SWING: "",
    vTOKEN_SUPPLY_CAP: ethers.utils.parseEther("100000000"),
    vTOKEN_BORROW_CAP: ethers.utils.parseEther("100000000"),
    viTOKEN_SUPPLY_CAP: ethers.utils.parseEther("100000000"),
    cBridge: "",
    opBridge: "",
  },
  optimism_kovan: {
    USX: "0xab7020476D814C52629ff2e4cebC7A8cdC04F18E",
    iUSX: "0xD75DDCA174a86F89cb21cb4F7a66694181bf5fc2",
    FIXED_INTEREST_RATE_MODEL: "0xb5a827CFd5eDcCC3f43f9dBbab174c8289688058",
    // GUARDIAN: "",
    vTOKEN_SUPPLY_CAP: ethers.utils.parseEther("100000000"),
    vTOKEN_BORROW_CAP: ethers.utils.parseEther("100000000"),
    viTOKEN_SUPPLY_CAP: ethers.utils.parseEther("100000000"),
    cBridge: "0x1e1a9f49D47AD5FAeADc03acA7a79BDbEA72A68d",
    opBridge: "0xB4d37826b14Cd3CB7257A2A5094507d701fe715f",
  },
  polygon: {
    USX: "0xCf66EB3D546F0415b368d98A95EAF56DeD7aA752",
    FIXED_INTEREST_RATE_MODEL: "0x369Da886fC07B6d5ee5F1bb471d4f8E7833526F9",
    GUARDIAN: "0x491C366614b971596cFf5570665DD9d24966de49",
    VMUSX_MINT_CAP: ethers.utils.parseEther("100000000"),
    vMSDs: {
      // vMUSX: {
      //   underlying: "0xCf66EB3D546F0415b368d98A95EAF56DeD7aA752", // USX
      //   name: "dForce Vault vMUSX",
      //   symbol: "vMUSX",
      //   price: ethers.utils.parseEther("1"),
      //   borrowCap: ethers.utils.parseEther("100000000"),
      //   operator: "",
      //   // For cBridge
      //   miniMinter: "",
      //   miniMinterCap: "",
      // },
      vMEUX: {
        underlying: "0x448BBbDB706cD0a6AB74fA3d1157e7A33Dd3A4a8",
        name: "dForce Vault vMEUX",
        symbol: "vMEUX",
        aggregator: "0x73366Fe0AA0Ded304479862808e02506FE556a98",
        borrowCap: ethers.utils.parseEther("100000000"),
        operator: "0xC9d1cbc45dd3e86E98067B7eb279C13F7B77C627",
        // For cBridge
        miniMinter: "0xB7e0B3e00fb13EcCf70907bC5B626f4f88f1fD85",
        miniMinterCap: ethers.utils.parseEther("100000000"),
      },
    },
    collaterals: {
      // viUSX: {
      //   underlying: "0xc171EBE1A2873F042F1dDdd9327D00527CA29882",
      //   name: "dForce Vault iUSX",
      //   symbol: "viUSX",
      //   supplyCap: ethers.utils.parseEther("100000000"),
      //   operator: "",
      // },
      viEUX: {
        underlying: "0x15962427A9795005c640A6BF7f99c2BA1531aD6d",
        name: "dForce Vault iEUX",
        symbol: "viEUX",
        supplyCap: ethers.utils.parseEther("100000000"),
        operator: "0xC9d1cbc45dd3e86E98067B7eb279C13F7B77C627",
      },
    },
  },
  kava: {
    USX: "0xDb0E1e86B01c4ad25241b1843E407Efc4D615248",
    FIXED_INTEREST_RATE_MODEL: "0x7DA545B2AC13bB89D430E0Ee91452F0479Fd49a5",
    GUARDIAN: "0x491C366614b971596cFf5570665DD9d24966de49",
    VMUSX_MINT_CAP: ethers.utils.parseEther("100000000"),
    vMSDs: {
      vMUSX: {
        underlying: "0xDb0E1e86B01c4ad25241b1843E407Efc4D615248", // USX
        name: "dForce Vault vMUSX",
        symbol: "vMUSX",
        price: ethers.utils.parseEther("1"),
        borrowCap: ethers.utils.parseEther("100000000"),
        operator: "0xcA09A0a386ac213703e7F70f0b468dde39f026BC",
        // For cBridge
        miniMinter: "0x14493720Bb820c1e9e431EAF00d6ADdD2dd8e471",
        miniMinterCap: ethers.utils.parseEther("100000000"),
      },
      // vMEUX: {
      //   underlying: "0x448BBbDB706cD0a6AB74fA3d1157e7A33Dd3A4a8",
      //   name: "dForce Vault vMEUX",
      //   symbol: "vMEUX",
      //   aggregator: "0x73366Fe0AA0Ded304479862808e02506FE556a98",
      //   borrowCap: ethers.utils.parseEther("100000000"),
      //   operator: "0xC9d1cbc45dd3e86E98067B7eb279C13F7B77C627",
      //   // For cBridge
      //   miniMinter: "0xB7e0B3e00fb13EcCf70907bC5B626f4f88f1fD85",
      //   miniMinterCap: ethers.utils.parseEther("100000000"),
      // },
    },
    collaterals: {
      viUSX: {
        underlying: "0x9787aF345E765a3fBf0F881c49f8A6830D94A514",
        name: "dForce Vault iUSX",
        symbol: "viUSX",
        supplyCap: ethers.utils.parseEther("100000000"),
        operator: "0xcA09A0a386ac213703e7F70f0b468dde39f026BC",
      },
      // viEUX: {
      //   underlying: "0x15962427A9795005c640A6BF7f99c2BA1531aD6d",
      //   name: "dForce Vault iEUX",
      //   symbol: "viEUX",
      //   supplyCap: ethers.utils.parseEther("100000000"),
      //   operator: "0xC9d1cbc45dd3e86E98067B7eb279C13F7B77C627",
      // },
    },
  },
  avalanche: {
    USX: "0x853ea32391AaA14c112C645FD20BA389aB25C5e0",
    FIXED_INTEREST_RATE_MODEL: "0xFd07eE5d6608Be3A7A39734d6674B3f342666756",
    GUARDIAN: "0x491C366614b971596cFf5570665DD9d24966de49",
    VMUSX_MINT_CAP: ethers.utils.parseEther("100000000"),
    vMSDs: {
      vMUSX: {
        underlying: "0x853ea32391AaA14c112C645FD20BA389aB25C5e0", // USX
        name: "dForce Vault vMUSX",
        symbol: "vMUSX",
        price: ethers.utils.parseEther("1"),
        borrowCap: ethers.utils.parseEther("100000000"),
        operator: "0x2610CC2f20F9F3c1B180b7e8836C8c222a540cc8",
        // For cBridge
        miniMinter: "0x2E3D3E621084F26C67d91D54Bc0993440329Dd1C",
        miniMinterCap: ethers.utils.parseEther("100000000"),
      },
      // vMEUX: {
      //   underlying: "0x448BBbDB706cD0a6AB74fA3d1157e7A33Dd3A4a8",
      //   name: "dForce Vault vMEUX",
      //   symbol: "vMEUX",
      //   aggregator: "0x73366Fe0AA0Ded304479862808e02506FE556a98",
      //   borrowCap: ethers.utils.parseEther("100000000"),
      //   operator: "0xC9d1cbc45dd3e86E98067B7eb279C13F7B77C627",
      //   // For cBridge
      //   miniMinter: "0xB7e0B3e00fb13EcCf70907bC5B626f4f88f1fD85",
      //   miniMinterCap: ethers.utils.parseEther("100000000"),
      // },
    },
    collaterals: {
      viUSX: {
        underlying: "0x73C01B355F2147E5FF315680E068354D6344Eb0b",
        name: "dForce Vault iUSX",
        symbol: "viUSX",
        supplyCap: ethers.utils.parseEther("100000000"),
        operator: "0x2610CC2f20F9F3c1B180b7e8836C8c222a540cc8",
      },
      // viEUX: {
      //   underlying: "0x15962427A9795005c640A6BF7f99c2BA1531aD6d",
      //   name: "dForce Vault iEUX",
      //   symbol: "viEUX",
      //   supplyCap: ethers.utils.parseEther("100000000"),
      //   operator: "0xC9d1cbc45dd3e86E98067B7eb279C13F7B77C627",
      // },
    },
  },
  ConfluxeSpace: {
    USX: "0x422a86f57b6b6F1e557d406331c25EEeD075E7aA",
    FIXED_INTEREST_RATE_MODEL: "0xBba57759378967398Bb6268A57676958Ae7Bd826",
    GUARDIAN: "0x491C366614b971596cFf5570665DD9d24966de49",
    VMUSX_MINT_CAP: ethers.utils.parseEther("100000000"),
    vMSDs: {
      vMUSX: {
        underlying: "0x422a86f57b6b6F1e557d406331c25EEeD075E7aA", // USX
        name: "dForce Vault vMUSX",
        symbol: "vMUSX",
        price: ethers.utils.parseEther("1"),
        borrowCap: ethers.utils.parseEther("100000000"),
        operator: "0x8d717271b1A0aE97fcdF7D0a21Fa3DE4334b1EFd", //PDLP Operator
        // For cBridge
        miniMinter: "0xB5b3da79789dE012Fd75108138b2315E5645715A",
        miniMinterCap: ethers.utils.parseEther("100000000"),
      },
      // vMEUX: {
      //   underlying: "0x448BBbDB706cD0a6AB74fA3d1157e7A33Dd3A4a8",
      //   name: "dForce Vault vMEUX",
      //   symbol: "vMEUX",
      //   aggregator: "0x73366Fe0AA0Ded304479862808e02506FE556a98",
      //   borrowCap: ethers.utils.parseEther("100000000"),
      //   operator: "0xC9d1cbc45dd3e86E98067B7eb279C13F7B77C627",
      //   // For cBridge
      //   miniMinter: "0xB7e0B3e00fb13EcCf70907bC5B626f4f88f1fD85",
      //   miniMinterCap: ethers.utils.parseEther("100000000"),
      // },
    },
    collaterals: {
      viUSX: {
        underlying: "0x6f87b39a2e36F205706921d81a6861B655db6358", // iUSX
        name: "dForce Vault iUSX",
        symbol: "viUSX",
        supplyCap: ethers.utils.parseEther("100000000"),
        operator: "0x8d717271b1A0aE97fcdF7D0a21Fa3DE4334b1EFd",
      },
      // viEUX: {
      //   underlying: "0x15962427A9795005c640A6BF7f99c2BA1531aD6d",
      //   name: "dForce Vault iEUX",
      //   symbol: "viEUX",
      //   supplyCap: ethers.utils.parseEther("100000000"),
      //   operator: "0xC9d1cbc45dd3e86E98067B7eb279C13F7B77C627",
      // },
    },
  },
};

async function deployOracle() {
  const info = deployInfo[network[task.chainId]];
  const POSTER = info.POSTER ? info.POSTER : task.signerAddr;
  const MAX_SWING = info.MAX_SWING
    ? info.MAX_SWING
    : ethers.utils.parseEther("0.1");

  task.contractsToDeploy = {
    priceOracle: {
      contract: "PriceOracleV2",
      useProxy: false,
      getArgs: () => [POSTER, MAX_SWING],
    },
    FVAggregatorModel: {
      contract: "FVAggregatorModel",
      path: "contracts/aggregatorModelV2/",
      useProxy: false,
      getArgs: () => [],
    },
    aggregatorProxy: {
      contract: "AggregatorProxy",
      path: "contracts/aggregatorModelV2/",
      useProxy: false,
      getArgs: () => [],
    },
  };

  await deployContracts(task);
}

async function deployPool() {
  const info = deployInfo[network[task.chainId]];
  const GUARDIAN = info.GUARDIAN ? info.GUARDIAN : task.signerAddr;

  task.contractsToDeploy = {
    flashVaultController: {
      contract: "ControllerFlashVault",
      path: "contracts/FlashVault/",
      useProxy: true,
      getArgs: () => [],
    },
  };

  await deployContracts(task);

  // No need to set config like reserveRatio, flashloanFeeRatio, protocolFeeRatio

  await sendTransaction(task, "flashVaultController", "_setPriceOracle", [
    task.deployments.priceOracle.address,
  ]);

  await sendTransaction(task, "flashVaultController", "_setCloseFactor", [
    ethers.utils.parseEther("0.5"),
  ]);

  await sendTransaction(task, "flashVaultController", "_setPauseGuardian", [
    GUARDIAN,
  ]);
}

async function deployvMSDs() {
  const info = deployInfo[network[task.chainId]];

  for (const [key, config] of Object.entries(info.vMSDs)) {
    await deployContract(
      task.contracts,
      task.deployments,
      task.signer,
      task.proxyAdmin,
      key,
      {
        contract: "vMSD",
        path: "contracts/FlashVault/",
        useProxy: true,
        getArgs: (deployments) => [
          config.underlying,
          config.name,
          config.symbol,
          deployments.flashVaultController.address,
          info.FIXED_INTEREST_RATE_MODEL,
          deployments.msdController.address,
        ],
      }
    );

    if (config.hasOwnProperty("price")) {
      await sendTransaction(task, "priceOracle", "setPrice", [
        task.contracts[key].address,
        config.price,
      ]);
    } else {
      await sendTransaction(task, "priceOracle", "_setAssetAggregator", [
        task.contracts[key].address,
        config.aggregator,
      ]);
    }
  }
}

async function deployCollaterals() {
  const info = deployInfo[network[task.chainId]];

  for (const [key, config] of Object.entries(info.collaterals)) {
    await deployContract(
      task.contracts,
      task.deployments,
      task.signer,
      task.proxyAdmin,
      key,
      {
        contract: "viToken",
        path: "contracts/FlashVault/",
        useProxy: true,
        getArgs: (deployments) => [
          config.underlying,
          config.name,
          config.symbol,
          deployments.flashVaultController.address,
          info.FIXED_INTEREST_RATE_MODEL,
        ],
      }
    );

    await sendTransaction(task, "priceOracle", "_setAggregatorProxy", [
      task.deployments.aggregatorProxy.address,
    ]);

    // Feed Pirce
    await sendTransaction(task, "priceOracle", "_setAssetAggregator", [
      task.deployments[key].address,
      task.deployments.FVAggregatorModel.address,
    ]);
  }
}

async function addToMarket() {
  const info = deployInfo[network[task.chainId]];
  const VMUSX_MINT_CAP = info.VMUSX_MINT_CAP;

  for (const [key, config] of Object.entries(
    deployInfo[network[task.chainId]].collaterals
  )) {
    await sendTransaction(task, "flashVaultController", "_addMarket", [
      task.deployments[key].address,
      ethers.utils.parseEther("1"), //collateralFactor
      ethers.utils.parseEther("1"), // borrowFactor
      config.supplyCap, // supplyCapacity
      0, // borrowCapacity
      ethers.utils.parseEther("1"), // distributionFactor
    ]);
  }

  for (const [key, config] of Object.entries(
    deployInfo[network[task.chainId]].vMSDs
  )) {
    await sendTransaction(task, "flashVaultController", "_addMarket", [
      task.deployments[key].address, // market
      0, //collateralFactor
      ethers.utils.parseEther("1"), // borrowFactor
      0, // supplyCapacity
      config.borrowCap, // borrowCapacity
      ethers.utils.parseEther("1"), // distributionFactor
    ]);
  }
}

async function addMinter() {
  const info = deployInfo[network[task.chainId]];
  const USX = info.USX;
  const MINI_MINTER = info.MINI_MINTER;
  const MINI_MINTER_CAP = info.MINI_MINTER_CAP;
  const VMUSX_MINT_CAP = info.VMUSX_MINT_CAP;

  for (const [key, config] of Object.entries(
    deployInfo[network[task.chainId]].vMSDs
  )) {
    if (
      (await task.contracts.msdController.owner()) ==
      task.contracts.timeLock.address
    ) {
      const transactions = [
        [
          "msdController",
          "_addMSD",
          [
            config.underlying,
            [task.deployments[key].address, config.miniMinter],
            [config.borrowCap, config.miniMinterCap],
          ],
        ],
      ];

      await printArgs(task, transactions);
    } else {
      await sendTransaction(task, "msdController", "_addMSD", [
        config.underlying,
        [task.deployments[key].address, config.miniMinter],
        [config.borrowCap, config.miniMinterCap],
      ]);
    }
  }
}

async function addOperatorToWhiteList() {
  for (const [key, config] of Object.entries(
    deployInfo[network[task.chainId]].collaterals
  )) {
    await sendTransaction(task, key, "_addToWhitelists", [config.operator]);
  }

  for (const [key, config] of Object.entries(
    deployInfo[network[task.chainId]].vMSDs
  )) {
    await sendTransaction(task, key, "_addToWhitelists", [config.operator]);
  }
}

async function deployFlashVaultLiqee() {
  const info = deployInfo[network[task.chainId]];
  const qUSX = info.qUSX;
  const FIXED_INTEREST_RATE_MODEL = info.FIXED_INTEREST_RATE_MODEL;
  const VMUSX_MINT_CAP = info.MINT_CAP;

  task.contractsToDeploy = {
    vqUSX: {
      contract: "viToken",
      path: "contracts/FlashVault/",
      useProxy: true,
      getArgs: (deployments) => [
        qUSX,
        "dForce Vault qUSX",
        "vqUSX",
        deployments.flashVaultController.address,
        FIXED_INTEREST_RATE_MODEL,
      ],
    },
  };
  await deployContracts(task);

  // vqUSX use the FVAggregatorModel
  await sendTransaction(task, "priceOracle", "_setAssetAggregator", [
    task.deployments.vqUSX.address,
    task.deployments.FVAggregatorModel.address,
  ]);

  // vqUSX
  await sendTransaction(task, "flashVaultController", "_addMarket", [
    task.deployments.vqUSX.address, // market
    ethers.utils.parseEther("1"), //collateralFactor
    ethers.utils.parseEther("1"), // borrowFactor
    VMUSX_MINT_CAP, // supplyCapacity
    0, // borrowCapacity
    ethers.utils.parseEther("1"), // distributionFactor
  ]);

  task.contractsToDeploy = {
    operatorLiqee: {
      contract: "L1Operator",
      path: "contracts/FlashVault/",
      useProxy: true,
      getArgs: (deployments) => [
        deployments.vqUSX.address,
        deployments.vMUSX.address,
      ],
    },
  };
  await deployContracts(task);

  await sendTransaction(task, "vMUSX", "_addToWhitelists", [
    task.deployments.operatorLiqee.address,
  ]);

  await sendTransaction(task, "vqUSX", "_addToWhitelists", [
    task.deployments.operatorLiqee.address,
  ]);

  await sendTransaction(task, "operatorLiqee", "_addToWhitelists", [
    task.signerAddr,
  ]);
}

async function deployFlashVaultOnL2() {
  const info = deployInfo[network[task.chainId]];
  const USX = info.USX;
  const iUSX = info.iUSX;
  const FIXED_INTEREST_RATE_MODEL = info.FIXED_INTEREST_RATE_MODEL;
  const GUARDIAN = info.GUARDIAN ? info.GUARDIAN : task.signerAddr;
  const POSTER = info.POSTER ? info.POSTER : task.signerAddr;
  const MAX_SWING = info.MAX_SWING
    ? info.MAX_SWING
    : ethers.utils.parseEther("0.1");

  task.contractsToDeploy = {
    flashVaultController: {
      contract: "ControllerFlashVault",
      path: "contracts/FlashVault/",
      useProxy: true,
      getArgs: () => [],
    },
    vUSX: {
      contract: "vToken",
      path: "contracts/FlashVault/",
      useProxy: true,
      getArgs: (deployments) => [
        USX,
        "dForce Vault USD",
        "vUSX",
        deployments.flashVaultController.address,
        FIXED_INTEREST_RATE_MODEL,
      ],
    },
    viUSX: {
      contract: "viToken",
      path: "contracts/FlashVault/",
      useProxy: true,
      getArgs: (deployments) => [
        iUSX,
        "dForce Vault iUSX",
        "viUSX",
        deployments.flashVaultController.address,
        FIXED_INTEREST_RATE_MODEL,
      ],
    },
    priceOracle: {
      contract: "PriceOracleV2",
      useProxy: false,
      getArgs: () => [POSTER, MAX_SWING],
    },
    aggregatorProxy: {
      contract: "AggregatorProxy",
      path: "contracts/aggregatorModelV2/",
      useProxy: false,
      getArgs: () => [],
    },
    FVAggregatorModel: {
      contract: "FVAggregatorModel",
      path: "contracts/aggregatorModelV2/",
      useProxy: false,
      getArgs: () => [],
    },
  };
  await deployContracts(task);

  await sendTransaction(task, "flashVaultController", "_setPriceOracle", [
    task.deployments.priceOracle.address,
  ]);

  await sendTransaction(task, "flashVaultController", "_setPauseGuardian", [
    GUARDIAN,
  ]);
}

async function feedPriceOnL2() {
  //  Set aggregator in the oracle.
  await sendTransaction(task, "priceOracle", "_setAggregatorProxy", [
    task.deployments.aggregatorProxy.address,
  ]);

  // viUSX use the FVAggregatorModel
  await sendTransaction(task, "priceOracle", "_setAssetAggregator", [
    task.deployments.viUSX.address,
    task.deployments.FVAggregatorModel.address,
  ]);

  // vUSX price is 1 USD
  await sendTransaction(task, "priceOracle", "setPrice", [
    task.deployments.vUSX.address,
    ethers.utils.parseEther("1"),
  ]);
}

async function addToMarketOnL2() {
  const info = deployInfo[network[task.chainId]];
  const vTOKEN_SUPPLY_CAP = info.vTOKEN_SUPPLY_CAP;
  const vTOKEN_BORROW_CAP = info.vTOKEN_BORROW_CAP;
  const viTOKEN_SUPPLY_CAP = info.viTOKEN_SUPPLY_CAP;

  // vUSX
  await sendTransaction(task, "flashVaultController", "_addMarket", [
    task.deployments.vUSX.address, // market
    0, //collateralFactor
    ethers.utils.parseEther("1"), // borrowFactor
    vTOKEN_SUPPLY_CAP, // supplyCapacity
    vTOKEN_BORROW_CAP, // borrowCapacity
    ethers.utils.parseEther("1"), // distributionFactor
  ]);

  // viUSX
  await sendTransaction(task, "flashVaultController", "_addMarket", [
    task.deployments.viUSX.address, // market
    ethers.utils.parseEther("1"), //collateralFactor
    ethers.utils.parseEther("1"), // borrowFactor
    viTOKEN_SUPPLY_CAP, // supplyCapacity
    0, // borrowCapacity
    ethers.utils.parseEther("1"), // distributionFactor
  ]);
}

async function addOpOperator() {
  const info = deployInfo[network[task.chainId]];

  // Go to PDLP repo to deploy the operator
  const OP_OPERATOR = "";

  await sendTransaction(task, "vUSX", "_addToWhitelists", [OP_OPERATOR]);

  await sendTransaction(task, "viUSX", "_addToWhitelists", [OP_OPERATOR]);
}

// // BSC
// run(task, deployFlashVaultLiqee);
// run(task, upgradeBSCOperator);

// // Arbitrum
// run(task, deployFlashVaultOnL2);
// run(task, feedPriceOnL2);
// run(task, addToMarketOnL2);
// run(task, deployOperatorOnArbi);

// Optimism
async function optimismFlashVault() {
  await run(task, deployFlashVaultOnL2);
  await run(task, feedPriceOnL2);
  await run(task, addToMarketOnL2);

  // Go to PDLP repo to deploy the opPperator
  await run(task, addOpOperator);
}

// optimismFlashVault();

// Polygon
async function deployFlashVault() {
  // deploy FlashVault then the operator
  await deployOracle();
  await deployPool();
  await deployvMSDs();
  await deployCollaterals();
  await addToMarket();

  // after deploy PDLP operator from its repo
  await addMinter();
  await addOperatorToWhiteList();
}

async function deployFlashVaultEUX() {
  // printTenderlyInsteadOfSend(
  //   TENDERLY_FORK_ID,
  //   "0xDE6D6f23AabBdC9469C8907eCE7c379F98e4Cb75" // from
  // );

  await deployvMSDs();
  await deployCollaterals();
  await addToMarket();

  // after deploy PDLP operator from its repo
  await addMinter();
  await addOperatorToWhiteList();
}

run(task, deployFlashVault);
// run(task, deployFlashVaultEUX);
