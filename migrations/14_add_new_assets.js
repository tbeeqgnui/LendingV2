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

    // // Ethereum
    // const timeLockAddress = "0xBB247f5Ac912196A5AA80E9DD6aB252B79D6Ea25";
    // const proxyAdminAddress = "0x4FF0455bcfBB5886607c078E0F43Efb5DE34DeF4";
    // let controllerProxyAddress = "0x8B53Ab2c0Df3230EA327017C91Eb909f815Ad113";
    // let nonStableInterestModelAddress = "0x330FD6d0B2bdC06eEB583D73Dba0F1D3C2fE508D"; //MS
    // let stableInterestModelAddress = "0x8DfBF566566A8F29e86F490594Bd170162EE99fC"; //SP
    // // fixed one
    // let iTokenImplementationAddress = "0x1a5DE76EF2261fc6Cb281f8a447bEF4E48EF5d25";

    // let toDeployiTokens = ["frax", "fei"];
    // let assetsConfig = {
    //   "closeFactor": "0.5",
    //   "liquidationIncentive": "1.07",
    //   "frax": {
    //     // iToken config
    //     iTokenAddress: "0x71173e3c6999c2C72ccf363f4Ae7b67BCc7E8F63",
    //     iTokenUnderlyingAddress: "0x853d955aCEf822Db058eb8505911ED77F175b99e",
    //     iTokenName: "dForce FRAX",
    //     iTokenSymbol: "iFRAX",
    //     reserveRatio: "0.1",
    //     flashloanFeeRatio: "0.0004",
    //     protocolFeeRatio: "0.3",
    //     // controller config
    //     collateralFactor: "0",
    //     borrowFactor: "1",
    //     supplyCapacity: "30000000",
    //     borrowCapacity: "30000000",
    //     distributionFactor: "1",
    //     // interest model config
    //     interestModelType: "stableInterestModel",
    //     // asset price swing
    //     priceSwing: "0.1",
    //   },
    //   "fei": {
    //     // iToken config
    //     iTokenAddress: "0x47C19A2ab52DA26551A22e2b2aEED5d19eF4022F",
    //     iTokenUnderlyingAddress: "0x956F47F50A910163D8BF957Cf5846D573E7f87CA",
    //     iTokenName: "dForce FEI",
    //     iTokenSymbol: "iFEI",
    //     reserveRatio: "0.1",
    //     flashloanFeeRatio: "0.0004",
    //     protocolFeeRatio: "0.3",
    //     // controller config
    //     collateralFactor: "0",
    //     borrowFactor: "1",
    //     supplyCapacity: "30000000",
    //     borrowCapacity: "30000000",
    //     distributionFactor: "1",
    //     // interest model config
    //     interestModelType: "stableInterestModel",
    //     // asset price swing
    //     priceSwing: "0.1",
    //   },
    // };

    // Arbitrum
    const timeLockAddress = "0xdf00c38AC044Fcfa22B8F3C4fF06f6587FeD0248";
    const proxyAdminAddress = "0xc9aa79F70ac4a11619c649e857D74F517bBFeE47";
    let controllerProxyAddress = "0x8E7e9eA9023B81457Ae7E6D2a51b003D421E5408";
    let nonStableInterestModelAddress = "0x8E59F17b90D9422CdAACE49A8912386CF1F0Bb9C"; //MS
    let stableInterestModelAddress = "0xAF72329e42d0be8bee137Bc3420f20Fc04a49eFb"; //SP
    let iTokenImplementationAddress = "0x45b5636B01091336F02194D327374924D54a0772";

    let toDeployiTokens = ["frax"];
    let assetsConfig = {
      "closeFactor": "0.5",
      "liquidationIncentive": "1.07",
      "frax": {
        // iToken config
        iTokenAddress: "",
        iTokenUnderlyingAddress: "0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F",
        iTokenName: "dForce FRAX",
        iTokenSymbol: "iFRAX",
        reserveRatio: "0.1",
        flashloanFeeRatio: "0.0004",
        protocolFeeRatio: "0.3",
        // controller config
        collateralFactor: "0",
        borrowFactor: "1",
        supplyCapacity: "30000000",
        borrowCapacity: "30000000",
        distributionFactor: "1",
        // interest model config
        interestModelType: "stableInterestModel",
        // asset price swing
        priceSwing: "0.1",
      },
      "fei": {
        // iToken config
        iTokenAddress: "",
        iTokenUnderlyingAddress: "",
        iTokenName: "dForce FEI",
        iTokenSymbol: "iFEI",
        reserveRatio: "0.1",
        flashloanFeeRatio: "0.0004",
        protocolFeeRatio: "0.3",
        // controller config
        collateralFactor: "0",
        borrowFactor: "1",
        supplyCapacity: "30000000",
        borrowCapacity: "30000000",
        distributionFactor: "1",
        // interest model config
        interestModelType: "stableInterestModel",
        // asset price swing
        priceSwing: "0.1",
      },
    };

    // // BSC
    // const timeLockAddress = "0x511b05f37e27a88E284322aF0bDE41A91771316d";
    // const proxyAdminAddress = "0x0800604DA276c1D5e9c2C7FEC0e3b43FAb1Ca61a";
    // let controllerProxyAddress = "0x0b53E608bD058Bb54748C35148484fD627E6dc0A";
    // let nonStableInterestModelAddress = "0x68d3ba6201a6BA098bfF4570ee501e27777518e7";
    // let stableInterestModelAddress = "0xfA7d42a1aCB2d8AbA554077db7B7dC1772058723";
    // // fixed one
    // let iTokenImplementationAddress = "0x24e4920044610C31241Ce2a7c605656d73bF2423";

    // let toDeployiTokens = ["xrp", "ltc", "link", "cake", "bch", "xtz"];
    // let assetsConfig = {
    //   "closeFactor": "0.5",
    //   "liquidationIncentive": "1.07",
    //   "xrp": {
    //     // iToken config
    //     iTokenAddress: "0x6D64eFfe3af8697336Fc57efD5A7517Ad526Dd6d",
    //     iTokenUnderlyingAddress: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE",
    //     iTokenName: "dForce XRP",
    //     iTokenSymbol: "iXRP",
    //     reserveRatio: "0.15",
    //     flashloanFeeRatio: "0.0004",
    //     protocolFeeRatio: "0.3",
    //     // controller config
    //     collateralFactor: "0.7",
    //     borrowFactor: "1",
    //     supplyCapacity: "5000000",
    //     borrowCapacity: "5000000",
    //     distributionFactor: "1",
    //     // interest model config
    //     interestModelType: "nonStableInterestModel",
    //     // asset price swing
    //     priceSwing: "0.1",
    //   },
    //   "ltc": {
    //     // iToken config
    //     iTokenAddress: "0xd957BEa67aaDb8a72061ce94D033C631D1C1E6aC",
    //     iTokenUnderlyingAddress: "0x4338665CBB7B2485A8855A139b75D5e34AB0DB94",
    //     iTokenName: "dForce LTC",
    //     iTokenSymbol: "iLTC",
    //     reserveRatio: "0.15",
    //     flashloanFeeRatio: "0.0004",
    //     protocolFeeRatio: "0.3",
    //     // controller config
    //     collateralFactor: "0.7",
    //     borrowFactor: "1",
    //     supplyCapacity: "30000",
    //     borrowCapacity: "30000",
    //     distributionFactor: "1",
    //     // interest model config
    //     interestModelType: "nonStableInterestModel",
    //     // asset price swing
    //     priceSwing: "0.1",
    //   },
    //   "link": {
    //     // iToken config
    //     iTokenAddress: "0x50E894894809F642de1E11B4076451734c963087",
    //     iTokenUnderlyingAddress: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD",
    //     iTokenName: "dForce LINK",
    //     iTokenSymbol: "iLINK",
    //     reserveRatio: "0.15",
    //     flashloanFeeRatio: "0.0004",
    //     protocolFeeRatio: "0.3",
    //     // controller config
    //     collateralFactor: "0.7",
    //     borrowFactor: "1",
    //     supplyCapacity: "250000",
    //     borrowCapacity: "250000",
    //     distributionFactor: "1",
    //     // interest model config
    //     interestModelType: "nonStableInterestModel",
    //     // asset price swing
    //     priceSwing: "0.1",
    //   },
    //   "cake": {
    //     // iToken config
    //     iTokenAddress: "0xeFae8F7AF4BaDa590d4E707D900258fc72194d73",
    //     iTokenUnderlyingAddress: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    //     iTokenName: "dForce Cake",
    //     iTokenSymbol: "iCAKE",
    //     reserveRatio: "0.15",
    //     flashloanFeeRatio: "0.0004",
    //     protocolFeeRatio: "0.3",
    //     // controller config
    //     collateralFactor: "0.7",
    //     borrowFactor: "1",
    //     supplyCapacity: "80000",
    //     borrowCapacity: "80000",
    //     distributionFactor: "1",
    //     // interest model config
    //     interestModelType: "nonStableInterestModel",
    //     // asset price swing
    //     priceSwing: "0.1",
    //   },
    //   "bch": {
    //     // iToken config
    //     iTokenAddress: "0x9747e26c5Ad01D3594eA49ccF00790F564193c15",
    //     iTokenUnderlyingAddress: "0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf",
    //     iTokenName: "dForce BCH",
    //     iTokenSymbol: "iBCH",
    //     reserveRatio: "0.15",
    //     flashloanFeeRatio: "0.0004",
    //     protocolFeeRatio: "0.3",
    //     // controller config
    //     collateralFactor: "0.7",
    //     borrowFactor: "1",
    //     supplyCapacity: "5000",
    //     borrowCapacity: "5000",
    //     distributionFactor: "1",
    //     // interest model config
    //     interestModelType: "nonStableInterestModel",
    //     // asset price swing
    //     priceSwing: "0.1",
    //   },
    //   "xtz": {
    //     // iToken config
    //     iTokenAddress: "0x8be8cd81737b282C909F1911f3f0AdE630c335AA",
    //     iTokenUnderlyingAddress: "0x16939ef78684453bfDFb47825F8a5F714f12623a",
    //     iTokenName: "dForce XTZ",
    //     iTokenSymbol: "iXTZ",
    //     reserveRatio: "0.15",
    //     flashloanFeeRatio: "0.0004",
    //     protocolFeeRatio: "0.3",
    //     // controller config
    //     collateralFactor: "0.7",
    //     borrowFactor: "1",
    //     supplyCapacity: "1000000",
    //     borrowCapacity: "1000000",
    //     distributionFactor: "1",
    //     // interest model config
    //     interestModelType: "nonStableInterestModel",
    //     // asset price swing
    //     priceSwing: "0.1",
    //   },
    // };

    // Initialize timeLock contract
    artifactsPath = `browser/artifacts/contracts/governance/${contractName}.sol/${contractName}.json`;
    metadata = JSON.parse(
      await remix.call("fileManager", "getFile", artifactsPath)
    );

    // Initialize controller contract
    const controllerName = "Controller";
    const controllerArtifactsPath = `browser/artifacts/contracts/${controllerName}.sol/${controllerName}.json`;
    const controllerMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", controllerArtifactsPath)
    );
    let controller = new ethers.Contract(controllerProxyAddress, controllerMetadata.abi, signer);

    const proxyName = "TransparentUpgradeableProxy";
    const proxyArtifactsPath = `browser/artifacts/@openzeppelin/contracts/proxy/${proxyName}.sol/${proxyName}.json`;
    const proxyMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", proxyArtifactsPath)
    );

    let iTokenConfig;
    const iTokenContractName = "iToken";
    const iTokenArtifactsPath = `browser/artifacts/contracts/${iTokenContractName}.sol/${iTokenContractName}.json`;
    const iTokenMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", iTokenArtifactsPath)
    );
    const iTokenIface = new ethers.utils.Interface(iTokenMetadata.abi);
    // 5.2 Deploy iToken proxy contract.
    let toDeployiTokensLength = toDeployiTokens.length;
    for (let i = 0; i < toDeployiTokensLength; i++) {
      let currentiToken = toDeployiTokens[i];
      let iTokenProxyAddress = assetsConfig[currentiToken]["iTokenAddress"];
      iTokenConfig = assetsConfig[currentiToken];
      let interestModelType = assetsConfig[currentiToken]["interestModelType"];
      let actualInterestModel = interestModelType == "nonStableInterestModel" ? nonStableInterestModelAddress : stableInterestModelAddress;
      let iTokenInitData;

      if (!iTokenProxyAddress) {
        console.log("\nGoing to deploy iToken proxy: ", currentiToken);
        if (currentiToken == "eth") {
          // Replace iToken implementation to iETH implementation.
          iTokenImplementationAddress = iETHImplementationAddress;
          iTokenImplInitArgs = [iTokenConfig["iTokenName"], iTokenConfig["iTokenSymbol"], controllerProxyAddress, actualInterestModel];
          // iTokenInitData = iETHIface.functions["initialize"].encode(iTokenImplInitArgs);
          iTokenInitData = iETHIface.encodeFunctionData("initialize", [...iTokenImplInitArgs]);
        } else {
          iTokenImplInitArgs = [iTokenConfig["iTokenUnderlyingAddress"], iTokenConfig["iTokenName"], iTokenConfig["iTokenSymbol"], controllerProxyAddress, actualInterestModel];
          // iTokenInitData = iTokenIface.functions["initialize"].encode(iTokenImplInitArgs);
          iTokenInitData = iTokenIface.encodeFunctionData("initialize", [...iTokenImplInitArgs]);
        }
        console.log("iTokenInitData is: ", iTokenInitData);

        const iTokenProxyFactory = new ethers.ContractFactory(proxyMetadata.abi, proxyMetadata.bytecode, signer);
        const iTokenProxy = await iTokenProxyFactory.deploy(iTokenImplementationAddress, proxyAdminAddress, iTokenInitData);
        await iTokenProxy.deployed();

        assetsConfig[currentiToken]["iTokenAddress"] = iTokenProxy.address;
        console.log(currentiToken, " iToken token proxy contract address is: ", iTokenProxy.address);
      }

      console.log("\nGoing to set configs for ", currentiToken);
      iTokenProxyAddress = assetsConfig[currentiToken]["iTokenAddress"];
      let iToken = new ethers.Contract(iTokenProxyAddress, iTokenMetadata.abi, signer);
      // 5.3.0 Set configs for iTokens: reserveRatio
      let currentReserveRatio = await iToken.reserveRatio();
      let iTokenReserveRatio = assetsConfig[currentiToken]["reserveRatio"];
      let toWriteReserveRatio = ethers.utils.parseEther(iTokenReserveRatio);
      if (currentReserveRatio.toString() != toWriteReserveRatio.toString()) {
        console.log(
          "\ncurrent reserve ratio is:   ",
          currentReserveRatio.toString() / 1e18
        );
        console.log("going to set reserve ratio: ", iTokenReserveRatio);
        tx = await iToken._setNewReserveRatio(toWriteReserveRatio);
        await tx.wait(1);
        console.log("finish to set reserve ratio\n");

        currentReserveRatio = await iToken.reserveRatio();
        console.log("current reserve ratio is: ", currentReserveRatio.toString());
      }
    }

    // return;
    timeLock = new ethers.Contract(
      timeLockAddress,
      metadata.abi,
      signer
    );
    console.log("time lock contract address: ", timeLock.address);

    // Add to market
    let toAddiTokensToMarkets = toDeployiTokens;
    let toAddiTokensToMarketsLength = toAddiTokensToMarkets.length;
    for (let i = 0; i < toAddiTokensToMarketsLength; i++) {
      let currentiTokenContract = toAddiTokensToMarkets[i];
      let iTokenContractConfigs = assetsConfig[currentiTokenContract];
      let iTokenAddress = iTokenContractConfigs["iTokenAddress"];
      let hasAdded = await controller.hasiToken(iTokenAddress);
      console.log("Has added ", currentiTokenContract, " token to market: ", hasAdded);
      if (!hasAdded) {
        console.log("Going to add ", currentiTokenContract, " token to the market");
        let collateralFactor = ethers.utils.parseEther(iTokenContractConfigs["collateralFactor"]);
        let borrowFactor = ethers.utils.parseEther(iTokenContractConfigs["borrowFactor"]);
        let supplyCapacity = ethers.utils.parseEther(iTokenContractConfigs["supplyCapacity"]);
        let borrowCapacity = ethers.utils.parseEther(iTokenContractConfigs["borrowCapacity"]);
        let distributionFactor = ethers.utils.parseEther(iTokenContractConfigs["distributionFactor"]);
        data = abiCoder.encode(
          ["address","uint256","uint256","uint256","uint256","uint256"],
          [iTokenAddress,collateralFactor,borrowFactor,supplyCapacity,borrowCapacity,distributionFactor]
        );

        targets.push(controllerProxyAddress);
        values.push(0);
        signatures.push("_addMarket(address,uint256,uint256,uint256,uint256,uint256)");
        calldatas.push(data);
      }
    }

    console.log("going to add Market in one transaction.");
    console.log("targets : ", targets);
    console.log("values : ", values);
    console.log("signatures : ", signatures);
    console.log("calldatas : ", calldatas);

    await timeLock.executeTransactions(targets, values, signatures, calldatas);
    console.log("finish executing this action.");
  } catch (e) {
    console.log(e.message);
  }
})();
