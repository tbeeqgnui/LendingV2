import {
  run,
  sendTransaction,
  printTransactionInsteadOfSend,
} from "./helpers/utils";
import { printArgs } from "./helpers/timelock";

let task = { name: "VaultsPool" };

const network = {
  1: "mainnet",
  56: "bsc",
  42161: "arbitrum",
  42: "kovan",
  10: "optimistic",
  137: "polygon",
};

const rewardDistributor = {
  1: "controller_USX/3CRV_RewardDistributor",
  56: "",
  42161: "controller_USX/2CRV_RewardDistributor",
  42: "",
  10: "",
  137: "",
};

const blockTime = {
  mainnet: 13,
  bsc: 3,
  arbitrum: 13,
  kovan: 4,
  optimistic: 13,
  polygon: 2.3,
};

const rewards = {
  mainnet: {
    supply: {
      USX_CRV3: 1700,
    },
    borrow: {
    },
  },
  bsc: {
    supply: {
    },
    borrow: {
    },
  },
  arbitrum: {
    supply: {
      USX_2CRV: 3000,
    },
    borrow: {
    },
  },
  optimistic: {
    supply: {
    },
    borrow: {
    },
  },
  polygon: {
    supply: {
    },
    borrow: {
    },
  },
};

const info = {
  mainnet: {
    USX_CRV3: "0xd8d07A8ab4F6a1cC4cF86b3cB11b78A7C1e701ad",
    vMUSX: "0x53BF3c82f62B152800E0152DB743451849F1aFF9",
  },
  bsc: {
  },
  arbitrum: {
    USX_2CRV: "0x3EA2c9daa2aB26dbc0852ea653f99110c335f10a",
    vMUSX: "0x8A49dbE58CE2D047D3453a3ee4f0F245b7195f67",
  },
  optimistic: {
  },
  polygon: {
  },
};

function calcRewardPerBlock(rewardPerDay) {
  const blocksPerDay = Math.floor(
    (24 * 60 * 60) / blockTime[network[task.chainId]]
  );
  return ethers.utils
    .parseEther(rewardPerDay.toString())
    .add(blocksPerDay - 1)
    .div(blocksPerDay);
}

async function setDistributionSpeeds() {
  const addresses = info[network[task.chainId]];
  const reward = rewards[network[task.chainId]];
  const rewardDistributorKey = rewardDistributor[task.chainId];

  const borrowContracts = Object.keys(reward.borrow).map(
    (key) => addresses[key]
  );

  const borrowContractSpeeds = Object.values(reward.borrow).map((value) =>
    calcRewardPerBlock(value)
  );

  //console.log(borrowContractSpeeds.map((value) => value.toString()));

  const supplyContracts = Object.keys(reward.supply).map(
    (key) => addresses[key]
  );

  const supplyContractSpeeds = Object.values(reward.supply).map((value) =>
    calcRewardPerBlock(value)
  );

  //console.log(supplyContractSpeeds.map((value) => value.toString()));

  if (
    (await task.contracts[rewardDistributorKey].owner()) ==
    task.contracts.timeLock.address
  ) {
    const transactions = [
      [
        rewardDistributorKey,
        "_setDistributionSpeeds",
        [
          borrowContracts,
          borrowContractSpeeds,
          supplyContracts,
          supplyContractSpeeds,
        ],
      ],
    ];

    await printArgs(task, transactions);
  } else {
    printTransactionInsteadOfSend();
    await sendTransaction(task, rewardDistributorKey, "_setDistributionSpeeds", [
      borrowContracts,
      borrowContractSpeeds,
      supplyContracts,
      supplyContractSpeeds,
    ]);
  }
}

run(task, setDistributionSpeeds);
