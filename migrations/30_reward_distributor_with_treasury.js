import {
  run,
  sendTransaction,
  printTenderlyInsteadOfSend,
  printTransactionInsteadOfSend,
} from "./helpers/utils";
import { printArgs } from "./helpers/timelock";
import { deployContracts } from "./helpers/deploy";
import { attachContractAtAdddress } from "./helpers/contract";

let task = { name: "RewardDistribution" };

const network = {
  1: "mainnet",
  56: "bsc",
  42161: "arbitrum",
  42: "kovan",
  10: "optimistic",
  137: "polygon",
};

const deployInfo = {
  mainnet: {
    DF: "0x431ad2ff6a9C365805eBaD47Ee021148d6f7DBe0",
    treasury: "0x1D22AFC7dc4Bf336532dd6248d453C647CecA1B3",
    rewardDistributors: {
      generalPool: "0x8fAeF85e436a8dd85D8E636Ea22E3b90f1819564",
      stockPool: "0xcf4ad4da361671dc84be51a6c1131eaf84926e00",
      vaultCurveUSX3CRV: "0x5ebc758AC96316Fb3c80AbFF549962f305A54a30",
    },
  },
  bsc: {
    DF: "0x4A9A2b2b04549C3927dd2c9668A5eF3fCA473623",
    treasury: "0x959715da68DC2D1329F4bb34e13Da03FE10c374b",
    rewardDistributors: {
      generalPool: "0x6fC21a5a767212E8d366B3325bAc2511bDeF0Ef4",
      stockPool: "0xa28F287630184d3b5EeE31a5FE8dB0A63c4A6e2f",
    },
  },
  arbitrum: {
    DF: "0xaE6aab43C4f3E0cea4Ab83752C278f8dEbabA689",
    treasury: "0xc0Dc7C5057141C9065bd9bedf79fd4E9EA69a739",
    rewardDistributors: {
      generalPool: "0xF45e2ae152384D50d4e9b08b8A1f65F0d96786C3",
      vaultCurveUSX2CRV: "0x00b006A1Db650f41aaA367F353572c869b373592",
    },
  },
  optimistic: {
    DF: "0xaE6aab43C4f3E0cea4Ab83752C278f8dEbabA689",
    treasury: "",
    rewardDistributors: {
      generalPool: "0x870ac6a76A30742800609F205c741E86Db9b71a2",
    },
  },
  polygon: {
    DF: "0x08C15FA26E519A78a666D19CE5C646D55047e0a3",
    treasury: "",
    rewardDistributors: {
      generalPool: "0x47C19A2ab52DA26551A22e2b2aEED5d19eF4022F",
    },
  },
};

async function deployRewardDistributorImpl() {
  task.contractsToDeploy = {
    RewardDistributorV3Impl: {
      contract: "RewardDistributorV3",
      useProxy: false,
      getArgs: () => [],
    },
  };

  await deployContracts(task);
}

async function upgradeAndSetTreasury(
  rewardDistributors,
  implAddress,
  treasuryAddress
) {
  let timeLockTransactions = [];
  let transactions = [];

  for (const [key, rewardDistributor] of Object.entries(rewardDistributors)) {
    task.contracts[key] = await attachContractAtAdddress(
      task.signer,
      rewardDistributor,
      "RewardDistributorV3"
    );

    const proxyAdminOwner = await task.contracts.proxyAdmin.owner();
    if (proxyAdminOwner == task.deployments.timeLock.address) {
      timeLockTransactions.push([
        "proxyAdmin",
        "upgrade",
        [rewardDistributor, implAddress],
      ]);
    } else {
      transactions.push(["proxyAdmin",
        "upgrade",
        [rewardDistributor, implAddress]]);
    }

    const owner = await task.contracts[key].owner();
    if (owner == task.deployments.timeLock.address) {
      timeLockTransactions.push([key, "_setTreasury", [treasuryAddress]]);
    } else {
      transactions.push([key, "_setTreasury", [treasuryAddress]]);
    }
  }

  if (timeLockTransactions.length > 0) {
    await printArgs(task, timeLockTransactions);
  }

  for (const transaction of transactions) {
    await sendTransaction(task, ...transaction);
  }
}

async function addRecipientAndTransferFunds(
  rewardDistributors,
  DFAddress,
  treasuryAddress
) {
  const DF = await attachContractAtAdddress(
    task.signer,
    DFAddress,
    "Token",
    "contracts/mock/"
  );

  task.contracts.treasury = await attachContractAtAdddress(
    task.signer,
    treasuryAddress,
    "MockTreasury",
    "contracts/mock"
  );

  for (const [key, rewardDistributor] of Object.entries(rewardDistributors)) {
    await sendTransaction(task, "treasury", "addRecipient", [
      rewardDistributor,
    ]);

    const balance = await DF.balanceOf(rewardDistributor);

    if (balance.gt(0)) {
      await sendTransaction(task, "treasury", "rescueStakingPoolTokens", [
        rewardDistributor,
        DFAddress,
        balance,
        treasuryAddress,
      ]);
    }
  }
}

async function main() {
  const info = deployInfo[network[task.chainId]];

  printTransactionInsteadOfSend();
  // printTenderlyInsteadOfSend(
  //   "fe0e8fbf-ad00-488e-bc45-fe570058099d",
  //   "0xDE6D6f23AabBdC9469C8907eCE7c379F98e4Cb75"
  // );

  await deployRewardDistributorImpl();

  await upgradeAndSetTreasury(
    info.rewardDistributors,
    task.contracts.RewardDistributorV3Impl.address,
    info.treasury
  );

  await addRecipientAndTransferFunds(
    info.rewardDistributors,
    info.DF,
    info.treasury
  );
}

run(task, main);
