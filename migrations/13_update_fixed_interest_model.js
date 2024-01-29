// This scripts is only for BSC network, it will do:
//  - Deploy a new fixed interest model
//  - Set borrow rate for the origianl iMSD tokens
//  - Update fixed interest model in all iMSDT tokens

// Right click on the script name and hit "Run" to execute
(async () => {
  try {
    console.log("Running deployWithEthers script...");

    const abiCoder = new ethers.utils.AbiCoder();
    const zeroAddress = ethers.constants.AddressZero;

    const contractName = "Timelock"; // Change this for other contract

    let tx;

    let data;
    let targets = [];
    let values = [];
    let signatures = [];
    let calldatas = [];

    let rewardDistributionContractAddress, signer, owneableMetadata, metadata;
    let timeLockAddress;

    // BSC
    timeLockAddress = "0x511b05f37e27a88E284322aF0bDE41A91771316d";

    // Note that the script needs the ABI which is generated from the compilation artifact.
    // Make sure contract is compiled and artifacts are generated
    const artifactsPath = `browser/artifacts/contracts/governance/${contractName}.sol/${contractName}.json`; // Change this for different path

    // 'web3Provider' is a remix global variable object
    signer = new ethers.providers.Web3Provider(web3Provider).getSigner();

    metadata = JSON.parse(
      await remix.call("fileManager", "getFile", artifactsPath)
    );

    const timeLock = new ethers.Contract(timeLockAddress, metadata.abi, signer);
    console.log("timeLock contract address: ", timeLock.address);

    // 0. Deploy fixed interest rate model contract.
    const fixedName = "FixedInterestRateModel";
    const fixedInterestModelArtifactsPath = `browser/artifacts/contracts/interestRateModel/${fixedName}.sol/${fixedName}.json`;
    const fixedInterestModelMetadata = JSON.parse(
      await remix.call(
        "fileManager",
        "getFile",
        fixedInterestModelArtifactsPath
      )
    );
    const fixedInterestInIface = new ethers.utils.Interface(
      fixedInterestModelMetadata.abi
    );
    let fixedInterestModelAddress = "";

    if (!fixedInterestModelAddress) {
      console.log("Going to deploy fixed interest model contract!");

      // Create an instance of a Contract Factory
      const fixedInterestModelFactory = new ethers.ContractFactory(
        fixedInterestModelMetadata.abi,
        fixedInterestModelMetadata.bytecode,
        signer
      );
      const fixedInterestModelContract =
        await fixedInterestModelFactory.deploy();
      // The contract is NOT deployed yet; we must wait until it is mined
      await fixedInterestModelContract.deployed();
      console.log(
        "Fixed interest model contract address: ",
        fixedInterestModelContract.address
      );

      fixedInterestModelAddress = fixedInterestModelContract.address;
      console.log("Finish to deploy fixed interest model contract!");
    }

    // Initialize fixed interest rate model contract.
    let fixedInterestModel = new ethers.Contract(
      fixedInterestModelAddress,
      fixedInterestModelMetadata.abi,
      signer
    );

    // 1. Set borrow rate for iMSD tokens.
    let toSetiMSDInterestRates = [
      "0x36f4C36D1F6e8418Ecb2402F896B2A8fEDdE0991", // iMUSX
      "0xb22eF996C0A2D262a19db2a66A256067f51511Eb", // iMEUX
    ];
    let toSetBorrowRates = ["2812024273", "2812024273"];
    await fixedInterestModel._setBorrowRates(
      toSetiMSDInterestRates,
      toSetBorrowRates
    );

    // 2. Update interest model in the iMSD tokens.
    let alliMSDTokens = [
      "0x36f4C36D1F6e8418Ecb2402F896B2A8fEDdE0991", // iMUSX
      "0xb22eF996C0A2D262a19db2a66A256067f51511Eb", // iMEUX
      "0x6E42423e1bcB6A093A58E203b5eB6E8A8023b4e5", // iMBTC
      "0x6AC0a0B3959C1e5fcBd09b59b09AbF7C53C72346", // iMETH
      "0x45055315dfCCBC91aC7107300FAAd7Abb234E7b7", // iMxTSLA
      "0x8633cEb128F46a6a8d5b9EceA5161e84127D3c0a", // iMxAAPL
      "0x500F397FcEe86eBEE89592b38005ab331De94AfF", // iMxAMZN
      "0x82279995B210d63fba31790c5C64E3FF5e37d1E0", // iMxCOIN
    ];

    let alliMSDTokensLength = alliMSDTokens.length;
    for (let i = 0; i < alliMSDTokensLength; i++) {
      data = abiCoder.encode(["address"], [fixedInterestModelAddress]);
      targets.push(alliMSDTokens[i]);
      values.push(0);
      signatures.push("_setInterestRateModel(address)");
      calldatas.push(data);
    }

    await timeLock.executeTransactions(targets, values, signatures, calldatas);

    console.log("finish executing this action.");
  } catch (e) {
    console.log(e.message);
  }
})();
