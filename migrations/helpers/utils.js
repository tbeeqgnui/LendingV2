import { init, finalize } from "./context";

const SEND = 0;
const PRINT = 1;
const PRINT_TENDERLY = 2;

let sendOption = 0;

let tenderlyID, tenderlyFrom;

export function getProvider() {
  let provider;
  if (typeof remix == "object") {
    provider = new ethers.providers.Web3Provider(web3.currentProvider);
  } else {
    provider = ethers.provider;
  }

  return provider;
}

export async function loadJSON(file) {
  let json;

  try {
    if (typeof remix == "object") {
      json = await remix.call("fileManager", "getFile", file);
    } else {
      json = require("fs").readFileSync(file);
    }
  } catch (e) {
    console.log(`${file} open failed`);
    json = "{}";
  }

  return JSON.parse(json);
}

export async function saveJSON(file, json) {
  try {
    if (typeof remix == "object") {
      await remix.call(
        "fileManager",
        "writeFile",
        file,
        JSON.stringify(json, null, 2)
      );
    } else {
      const fs = require("fs");
      if (!fs.existsSync(file)) {
        const path = require("path");
        fs.mkdirSync(path.dirname(file), { recursive: true });
      }
      fs.writeFileSync(file, JSON.stringify(json, null, 2));
    }

    console.log(`${file} saved`);
  } catch (e) {
    console.log(`Save ${file} failed`, e);
  }
}

export async function getNextDeployAddress(signer) {
  const from = await signer.getAddress();
  const nonce = (await signer.getTransactionCount()) + 1;
  // console.log('Deployer next nonce is: ', nonce)
  const addressOfNextDeployedContract = ethers.utils.getContractAddress({
    from,
    nonce,
  });
  // console.log('Next deploy contract address is: ', addressOfNextDeployedContract)

  return addressOfNextDeployedContract;
}

export async function run(task, func) {
  try {
    await init(task);
    await func(task);
    await finalize(task);
    console.log(`Task ${task.name} Finished`);
  } catch (error) {
    console.error(error);
    finalize(task);
  }
}

export async function sendTransaction(task, target, method, args) {
  console.log(`Going to call ${target}.${method} with args: ${args}`);

  if (sendOption === SEND) {
    const tx = await task.contracts[target][method](...args);
    // await tx.wait(3);
  } else {
    const data = await task.contracts[target].populateTransaction[method](
      ...args
    );

    if (sendOption === PRINT) {
      console.log(`Transaction data:`, data);
    } else {
      printTenderly(data, tenderlyID, tenderlyFrom, task.chainId);
    }
  }
}

export function sendTransactionInsteadOfPrint() {
  sendOption = SEND;
}

export function printTransactionInsteadOfSend() {
  sendOption = PRINT;
}

export function printTenderlyInsteadOfSend(id, from) {
  sendOption = PRINT_TENDERLY;

  tenderlyID = id;
  tenderlyFrom = from;
}

function printTenderly(data, id, from, chainId) {
  const url =
    "\nhttps://dashboard.tenderly.co/SnowJi/project/fork/" +
    id +
    "/simulation/new?parentId=&from=" +
    from +
    "&gas=8000000&gasPrice=0&value=0&contractAddress=" +
    data.to +
    "&rawFunctionInput=" +
    data.data +
    "&network=" +
    chainId +
    "\n";

  console.log(`Tenderly URL: ${url}`);
}

export async function sendTransaction2(contract, target, method, args) {
  console.log(`Going to call ${target}.${method} with args: ${args}`);
  await contract[method](...args);
}
