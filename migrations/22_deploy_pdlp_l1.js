import { run, sendTransaction } from "./helpers/utils";
import { deployContracts } from "./helpers/deploy";
import { printArgs } from "./helpers/timelock";

let task = { name: "PDLP-L1" };

const network = {
  1: "mainnet",
  4: "rinkeby",
  42: "kovan",
};

let deployInfo = {
  mainnet: {
    USX: "0x0a5E677a6A24b2F1A2Bf4F3bFfC443231d2fDEc8",
    MSD_CONTROLLER: "0x45677a101D70E9910C418D9426bC6c5874CE2Fd7",
    L1_GATEWAY: "0x870ac6a76A30742800609F205c741E86Db9b71a2",
    L2_OPERATOR: "0x1D2eB423bC723DA7f927CA21B56A4C22aF6C72B4",
    L1_CBRIDGE: "0x5427FEFA711Eff984124bFBB1AB6fbf5E3DA1820",
    MINT_CAP: ethers.utils.parseEther("100000000"),
  },
  rinkeby: {
    USX: "0x2D76117C2C85c2E9C9FBF08199C9Be59af887526",
    MSD_CONTROLLER: "0x5161E46cd371e6CAe38ebD903DA03b5D559c7981",
    L1_GATEWAY: "0x9f94c5136A80B994AD53acfeF5e3F27609D221a8",
    L2_OPERATOR: "0x517237123bd7aFe8FC0e8a3a7F03a59511A910cF",
    L1_CBRIDGE: "0x4AC85451c974cF297e4Cf754036Dcc01182e1694",
    MINT_CAP: ethers.utils.parseEther("100000000"),
  },
  kovan: {
    USX: "0xF76eAd4da04BbeB97d29F83e2Ec3a621d0FB3c6e",
    MSD_CONTROLLER: "0xF25beAE3d7cc31D666FeCcfF4a1304c9635A6FE4",
    // Kovan does not have arbitrum yet
    L1_GATEWAY: "0x9f94c5136A80B994AD53acfeF5e3F27609D221a8",
    L2_OPERATOR: "0x517237123bd7aFe8FC0e8a3a7F03a59511A910cF",
    L1_CBRIDGE: "0x2180323728a70d43779c653555A72B0e3E467C4C",
    MINT_CAP: ethers.utils.parseEther("300000000"),
  },
};

async function deploy() {
  const info = deployInfo[network[task.chainId]];
  const USX = info.USX;
  const MSD_CONTROLLER = info.MSD_CONTROLLER;
  const L1_GATEWAY = info.L1_GATEWAY;
  const L2_OPERATOR = info.L2_OPERATOR;
  const L1_CBRIDGE = info.L1_CBRIDGE;

  task.contractsToDeploy = {
    pdlpMiniMinter: {
      contract: "MiniMinter",
      path: "contracts/msd/",
      useProxy: true,
      getArgs: () => [USX, MSD_CONTROLLER],
    },
    l1BridgeOperator: {
      contract: "L1BridgeOperator",
      path: "contracts/operator/",
      useProxy: true,
      getArgs: (deployments) => [
        USX,
        deployments.pdlpMiniMinter.address,
        L1_GATEWAY,
        L2_OPERATOR,
        L1_CBRIDGE,
      ],
    },
  };

  await deployContracts(task);
}

async function setOwner() {
  await sendTransaction(task, "pdlpMiniMinter", "_setPendingOwner", [
    task.deployments.l1BridgeOperator.address,
  ]);

  await sendTransaction(task, "l1BridgeOperator", "acceptOwner", []);

  await sendTransaction(task, "l1BridgeOperator", "_addToWhitelists", [
    task.signerAddr,
  ]);
}

async function addUSXMinter() {
  const info = deployInfo[network[task.chainId]];
  const USX = info.USX;
  const MINT_CAP = info.MINT_CAP;

  const transactions = [
    [
      "msdController",
      "_addMinters",
      [USX, [task.deployments.pdlpMiniMinter.address], [MINT_CAP]],
    ],
  ];

  // await sendTransaction(task, ...transactions[0]);
  await printArgs(task, transactions);
}

async function depositToL2() {
  const amount = ethers.utils.parseEther("100000000");
  const maxGas = 1000000;
  const gasPriceBid = ethers.utils.parseUnits("10", "gwei");
  const data = "0x";

  await sendTransaction(task, "l1BridgeOperator", "depositToBridge", [
    amount,
    maxGas,
    gasPriceBid,
    data,
  ]);
}

async function addToWhitelists() {
  await sendTransaction(task, "l1BridgeOperator", "_addToWhitelists", [
    "0x18c30D9569fEb3ea3644573b013D329dD9fd01Af",
  ]);

  await sendTransaction(task, "l1BridgeOperator", "_addToWhitelists", [
    "0xcC27B0206645aDbE5b5C8d212c2a98574090B68F",
  ]);
}

run(task, deploy);
run(task, setOwner);
run(task, addUSXMinter);
run(task, depositToL2);
run(task, addToWhitelists);
