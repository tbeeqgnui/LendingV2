import { run } from "./helpers/utils";
import { printArgs } from "./helpers/timelock";

let task = { name: "Lending" };

async function pauseMainnet() {
  const USX = "0x0a5E677a6A24b2F1A2Bf4F3bFfC443231d2fDEc8";
  const iMUSX = "0xd1254d280e7504836e1B0E36535eBFf248483cEE";
  const qMUSX = "0x4c3F88A792325aD51d8c446e1815DA10dA3D184c";

  const EUX = "0xb986F3a2d91d3704Dc974A24FB735dCc5E3C1E70";
  const iMEUX = "0x591595Bfae3f5d51A820ECd20A1e3FBb6638f34B";

  const XBTC = "0x527Ec46Ac094B399265d1D71Eff7b31700aA655D";
  const iMXBTC = "0xfa2e831c674B61475C175B2206e81A5938B298Dd";
  const iXBTC = "0x4013e6754634ca99aF31b5717Fa803714fA07B35";

  const XETH = "0x8d2Cb35893C01fa8B564c84Bd540c5109d9D278e";
  const iMXETH = "0x028DB7A9d133301bD49f27b5E41F83F56aB0FaA6";
  const iXETH = "0x237C69E082A94d37EBdc92a84b58455872e425d6";

  const XTSLA = "0x8dc6987F7D8E5aE9c39F767A324C5e46C1f731eB";
  const iMXTSLA = "0xa4C13398DAdB3a0A7305647b406ACdCD0689FCC5";

  const XAAPL = "0xc4Ba45BeE9004408403b558a26099134282F2185";
  const iMXAAPL = "0x3481E1a5A8014F9C7E03322e4d4532D8ec723409";

  const XAMZN = "0x966E726853Ca97449F458A3B012318a08B508202";
  const iMXAMZN = "0xaab2BAb88ceeDCF6788F45885155B278faD09110";

  const XCOIN = "0x32F9063bC2A2A57bCBe26ef662Dc867d5e6446d1";
  const iMXCOIN = "0xb0ffBD1E81B60C4e8a8E19cEF3A6A92fe18Be86D";

  const transactions1 = [
    // ["msdController", "_setMintCaps", [USX, [iMUSX, qMUSX], [0, 0]]],
    // ["msdController", "_setMintCaps", [EUX, [iMEUX], [0]]],
    ["msdController", "_setMintCaps", [XBTC, [iMXBTC], [0]]],
    ["msdController", "_setMintCaps", [XETH, [iMXETH], [0]]],
    ["msdController", "_setMintCaps", [XTSLA, [iMXTSLA], [0]]],
    ["msdController", "_setMintCaps", [XAAPL, [iMXAAPL], [0]]],
    ["msdController", "_setMintCaps", [XAMZN, [iMXAMZN], [0]]],
    ["msdController", "_setMintCaps", [XCOIN, [iMXCOIN], [0]]],
  ];

  const transactions2 = [
    // ["controller", "_setBorrowCapacity", [iMUSX, 0]],
    // ["controller", "_setBorrowCapacity", [iMEUX, 0]],
    ["controller", "_setBorrowCapacity", [iMXBTC, 0]],
    ["controller", "_setBorrowCapacity", [iMXETH, 0]],
    ["controller", "_setBorrowCapacity", [iXBTC, 0]],
    ["controller", "_setBorrowCapacity", [iXETH, 0]],
    ["controller", "_setSupplyCapacity", [iXBTC, 0]],
    ["controller", "_setSupplyCapacity", [iXETH, 0]],
    ["controllerStock", "_setBorrowCapacity", [iMXTSLA, 0]],
    ["controllerStock", "_setBorrowCapacity", [iMXAAPL, 0]],
    ["controllerStock", "_setBorrowCapacity", [iMXAMZN, 0]],
    ["controllerStock", "_setBorrowCapacity", [iMXCOIN, 0]],
  ];

  await printArgs(task, transactions1);
  await printArgs(task, transactions2);
}

async function pauseBSC() {
  const USX = "0xB5102CeE1528Ce2C760893034A4603663495fD72";
  const iMUSX = "0x36f4C36D1F6e8418Ecb2402F896B2A8fEDdE0991";
  // set to 0 alredy
  //   const qMUSX = "0xee0D3450b577743Eee2793C0Ec6d59361eB9a454";

  const EUX = "0x367c17D19fCd0f7746764455497D63c8e8b2BbA3";
  const iMEUX = "0xb22eF996C0A2D262a19db2a66A256067f51511Eb";

  const XBTC = "0x20Ecc92F0a33e16e8cf0417DFc3F586cf597F3a9";
  const iMXBTC = "0x6E42423e1bcB6A093A58E203b5eB6E8A8023b4e5";
  const iXBTC = "0x219B850993Ade4F44E24E6cac403a9a40F1d3d2E";

  const XETH = "0x463E3D1e01D048FDf872710F7f3745B5CDF50D0E";
  const iMXETH = "0x6AC0a0B3959C1e5fcBd09b59b09AbF7C53C72346";
  const iXETH = "0xF649E651afE5F05ae5bA493fa34f44dFeadFE05d";

  const XTSLA = "0xf21259B517D307F0dF8Ff3D3F53cF1674EBeAFe8";
  const iMXTSLA = "0x45055315dfCCBC91aC7107300FAAd7Abb234E7b7";

  const XAAPL = "0x70D1d7cDeC24b16942669A5fFEaDA8527B744502";
  const iMXAAPL = "0x8633cEb128F46a6a8d5b9EceA5161e84127D3c0a";

  const XAMZN = "0x0326dA9E3fA36F946CFDC87e59D24B45cbe4aaD0";
  const iMXAMZN = "0x500F397FcEe86eBEE89592b38005ab331De94AfF";

  const XCOIN = "0x3D9a9ED8A28A64827A684cEE3aa499da1824BF6c";
  const iMXCOIN = "0x82279995B210d63fba31790c5C64E3FF5e37d1E0";

  const transactions1 = [
    // ["msdController", "_setMintCaps", [USX, [iMUSX], [0]]],
    // ["msdController", "_setMintCaps", [EUX, [iMEUX], [0]]],
    ["msdController", "_setMintCaps", [XBTC, [iMXBTC], [0]]],
    ["msdController", "_setMintCaps", [XETH, [iMXETH], [0]]],
    ["msdController", "_setMintCaps", [XTSLA, [iMXTSLA], [0]]],
    ["msdController", "_setMintCaps", [XAAPL, [iMXAAPL], [0]]],
    ["msdController", "_setMintCaps", [XAMZN, [iMXAMZN], [0]]],
    ["msdController", "_setMintCaps", [XCOIN, [iMXCOIN], [0]]],
  ];

  const transactions2 = [
    // ["controller", "_setBorrowCapacity", [iMUSX, 0]],
    // ["controller", "_setBorrowCapacity", [iMEUX, 0]],
    ["controller", "_setBorrowCapacity", [iMXBTC, 0]],
    ["controller", "_setBorrowCapacity", [iMXETH, 0]],
    ["controller", "_setBorrowCapacity", [iXBTC, 0]],
    ["controller", "_setBorrowCapacity", [iXETH, 0]],
    ["controller", "_setSupplyCapacity", [iXBTC, 0]],
    ["controller", "_setSupplyCapacity", [iXETH, 0]],
    ["controllerStock", "_setBorrowCapacity", [iMXTSLA, 0]],
    ["controllerStock", "_setBorrowCapacity", [iMXAAPL, 0]],
    ["controllerStock", "_setBorrowCapacity", [iMXAMZN, 0]],
    ["controllerStock", "_setBorrowCapacity", [iMXCOIN, 0]],
  ];

  await printArgs(task, transactions1);
  await printArgs(task, transactions2);
}

async function pauseArbitrum() {
  const USX = "0x641441c631e2F909700d2f41FD87F0aA6A6b4EDb";
  const iMUSX = "0xe8c85B60Cb3bA32369c699015621813fb2fEA56c";

  const EUX = "0xC2125882318d04D266720B598d620f28222F3ABd";
  const iMEUX = "0x5BE49B2e04aC55A17c72aC37E3a85D9602322021";

  const transactions = [
    ["msdController", "_setMintCaps", [USX, [iMUSX], [0]]],
    ["msdController", "_setMintCaps", [EUX, [iMEUX], [0]]],
    ["controller", "_setBorrowCapacity", [iMUSX, 0]],
    ["controller", "_setBorrowCapacity", [iMEUX, 0]],
  ];

  await printArgs(task, transactions);
}

async function pauseOptimism() {
  const USX = "0xbfD291DA8A403DAAF7e5E9DC1ec0aCEaCd4848B9";
  const iMUSX = "0x94a14Ba6E59f4BE36a77041Ef5590Fe24445876A";
  const transactions = [
    ["msdController", "_setMintCaps", [USX, [iMUSX], [0]]],
    ["controller", "_setBorrowCapacity", [iMUSX, 0]],
  ];

  await printArgs(task, transactions);
}

async function pauseSynth() {
  switch (task.chainId) {
    case 1:
      await pauseMainnet();
      break;
    case 56:
      await pauseBSC();
      break;
    case 42161:
      await pauseArbitrum();
      break;
    case 10:
      await pauseOptimism();
      break;
    default:
      console.error("ChainId not supported");
  }
}

run(task, pauseSynth);
