// Right click on the script name and hit "Run" to execute
(async () => {
  try {
    console.log("Running deployWithEthers script...");

    const abiCoder = new ethers.utils.AbiCoder();
    const zeroAddress = ethers.constants.AddressZero;
    const signer = new ethers.providers.Web3Provider(web3Provider).getSigner();

    const contractName = "Timelock"; // Change this for other contract

    let tx;

    let targets = [];
    let values = [];
    let signatures = [];
    let calldatas = [];
    let data;

    let metadata;
    let timeLock;
    let artifactsPath, fixedInterestModelArtifactsPath;
    let fixedInterestModelMetadata;

    // Ethereum
    const timeLockAddress = "0x511b05f37e27a88E284322aF0bDE41A91771316d";
    const iETHProxyAddress = "0x5ACD75f21659a59fFaB9AEBAf350351a8bfaAbc0";
    const iETHReserveRatio = "0.15";
    const controllerProxyAddress = "0x0b53E608bD058Bb54748C35148484fD627E6dc0A";
    const iUSDTProxyAddress = "0x1180c114f7fAdCB6957670432a3Cf8Ef08Ab5354";
    const iUSDTCollateralFactor = "0.8";
    // const iDFProxyAddress = "0xb3dc7425e63E1855Eb41107134D471DD34d7b239";
    const iDFReserveRatio = "0.25";
    // const iUSXProxyAddress = "0x1AdC34Af68e970a93062b67344269fD341979eb0";
    const iUSXCollateralFactor = "0.8";
    // const iEUXProxyAddress = "0x44c324970e5CbC5D4C3F3B7604CbC6640C2dcFbF";
    const iEUXCollateralFactor = "0.8";
    // BSC
    const iDFProxyAddress = "0xeC3FD540A2dEE6F479bE539D64da593a59e12D08";
    const iUSXProxyAddress = "0x7B933e1c1F44bE9Fb111d87501bAADA7C8518aBe";
    const iEUXProxyAddress = "0x983A727Aa3491AB251780A13acb5e876D3f2B1d8";


    // Initialize timeLock contract
    artifactsPath = `browser/artifacts/contracts/governance/${contractName}.sol/${contractName}.json`;
    metadata = JSON.parse(
      await remix.call("fileManager", "getFile", artifactsPath)
    );

    timeLock = new ethers.Contract(
      timeLockAddress,
      metadata.abi,
      signer
    );
    console.log("time lock contract address: ", timeLock.address);

    const iTokenContractName = "iToken";
    const iTokenArtifactsPath = `browser/artifacts/contracts/${iTokenContractName}.sol/${iTokenContractName}.json`;
    const iTokenMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", iTokenArtifactsPath)
    );

    // 1. update eth reserve ratio to 15%:
    // data = abiCoder.encode(
    //   ["uint256"],
    //   [ethers.utils.parseEther(iETHReserveRatio)]
    // );

    // targets.push(iETHProxyAddress);
    // values.push(0);
    // signatures.push("_setNewReserveRatio(uint256)");
    // calldatas.push(data);

    // // 2. set USDT as collateral.
    // data = abiCoder.encode(
    //   ["address","uint256"],
    //   [iUSDTProxyAddress,ethers.utils.parseEther(iUSDTCollateralFactor)]
    // );

    // targets.push(controllerProxyAddress);
    // values.push(0);
    // signatures.push("_setCollateralFactor(address,uint256)");
    // calldatas.push(data);

    // 3. update df reserve ratio to 25%:
    // data = abiCoder.encode(
    //   ["uint256"],
    //   [ethers.utils.parseEther(iDFReserveRatio)]
    // );

    // targets.push(iDFProxyAddress);
    // values.push(0);
    // signatures.push("_setNewReserveRatio(uint256)");
    // calldatas.push(data);

    // 4. update USX collateral factor.
    data = abiCoder.encode(
      ["address","uint256"],
      [iUSXProxyAddress,ethers.utils.parseEther(iUSXCollateralFactor)]
    );

    targets.push(controllerProxyAddress);
    values.push(0);
    signatures.push("_setCollateralFactor(address,uint256)");
    calldatas.push(data);

    // 5. update EUX collateral factor.
    data = abiCoder.encode(
      ["address","uint256"],
      [iEUXProxyAddress,ethers.utils.parseEther(iEUXCollateralFactor)]
    );

    targets.push(controllerProxyAddress);
    values.push(0);
    signatures.push("_setCollateralFactor(address,uint256)");
    calldatas.push(data);


    console.log("going to execute this action.");

    await timeLock.executeTransactions(targets, values, signatures, calldatas);
    console.log("finish executing this action.");
  } catch (e) {
    console.log(e.message);
  }
})();
