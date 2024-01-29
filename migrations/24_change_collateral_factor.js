import { run } from "./helpers/utils";
import { printArgs } from "./helpers/timelock";

let task = { name: "Lending" };

const newCF = ethers.utils.parseEther("0.85");

async function changeCFMainnet() {
  const iUSDT = "0x1180c114f7fAdCB6957670432a3Cf8Ef08Ab5354";
  const iUSDC = "0x2f956b2f801c6dad74E87E7f45c94f6283BF0f45";
  const iDAI = "0x298f243aD592b6027d4717fBe9DeCda668E3c3A8";
  const iBUSD = "0x24677e213DeC0Ea53a430404cF4A11a6dc889FCe";
  const iUSX = "0x1AdC34Af68e970a93062b67344269fD341979eb0";

  const transactions = [
    ["controller", "_setCollateralFactor", [iUSDT, newCF]],
    ["controller", "_setCollateralFactor", [iUSDC, newCF]],
    ["controller", "_setCollateralFactor", [iDAI, newCF]],
    ["controller", "_setCollateralFactor", [iBUSD, newCF]],
    ["controller", "_setCollateralFactor", [iUSX, newCF]],
  ];

  await printArgs(task, transactions);
}

async function changeCFBSC() {
  const iUSDT = "0x0BF8C72d618B5d46b055165e21d661400008fa0F";
  const iUSDC = "0xAF9c10b341f55465E8785F0F81DBB52a9Bfe005d";
  const iDAI = "0xAD5Ec11426970c32dA48f58c92b1039bC50e5492";
  const iBUSD = "0x5511b64Ae77452C7130670C79298DEC978204a47";
  const iUSX = "0x7B933e1c1F44bE9Fb111d87501bAADA7C8518aBe";

  const transactions = [
    ["controller", "_setCollateralFactor", [iUSDT, newCF]],
    ["controller", "_setCollateralFactor", [iUSDC, newCF]],
    ["controller", "_setCollateralFactor", [iDAI, newCF]],
    ["controller", "_setCollateralFactor", [iBUSD, newCF]],
    ["controller", "_setCollateralFactor", [iUSX, newCF]],
  ];

  await printArgs(task, transactions);
}

async function changeCFArbitrum() {
  const iUSDT = "0xf52f079Af080C9FB5AFCA57DDE0f8B83d49692a9";
  const iUSDC = "0x8dc3312c68125a94916d62B97bb5D925f84d4aE0";
  const iDAI = "0xf6995955e4B0E5b287693c221f456951D612b628";
  const iUSX = "0x0385F851060c09A552F1A28Ea3f612660256cBAA";

  const transactions = [
    ["controller", "_setCollateralFactor", [iUSDT, newCF]],
    ["controller", "_setCollateralFactor", [iUSDC, newCF]],
    ["controller", "_setCollateralFactor", [iDAI, newCF]],
    ["controller", "_setCollateralFactor", [iUSX, newCF]],
  ];

  await printArgs(task, transactions);
}

async function changeCFOptimism() {
  const iUSDT = "0x5d05c14D71909F4Fe03E13d486CCA2011148FC44";
  const iUSDC = "0xB344795f0e7cf65a55cB0DDe1E866D46041A2cc2";
  const iDAI = "0x5bedE655e2386AbC49E2Cc8303Da6036bF78564c";
  const iUSX = "0x7e7e1d8757b241Aa6791c089314604027544Ce43";

  const transactions = [
    ["controller", "_setCollateralFactor", [iUSDT, newCF]],
    ["controller", "_setCollateralFactor", [iUSDC, newCF]],
    ["controller", "_setCollateralFactor", [iDAI, newCF]],
    ["controller", "_setCollateralFactor", [iUSX, newCF]],
  ];

  await printArgs(task, transactions);
}

async function changeCF() {
  switch (task.chainId) {
    case 1:
      await changeCFMainnet();
      break;
    case 56:
      await changeCFBSC();
      break;
    case 42161:
      await changeCFArbitrum();
      break;
    case 10:
      await changeCFOptimism();
      break;
    default:
      console.error("ChainId not supported");
  }
}

run(task, changeCF);
