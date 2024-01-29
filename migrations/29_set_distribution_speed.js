import {
  run,
  sendTransaction,
  printTransactionInsteadOfSend,
} from "./helpers/utils";
import { printArgs } from "./helpers/timelock";

let task = { name: "RewardDistribution" };

const network = {
  1: "mainnet",
  56: "bsc",
  42161: "arbitrum",
  42: "kovan",
  10: "optimistic",
  137: "polygon",
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
      iETH: 600,
      iUSDT: 2450,
      iDAI: 1680,
      iUSDC: 2450,
    },
    borrow: {
      // iETH: 0,
      iUSDT: 1050,
      iDAI: 720,
      iUSDC: 1050,
    },
  },
  bsc: {
    supply: {
      // iETH: 0,
      // iBNB: 0,
      iUSDT: 2100,
      iDAI: 700,
      iUSDC: 1680,
      iBUSD: 2520,
      // iUSX: 7000,
    },
    borrow: {
      iUSDT: 900,
      iDAI: 300,
      iUSDC: 720,
      iBUSD: 1080,
      // iUSX: 3000,
      // iBNB: 0,
    },
  },
  arbitrum: {
    supply: {
      // iWBTC: 0,
      // iETH: 0,
      iUSDT: 3500,
      iUSDC: 4200,
      iDAI: 2100,
      iUSX: 4200,
    },
    borrow: {
      iUSDT: 1500,
      iUSDC: 1800,
      iDAI: 900,
      iUSX: 1800,
    },
  },
  optimistic: {
    supply: {
      iUSDT: 2100,
      iUSDC: 1575,
      iDAI: 1050,
      iUSX: 5775,
    },
    borrow: {
      iUSDT: 900,
      iUSDC: 675,
      iDAI: 450,
      iUSX: 2475,
    },
  },
  polygon: {
    supply: {
      iUSDT: 2100,
      iUSDC: 1575,
      iDAI: 840,
      iUSX: 5985,
    },
    borrow: {
      iUSDT: 900,
      iUSDC: 675,
      iDAI: 360,
      iUSX: 2565,
    },
  },
};

const info = {
  mainnet: {
    iWBTC: "0x5812fCF91adc502a765E5707eBB3F36a07f63c02",
    iETH: "0x5ACD75f21659a59fFaB9AEBAf350351a8bfaAbc0",
    iUSDT: "0x1180c114f7fAdCB6957670432a3Cf8Ef08Ab5354",
    iDAI: "0x298f243aD592b6027d4717fBe9DeCda668E3c3A8",
    iUSDC: "0x2f956b2f801c6dad74E87E7f45c94f6283BF0f45",
    iUSX: "0x1AdC34Af68e970a93062b67344269fD341979eb0",
    iEUX: "0x44c324970e5CbC5D4C3F3B7604CbC6640C2dcFbF",
    iMUSX: "0xd1254d280e7504836e1B0E36535eBFf248483cEE",
    iMEUX: "0x591595Bfae3f5d51A820ECd20A1e3FBb6638f34B",
    iDF: "0xb3dc7425e63E1855Eb41107134D471DD34d7b239",
  },
  bsc: {
    iBTCB: "0x0b66A250Dadf3237DdB38d485082a7BfE400356e",
    iETH: "0x390bf37355e9dF6Ea2e16eEd5686886Da6F47669",
    iUSDT: "0x0BF8C72d618B5d46b055165e21d661400008fa0F",
    iDAI: "0xAD5Ec11426970c32dA48f58c92b1039bC50e5492",
    iUSDC: "0xAF9c10b341f55465E8785F0F81DBB52a9Bfe005d",
    iBUSD: "0x5511b64Ae77452C7130670C79298DEC978204a47",
    iUSX: "0x7B933e1c1F44bE9Fb111d87501bAADA7C8518aBe",
    iEUX: "0x983A727Aa3491AB251780A13acb5e876D3f2B1d8",
    iMUSX: "0x36f4C36D1F6e8418Ecb2402F896B2A8fEDdE0991",
    iMEUX: "0xb22eF996C0A2D262a19db2a66A256067f51511Eb",
    iDF: "0xeC3FD540A2dEE6F479bE539D64da593a59e12D08",
    iBNB: "0xd57E1425837567F74A35d07669B23Bfb67aA4A93",
  },
  arbitrum: {
    iWBTC: "0xD3204E4189BEcD9cD957046A8e4A643437eE0aCC",
    iETH: "0xEe338313f022caee84034253174FA562495dcC15",
    iUSDT: "0xf52f079Af080C9FB5AFCA57DDE0f8B83d49692a9",
    iUSDC: "0x8dc3312c68125a94916d62B97bb5D925f84d4aE0",
    iDAI: "0xf6995955e4B0E5b287693c221f456951D612b628",
    iUNI: "0x46Eca1482fffb61934C4abCA62AbEB0b12FEb17A",
    iDF: "0xaEa8e2e7C97C5B7Cd545d3b152F669bAE29C4a63",
    iLINK: "0x013ee4934ecbFA5723933c4B08EA5E47449802C8",
    iUSX: "0x0385F851060c09A552F1A28Ea3f612660256cBAA",
    iEUX: "0x5675546Eb94c2c256e6d7c3F7DcAB59bEa3B0B8B",
    iMUSX: "0xe8c85B60Cb3bA32369c699015621813fb2fEA56c",
    iMEUX: "0x5BE49B2e04aC55A17c72aC37E3a85D9602322021",
  },
  optimistic: {
    iETH: "0xA7A084538DE04d808f20C785762934Dd5dA7b3B4",
    iUSDC: "0xB344795f0e7cf65a55cB0DDe1E866D46041A2cc2",
    iUSX: "0x7e7e1d8757b241Aa6791c089314604027544Ce43",
    iUSDT: "0x5d05c14D71909F4Fe03E13d486CCA2011148FC44",
    isUSD: "0x1f144cD63d7007945292EBCDE14a6Df8628e2Ed7",
    iCRV: "0xED3c20d047D2c57C3C6DD862C9FDd1b353Aff36f",
    iLINK: "0xDd40BBa0faD6810A7A09e8Ccca9bCe1E48B28Ece",
    iDAI: "0x5bedE655e2386AbC49E2Cc8303Da6036bF78564c",
    OP: "0x7702dC73e8f8D9aE95CF50933aDbEE68e9F1D725",
    iAAVE: "0xD65a18dAE68C846297F3038C93deea0B181288d5",
    iWBTC: "0x24d30216c07Df791750081c8D77C83cc8b06eB27",
    iDF: "0x6832364e9538Db15655FA84A497f2927F74A6cE6",
    iMUSX: "0x94a14Ba6E59f4BE36a77041Ef5590Fe24445876A",
  },
  polygon: {
    iMATIC: "0x6A3fE5342a4Bd09efcd44AC5B9387475A0678c74",
    iUSDC: "0x5268b3c4afb0860D365a093C184985FCFcb65234",
    iWBTC: "0x94a14Ba6E59f4BE36a77041Ef5590Fe24445876A",
    iUSX: "0xc171EBE1A2873F042F1dDdd9327D00527CA29882",
    iDAI: "0xec85F77104Ffa35a5411750d70eDFf8f1496d95b",
    iAAVE: "0x38D0c498698A35fc52a6EB943E47e4A5471Cd6f9",
    iDF: "0xcB5D9b6A9BA8eA6FA82660fAA9cC130586F939B2",
    iWETH: "0x0c92617dF0753Af1CaB2d9Cc6A56173970d81740",
    iEUX: "0x15962427A9795005c640A6BF7f99c2BA1531aD6d",
    iCRV: "0x7D86eE431fbAf60E86b5D3133233E478aF691B68",
    iUSDT: "0xb3ab7148cCCAf66686AD6C1bE24D83e58E6a504e",
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
    (await task.contracts.rewardDistributor.owner()) ==
    task.contracts.timeLock.address
  ) {
    const transactions = [
      [
        "rewardDistributor",
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
    await sendTransaction(task, "rewardDistributor", "_setDistributionSpeeds", [
      borrowContracts,
      borrowContractSpeeds,
      supplyContracts,
      supplyContractSpeeds,
    ]);
  }
}

run(task, setDistributionSpeeds);
