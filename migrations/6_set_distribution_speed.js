// Right click on the script name and hit "Run" to execute
(async () => {
  try {
    console.log("Running deployWithEthers script...");

    const abiCoder = new ethers.utils.AbiCoder();
    const zeroAddress = ethers.constants.AddressZero;

    const contractName = "Timelock"; // Change this for other contract

    let tx;

    let targets = [];
    let values = [];
    let signatures = [];
    let calldatas = [];

    let rewardDistributionContractAddress, signer, owneableMetadata, metadata;
    let timeLockAddress;

    // Note that the script needs the ABI which is generated from the compilation artifact.
    // Make sure contract is compiled and artifacts are generated
    const artifactsPath = `browser/artifacts/contracts/governance/${contractName}.sol/${contractName}.json`; // Change this for different path

    // 'web3Provider' is a remix global variable object
    signer = new ethers.providers.Web3Provider(web3Provider).getSigner();

    metadata = JSON.parse(
      await remix.call("fileManager", "getFile", artifactsPath)
    );

    let borrowedContracts,
      borrowedContractsSpeed,
      suppliedContracts,
      suppliedContractsSpeed;

    let network = "mainnet";
    // let network = "BSC";
    // let network = "arbitrum";

    // Ethereum
    if (network == "mainnet") {
      rewardDistributionContractAddress =
        "0x8fAeF85e436a8dd85D8E636Ea22E3b90f1819564";
      timeLockAddress = "0xBB247f5Ac912196A5AA80E9DD6aB252B79D6Ea25";

      borrowedContracts = [
        "0x5812fCF91adc502a765E5707eBB3F36a07f63c02", // iWBTC
        "0x5ACD75f21659a59fFaB9AEBAf350351a8bfaAbc0", // iETH
        "0x1180c114f7fAdCB6957670432a3Cf8Ef08Ab5354", // iUSDT
        "0x298f243aD592b6027d4717fBe9DeCda668E3c3A8", // iDAI
        "0x2f956b2f801c6dad74E87E7f45c94f6283BF0f45", // iUSDC
        "0x1AdC34Af68e970a93062b67344269fD341979eb0", // iUSX
        "0x44c324970e5CbC5D4C3F3B7604CbC6640C2dcFbF", // iEUX
        "0xd1254d280e7504836e1B0E36535eBFf248483cEE", // iMUSX
        "0x591595Bfae3f5d51A820ECd20A1e3FBb6638f34B", // iMEUX
        "0xb3dc7425e63E1855Eb41107134D471DD34d7b239", // iDF
      ];
      borrowedContractsSpeed = [
        "0",
        "0",
        "150466445982545893",
        "105326512187782125",
        "150466445982545893",
        "0",
        "0",
        "481492627144146856",
        "150466445982545893",
        "0",
      ];

      suppliedContracts = [
        "0x5812fCF91adc502a765E5707eBB3F36a07f63c02", // iWBTC
        "0x5ACD75f21659a59fFaB9AEBAf350351a8bfaAbc0", // iETH
        "0x1180c114f7fAdCB6957670432a3Cf8Ef08Ab5354", // iUSDT
        "0x298f243aD592b6027d4717fBe9DeCda668E3c3A8", // iDAI
        "0x2f956b2f801c6dad74E87E7f45c94f6283BF0f45", // iUSDC
        "0x1AdC34Af68e970a93062b67344269fD341979eb0", // iUSX
        "0x44c324970e5CbC5D4C3F3B7604CbC6640C2dcFbF", // iEUX
        "0xb3dc7425e63E1855Eb41107134D471DD34d7b239", // iDF
      ];
      suppliedContractsSpeed = [
        "120373156786036714",
        "361119470358110142",
        "1354198013842913031",
        "947938609690039122",
        "1354198013842913031",
        "120373156786036714",
        "120373156786036714",
        "601865783930183570",
      ];
    } else if (network == "BSC") {
      rewardDistributionContractAddress =
        "0x6fC21a5a767212E8d366B3325bAc2511bDeF0Ef4";
      timeLockAddress = "0x511b05f37e27a88E284322aF0bDE41A91771316d";

      borrowedContracts = [
        "0x0b66A250Dadf3237DdB38d485082a7BfE400356e", // iBTCB
        "0x390bf37355e9dF6Ea2e16eEd5686886Da6F47669", // iETH
        "0x0BF8C72d618B5d46b055165e21d661400008fa0F", // iUSDT
        "0xAD5Ec11426970c32dA48f58c92b1039bC50e5492", // iDAI
        "0xAF9c10b341f55465E8785F0F81DBB52a9Bfe005d", // iUSDC
        "0x5511b64Ae77452C7130670C79298DEC978204a47", // iBUSD
        "0x7B933e1c1F44bE9Fb111d87501bAADA7C8518aBe", // iUSX
        "0x983A727Aa3491AB251780A13acb5e876D3f2B1d8", // iEUX
        "0x36f4C36D1F6e8418Ecb2402F896B2A8fEDdE0991", // iMUSX
        "0xb22eF996C0A2D262a19db2a66A256067f51511Eb", // iMEUX
        "0xeC3FD540A2dEE6F479bE539D64da593a59e12D08", // iDF
        "0xd57E1425837567F74A35d07669B23Bfb67aA4A93", // iBNB
      ];
      borrowedContractsSpeed = [
        "0",
        "0",
        "31250000000000000",
        "8680555555555556",
        "22569444444444445",
        "38194444444444445",
        "0",
        "0",
        "173611111111111112",
        "34722222222222223",
        "0",
        "125000000000000000",
      ];

      suppliedContracts = [
        "0x0b66A250Dadf3237DdB38d485082a7BfE400356e", // iBTCB
        "0x390bf37355e9dF6Ea2e16eEd5686886Da6F47669", // iETH
        "0x0BF8C72d618B5d46b055165e21d661400008fa0F", // iUSDT
        "0xAD5Ec11426970c32dA48f58c92b1039bC50e5492", // iDAI
        "0xAF9c10b341f55465E8785F0F81DBB52a9Bfe005d", // iUSDC
        "0x5511b64Ae77452C7130670C79298DEC978204a47", // iBUSD
        "0x7B933e1c1F44bE9Fb111d87501bAADA7C8518aBe", // iUSX
        "0x983A727Aa3491AB251780A13acb5e876D3f2B1d8", // iEUX
        "0xeC3FD540A2dEE6F479bE539D64da593a59e12D08", // iDF
        "0xd57E1425837567F74A35d07669B23Bfb67aA4A93", // iBNB
      ];
      suppliedContractsSpeed = [
        "86805555555555556",
        "86805555555555556",
        "281250000000000000",
        "78125000000000000",
        "203125000000000000",
        "343750000000000000",
        "86805555555555556",
        "17361111111111112",
        "86805555555555556",
        "31250000000000000",
      ];
    } else if (network == "arbitrum") {
      rewardDistributionContractAddress =
        "0xF45e2ae152384D50d4e9b08b8A1f65F0d96786C3";
      timeLockAddress = "0xdf00c38AC044Fcfa22B8F3C4fF06f6587FeD0248";

      borrowedContracts = [
        "0xD3204E4189BEcD9cD957046A8e4A643437eE0aCC", // iWBTC
        "0xEe338313f022caee84034253174FA562495dcC15", // iETH
        "0xf52f079Af080C9FB5AFCA57DDE0f8B83d49692a9", // iUSDT
        "0x8dc3312c68125a94916d62B97bb5D925f84d4aE0", // iUSDC
        "0xf6995955e4B0E5b287693c221f456951D612b628", // iDAI
        "0x46Eca1482fffb61934C4abCA62AbEB0b12FEb17A", // iUNI
        "0x013ee4934ecbFA5723933c4B08EA5E47449802C8", // iLINK
        "0x0385F851060c09A552F1A28Ea3f612660256cBAA", // iUSX
        "0x5675546Eb94c2c256e6d7c3F7DcAB59bEa3B0B8B", // iEUX
        "0xe8c85B60Cb3bA32369c699015621813fb2fEA56c", // iMUSX
        "0x5BE49B2e04aC55A17c72aC37E3a85D9602322021", // iMEUX
      ];
      borrowedContractsSpeed = [
        "0",
        "0",
        "288895576286488114",
        "334035510081251881",
        "64098705988564551",
        "0",
        "0",
        "0",
        "0",
        "451399337947637677",
        "225699668973818839",
      ];

      suppliedContracts = [
        "0xD3204E4189BEcD9cD957046A8e4A643437eE0aCC", // iWBTC
        "0xEe338313f022caee84034253174FA562495dcC15", // iETH
        "0xf52f079Af080C9FB5AFCA57DDE0f8B83d49692a9", // iUSDT
        "0x8dc3312c68125a94916d62B97bb5D925f84d4aE0", // iUSDC
        "0xf6995955e4B0E5b287693c221f456951D612b628", // iDAI
        "0x46Eca1482fffb61934C4abCA62AbEB0b12FEb17A", // iUNI
        "0x013ee4934ecbFA5723933c4B08EA5E47449802C8", // iLINK
        "0x0385F851060c09A552F1A28Ea3f612660256cBAA", // iUSX
        "0x5675546Eb94c2c256e6d7c3F7DcAB59bEa3B0B8B", // iEUX
        "0xaEa8e2e7C97C5B7Cd545d3b152F669bAE29C4a63", // iDF
      ];
      suppliedContractsSpeed = [
        "135419801384291304",
        "451399337947637677",
        "2600060186578393019",
        "3006319590731266928",
        "576888353897080951",
        "18055973517905508",
        "18055973517905508",
        "90279867589527536",
        "45139933794763768",
        "722238940716220283",
      ];
    }

    const timeLock = new ethers.Contract(timeLockAddress, metadata.abi, signer);
    console.log("timeLock contract address: ", timeLock.address);

    let data = abiCoder.encode(
      ["address[]", "uint256[]", "address[]", "uint256[]"],
      [
        borrowedContracts,
        borrowedContractsSpeed,
        suppliedContracts,
        suppliedContractsSpeed,
      ]
    );

    targets.push(rewardDistributionContractAddress);
    values.push(0);
    // signatures.push("_unpause(address[],uint256[],address[],uint256[])");
    signatures.push(
      "_setDistributionSpeeds(address[],uint256[],address[],uint256[])"
    );
    calldatas.push(data);

    await timeLock.executeTransactions(targets, values, signatures, calldatas);

    // // pause to distribute
    // targets.push(rewardDistributionContractAddress);
    // values.push(0);
    // signatures.push("_pause()");
    // calldatas.push("0x");

    // await timeLock.executeTransactions(targets, values, signatures, calldatas);
  } catch (e) {
    console.log(e.message);
  }
})();
