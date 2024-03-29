// Right click on the script name and hit "Run" to execute
(async () => {
  try {
    let tx;

    // 'web3Provider' is a remix global variable object
    const signer = new ethers.providers.Web3Provider(web3Provider).getSigner();

    // Ethereum mainnet Config
    let oracleAddress = "0x34BAf46eA5081e3E49c29fccd8671ccc51e61E79";
    const posterAddress = "0x70A0D319c76B0a99BE5e8cd2685219aeA9406845";
    const maxSwing = "0.1";
    // NOTICE: This value is only used to calculate APY to set, not in the interest rate contract,
    // so, in different network, should re-write this value in the contract manually.
    let blocksPerYear = 2425846;

    // TODO:
    let proxyAdminAddress = "0x4FF0455bcfBB5886607c078E0F43Efb5DE34DeF4";
    const pauseGuardianAddress = "0x491C366614b971596cFf5570665DD9d24966de49";
    let controllerImplAddress = "0x0B9fbdb0d8ddcD06a29F029cA5Ac1A9fE5BFC783";
    let controllerProxyAddress = "0x8B53Ab2c0Df3230EA327017C91Eb909f815Ad113";
    let msdControllerImplAddress = "0xd45a90376220237f18eF0B72F31d5683345566db";
    let msdControllerProxyAddress = "0x45677a101D70E9910C418D9426bC6c5874CE2Fd7";
    let isNewMSDController = false;
    let rewardImplAddress = "0xF48AE39A4b37212D5204541D0fd07B537eC18035";
    let rewardProxyAddress = "0x8fAeF85e436a8dd85D8E636Ea22E3b90f1819564";
    let nonStableInterestModelAddress = "0x9C0C737d9823a64D37BFA1b62f9f0358993fe693";
    let stableInterestModelAddress = "0x03DDF6cF4B937a008c2f1b5393D6bdaC16dD5B08";
    let fixedInterestModelAddress = "0x22961D0Ba5150f97AE0F3248b4c415875cBf42d5";
    let msdImplementationAddress = "0xE3ec7De9375bFc22F4481C4605431d67ED5Bd260";
    let iTokenImplementationAddress = "0x1a5DE76EF2261fc6Cb281f8a447bEF4E48EF5d25";
    let iETHImplementationAddress = "0xfb8f11F54409370fe21e81BADB265053829A173E";
    let iMSDImplementationAddress = "0xeb25293808c97f1def991f15f756e00d595520ef";
    let lendingDataImplAddress = "0x4B30C26D61Be2f76bC7d9f2c5EdbaCBa84982358";
    let lendingDataProxyAddress = "0x37600A5a555F61ec2012D94b32f9B8c8eb2EfC5e";

    let toDeployiTokens = ["wsteth"];
    let toDeployMSDTokens = [];
    let assetsConfig = {
      "closeFactor": "0.5",
      "liquidationIncentive": "1.07",
      // _setAssetAggregatorBatch
      "wsteth": {
        // chainLink aggregator
        aggregator: "0xcfe54b5cd566ab89272946f602d76ea879cab4a8",
        // iToken config
        iTokenAddress: "0xbfd291da8a403daaf7e5e9dc1ec0aceacd4848b9",
        iTokenUnderlyingAddress: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
        iTokenName: "dForce wstETH",
        iTokenSymbol: "iwstETH",
        reserveRatio: "0.1",
        flashloanFeeRatio: "0.0004",
        protocolFeeRatio: "0.3",
        // controller config
        collateralFactor: "0.75",
        borrowFactor: "1",
        supplyCapacity: "5000",
        borrowCapacity: "5000",
        distributionFactor: "1",
        // interest model config
        interestModelType: "nonStableInterestModel",
        // asset price swing
        priceSwing: "0.1",
      },
      "usdt": {
        // chainLink aggregator
        aggregator: "0x3e7d1eab13ad0104d2750b8863b489d65364e32d",
        // iToken config
        iTokenAddress: "0x1180c114f7fAdCB6957670432a3Cf8Ef08Ab5354",
        iTokenUnderlyingAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        iTokenName: "dForce USDT",
        iTokenSymbol: "iUSDT",
        reserveRatio: "0.1",
        flashloanFeeRatio: "0.0004",
        protocolFeeRatio: "0.3",
        // controller config
        collateralFactor: "0.8",
        borrowFactor: "1",
        supplyCapacity: "50000000",
        borrowCapacity: "50000000",
        distributionFactor: "1",
        // interest model config
        interestModelType: "stableInterestModelAddress",
        // asset price swing
        priceSwing: "0.1",
      },
    };


    // 0.0 Deploys proxy admin.
    const proxyAdminName = "ProxyAdmin";
    const proxyAdminArtifactsPath = `browser/artifacts/contracts/library/${proxyAdminName}.sol/${proxyAdminName}.json`;
    const proxyAdminMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", proxyAdminArtifactsPath)
    );

    if (!proxyAdminAddress) {
      console.log("U r going to deploy proxy admin");
      // Create an instance of a Contract Factory
      const proxyAdminFactory = new ethers.ContractFactory(proxyAdminMetadata.abi, proxyAdminMetadata.bytecode, signer);
      const proxyAdmin = await proxyAdminFactory.deploy();
      // The contract is NOT deployed yet; we must wait until it is mined
      await proxyAdmin.deployed();
      console.log("proxy admin contract address: ", proxyAdmin.address);
      proxyAdminAddress = proxyAdmin.address;
    }


    // 1.0 Deploys controller contract.
    const controllerName = "Controller";
    const controllerArtifactsPath = `browser/artifacts/contracts/${controllerName}.sol/${controllerName}.json`;
    const controllerMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", controllerArtifactsPath)
    );
    const controllerInIface = new ethers.utils.Interface(controllerMetadata.abi);

    if (!controllerImplAddress) {
      console.log("Going to deploy a new  controller implementation contract!");

      // Create an instance of a Contract Factory
      const controllerFactory = new ethers.ContractFactory(controllerMetadata.abi, controllerMetadata.bytecode, signer);
      const controllerContract = await controllerFactory.deploy();
      // The contract is NOT deployed yet; we must wait until it is mined
      await controllerContract.deployed();
      console.log(" controller implementation contract address: ", controllerContract.address);

      console.log("Going to call initialize function in the  controller");
      tx = await controllerContract.initialize();
      await tx.wait(1);

      controllerImplAddress = controllerContract.address;
      console.log("Finish to deploy  controller implementation!");
    }

    const proxyName = "TransparentUpgradeableProxy";
    const proxyArtifactsPath = `browser/artifacts/@openzeppelin/contracts/proxy/${proxyName}.sol/${proxyName}.json`;
    const proxyMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", proxyArtifactsPath)
    );

    if (!controllerProxyAddress) {
      console.log("Going to deploy  controller proxy contract!");
      const initData = controllerInIface.encodeFunctionData("initialize", []);
      console.log("initData is: ", initData);

      const controllerProxyFactory = new ethers.ContractFactory(proxyMetadata.abi, proxyMetadata.bytecode, signer);
      const controllerProxy = await controllerProxyFactory.deploy(controllerImplAddress, proxyAdminAddress, initData);
      await controllerProxy.deployed();
      controllerProxyAddress = controllerProxy.address;
      console.log(" controller proxy contract address: ", controllerProxyAddress);
    }

    let controller = new ethers.Contract(controllerProxyAddress, controllerMetadata.abi, signer);

    // 1.1 Deploys msd controller contract.
    const msdControllerName = "MSDController";
    const msdControllerArtifactsPath = `browser/artifacts/contracts/msd/${msdControllerName}.sol/${msdControllerName}.json`;
    const msdControllerMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", msdControllerArtifactsPath)
    );
    const msdControllerInIface = new ethers.utils.Interface(msdControllerMetadata.abi);

    if (!msdControllerImplAddress) {
      console.log("Going to deploy a new  MSD controller implementation contract!");

      // Create an instance of a Contract Factory
      const msdControllerFactory = new ethers.ContractFactory(msdControllerMetadata.abi, msdControllerMetadata.bytecode, signer);
      const msdControllerContract = await msdControllerFactory.deploy();
      // The contract is NOT deployed yet; we must wait until it is mined
      await msdControllerContract.deployed();
      console.log(" MSD controller implementation contract address: ", msdControllerContract.address);

      console.log("Going to call initialize function in the  MSD controller");
      tx = await msdControllerContract.initialize();
      await tx.wait(1);

      msdControllerImplAddress = msdControllerContract.address;
      console.log("Finish to deploy  MSD controller implementation!");
    }

    if (!msdControllerProxyAddress) {
      console.log("Going to deploy  MSD controller proxy contract!");
      const msdControllerinitData = msdControllerInIface.encodeFunctionData("initialize", []);
      console.log("msdControllerinitData is: ", msdControllerinitData);

      const msdControllerProxyFactory = new ethers.ContractFactory(proxyMetadata.abi, proxyMetadata.bytecode, signer);
      const msdControllerProxy = await msdControllerProxyFactory.deploy(msdControllerImplAddress, proxyAdminAddress, msdControllerinitData);
      await msdControllerProxy.deployed();
      msdControllerProxyAddress = msdControllerProxy.address;
      console.log(" MSD controller proxy contract address: ", msdControllerProxyAddress);
    }

    let msdController = new ethers.Contract(msdControllerProxyAddress, msdControllerMetadata.abi, signer);

    // 2.0 Deploys reward distributor contract.
    const rewardName = "RewardDistributorV3";
    const rewardArtifactsPath = `browser/artifacts/contracts/${rewardName}.sol/${rewardName}.json`;
    const rewardMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", rewardArtifactsPath)
    );
    const rewardInIface = new ethers.utils.Interface(rewardMetadata.abi);
    let rewardInitArgs = [controllerProxyAddress];

    if (!rewardImplAddress) {
      console.log("Going to deploy a new  reward distributor implementation contract!");

      // Create an instance of a Contract Factory
      const rewardFactory = new ethers.ContractFactory(rewardMetadata.abi, rewardMetadata.bytecode, signer);
      const rewardContract = await rewardFactory.deploy();
      // The contract is NOT deployed yet; we must wait until it is mined
      await rewardContract.deployed();
      console.log(" reward distributor implementation contract address: ", rewardContract.address);

      console.log("Going to call initialize function in the  reward distributor");
      tx = await rewardContract.initialize(...rewardInitArgs);
      await tx.wait(1);

      rewardImplAddress = rewardContract.address;
      console.log("Finish to deploy  reward distributor implementation!");
    }

    if (!rewardProxyAddress) {
      console.log("Going to deploy  reward distributor proxy contract!");
      const rewardInitData = rewardInIface.encodeFunctionData("initialize", [...rewardInitArgs]);
      console.log("rewardInitData is: ", rewardInitData);

      const rewardProxyFactory = new ethers.ContractFactory(proxyMetadata.abi, proxyMetadata.bytecode, signer);
      const rewardProxy = await rewardProxyFactory.deploy(rewardImplAddress, proxyAdminAddress, rewardInitData);
      await rewardProxy.deployed();
      rewardProxyAddress = rewardProxy.address;
      console.log(" reward distributor proxy contract address: ", rewardProxyAddress);
    }

    // 2.1 Set reward distributor in the controller
    let currentRewardContractInController = await controller.rewardDistributor();
    if (currentRewardContractInController != rewardProxyAddress) {
      console.log("\nGoing to set reward distributor in controller contract!");
      await controller._setRewardDistributor(rewardProxyAddress);
    }

    // 3.0 Deploy non-stable coin interest rate model contract.
    const nonStableName = "StandardInterestRateModel";
    const nonStableInterestModelArtifactsPath = `browser/artifacts/contracts/interestRateModel/${nonStableName}.sol/${nonStableName}.json`;
    const nonStableInterestMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", nonStableInterestModelArtifactsPath)
    );
    const nonStableInterestInIface = new ethers.utils.Interface(nonStableInterestMetadata.abi);
    let nonStableInterestModelThreshold = ethers.utils.parseEther("0.05");
    let nonStableInterestModelInitArgs = [nonStableInterestModelThreshold];

    if (!nonStableInterestModelAddress) {
      console.log("Going to deploy non stable coin interest model contract!");

      // Create an instance of a Contract Factory
      const nonStableInterestModelFactory = new ethers.ContractFactory(nonStableInterestMetadata.abi, nonStableInterestMetadata.bytecode, signer);
      const nonStableInterestModelContract = await nonStableInterestModelFactory.deploy(...nonStableInterestModelInitArgs);
      // The contract is NOT deployed yet; we must wait until it is mined
      await nonStableInterestModelContract.deployed();
      console.log(" non stable coin interest model contract address: ", nonStableInterestModelContract.address);

      nonStableInterestModelAddress = nonStableInterestModelContract.address;
      console.log("Finish to deploy non stable coin interest model contract!");
    }

    // 3.1 Deploy stable coin interest rate model contract.
    const stableName = "StablecoinInterestRateModel";
    const stableInterestModelArtifactsPath = `browser/artifacts/contracts/interestRateModel/${stableName}.sol/${stableName}.json`;
    const stableInterestMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", stableInterestModelArtifactsPath)
    );
    const stableInterestInIface = new ethers.utils.Interface(stableInterestMetadata.abi);

    if (!stableInterestModelAddress) {
      console.log("Going to deploy stable coin interest model contract!");

      // Create an instance of a Contract Factory
      const stableInterestModelFactory = new ethers.ContractFactory(stableInterestMetadata.abi, stableInterestMetadata.bytecode, signer);
      const stableInterestModelContract = await stableInterestModelFactory.deploy();
      // The contract is NOT deployed yet; we must wait until it is mined
      await stableInterestModelContract.deployed();
      console.log(" stable coin interest model contract address: ", stableInterestModelContract.address);

      stableInterestModelAddress = stableInterestModelContract.address;
      console.log("Finish to deploy stable coin interest model contract!");
    }

    // 3.2 Deploy fixed interest rate model contract.
    const fixedName = "FixedInterestRateModel";
    const fixedInterestModelArtifactsPath = `browser/artifacts/contracts/interestRateModel/${fixedName}.sol/${fixedName}.json`;
    const fixedInterestModelMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", fixedInterestModelArtifactsPath)
    );
    const fixedInterestInIface = new ethers.utils.Interface(fixedInterestModelMetadata.abi);

    if (!fixedInterestModelAddress) {
      console.log("Going to deploy fixed interest model contract!");

      // Create an instance of a Contract Factory
      const fixedInterestModelFactory = new ethers.ContractFactory(fixedInterestModelMetadata.abi, fixedInterestModelMetadata.bytecode, signer);
      const fixedInterestModelContract = await fixedInterestModelFactory.deploy();
      // The contract is NOT deployed yet; we must wait until it is mined
      await fixedInterestModelContract.deployed();
      console.log(" fixed interest model contract address: ", fixedInterestModelContract.address);

      fixedInterestModelAddress = fixedInterestModelContract.address;
      console.log("Finish to deploy fixed interest model contract!");
    }

    // Initialize fixed interest rate model contract.
    let fixedInterestModel = new ethers.Contract(fixedInterestModelAddress, fixedInterestModelMetadata.abi, signer);

    // 4.0 Deploy MSD implementation contract.
    const msdContractName = "MSD";
    const msdArtifactsPath = `browser/artifacts/contracts/msd/${msdContractName}.sol/${msdContractName}.json`;
    const msdMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", msdArtifactsPath)
    );
    const msdIface = new ethers.utils.Interface(msdMetadata.abi);

    let msdConfig = assetsConfig["usx_imsd"];
    let msdInitArgs = [msdConfig["msdTokenName"], msdConfig["msdTokenSymbol"], msdConfig["decimals"]]

    if (!msdImplementationAddress) {
      console.log("Going to deploy MSD token implementation contract!");
      const msdFactory = new ethers.ContractFactory(msdMetadata.abi, msdMetadata.bytecode, signer);
      const msd = await msdFactory.deploy();
      await msd.deployed();

      console.log("MSD token implementation contract address is: ", msd.address);
      msdImplementationAddress = msd.address;

      console.log("Going to call initialize function in the MSD token");
      tx = await msd.initialize(...msdInitArgs);
      await tx.wait(1);
      console.log("Finish to deploy MSD token contract!");
    }

    // 4.1 Deploy MSD proxy token.
    let toDeployMSDTokensLength = toDeployMSDTokens.length;
    for (let i = 0; i < toDeployMSDTokensLength; i++) {
      let currentMSDToken = toDeployMSDTokens[i];
      let msdTokenAddress = assetsConfig[currentMSDToken]["msdAddress"];

      msdConfig = assetsConfig[currentMSDToken];
      msdInitArgs = [msdConfig["msdTokenName"], msdConfig["msdTokenSymbol"], msdConfig["decimals"]];

      if (!msdTokenAddress) {
        console.log("\nGoing to deploy MSD proxy token: ", currentMSDToken);
        let msdInitData = msdIface.encodeFunctionData("initialize", [...msdInitArgs]);
        console.log("msdInitData is: ", msdInitData);

        let msdProxyFactory = new ethers.ContractFactory(proxyMetadata.abi, proxyMetadata.bytecode, signer);
        let msdProxyContract = await msdProxyFactory.deploy(msdImplementationAddress, proxyAdminAddress, msdInitData);
        await msdProxyContract.deployed();
        assetsConfig[currentMSDToken]["msdAddress"] = msdProxyContract.address;
        if (currentMSDToken == "usx_imsd") {
          assetsConfig["usx_iToken"]["iTokenUnderlyingAddress"] = msdProxyContract.address;
        } else if (currentMSDToken == "eux_imsd") {
          assetsConfig["eux_iToken"]["iTokenUnderlyingAddress"] = msdProxyContract.address;
        }
        console.log(currentMSDToken, " MSD token proxy contract address is: ", msdProxyContract.address);
      }
    }

    // 5.0 Deploy iToken implementation contract.
    const iTokenContractName = "iToken";
    const iTokenArtifactsPath = `browser/artifacts/contracts/${iTokenContractName}.sol/${iTokenContractName}.json`;
    const iTokenMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", iTokenArtifactsPath)
    );
    const iTokenIface = new ethers.utils.Interface(iTokenMetadata.abi);

    let iTokenConfig = assetsConfig["usx_iToken"];
    // Only for iToken implementation, so can use msd contract address!!!
    let iTokenImplInitArgs = [iTokenConfig["iTokenUnderlyingAddress"], iTokenConfig["iTokenName"], iTokenConfig["iTokenSymbol"], controllerProxyAddress, stableInterestModelAddress];

    if (!iTokenImplementationAddress) {
      console.log("Going to deploy iToken implementation contract!");
      const iTokenFactory = new ethers.ContractFactory(iTokenMetadata.abi, iTokenMetadata.bytecode, signer);
      const iTokenContract = await iTokenFactory.deploy();
      await iTokenContract.deployed();

      console.log("iToken implementation contract address is: ", iTokenContract.address);
      iTokenImplementationAddress = iTokenContract.address;

      console.log("Going to call initialize function in the iToken");
      tx = await iTokenContract.initialize(...iTokenImplInitArgs);
      await tx.wait(1);
      console.log("Finish to deploy iToken contract!");
    }

    // 5.1 Deploy iETH implementation contract.
    const iETHContractName = "iETH";
    const iETHArtifactsPath = `browser/artifacts/contracts/${iETHContractName}.sol/${iETHContractName}.json`;
    const iETHMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", iETHArtifactsPath)
    );
    const iETHIface = new ethers.utils.Interface(iETHMetadata.abi);

    let iETHConfig = assetsConfig["eth"];
    let iETHImplInitArgs = [iETHConfig["iTokenName"], iETHConfig["iTokenSymbol"], controllerProxyAddress, nonStableInterestModelAddress];

    if (!iETHImplementationAddress) {
      console.log("Going to deploy iETH implementation contract!");
      const iETHFactory = new ethers.ContractFactory(iETHMetadata.abi, iETHMetadata.bytecode, signer);
      const iETHContract = await iETHFactory.deploy();
      await iETHContract.deployed();

      console.log("iETH implementation contract address is: ", iETHContract.address);
      iETHImplementationAddress = iETHContract.address;

      console.log("Going to call initialize function in the iETH");
      tx = await iETHContract.initialize(...iETHImplInitArgs);
      await tx.wait(1);
      console.log("Finish to deploy iETH contract!");
    }

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
          iTokenInitData = iETHIface.encodeFunctionData("initialize", [...iTokenImplInitArgs]);
        } else {
          iTokenImplInitArgs = [iTokenConfig["iTokenUnderlyingAddress"], iTokenConfig["iTokenName"], iTokenConfig["iTokenSymbol"], controllerProxyAddress, actualInterestModel];
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

      // // 5.3.1 Set configs for iTokens: flashloanFeeRatio
      // let currentFlashloanFeeRatio = await iToken.flashloanFeeRatio();
      // let iTokenFlashloanFeeRatio = assetsConfig[currentiToken]["flashloanFeeRatio"];
      // let toWriteFlashloanFeeRatio = ethers.utils.parseEther(iTokenFlashloanFeeRatio);
      // if (
      //   currentFlashloanFeeRatio.toString() != toWriteFlashloanFeeRatio.toString()
      // ) {
      //   console.log(
      //     "\ncurrent flashloan fee ratio is:   ",
      //     currentFlashloanFeeRatio.toString() / 1e18
      //   );
      //   console.log("going to set flashloan fee ratio: ", iTokenFlashloanFeeRatio);
      //   tx = await iToken._setNewFlashloanFeeRatio(toWriteFlashloanFeeRatio);
      //   await tx.wait(1);
      //   console.log("finish to set flashloan fee ratio\n");

      //   currentFlashloanFeeRatio = await iToken.flashloanFeeRatio();
      //   console.log("current flashfee ratio is: ", currentFlashloanFeeRatio.toString());
      // }

      // // 5.3.2 Set configs for iTokens: protocolFeeRatio
      // let currentProtocolFeeRatio = await iToken.protocolFeeRatio();
      // let iTokenProtocolFeeRatio = assetsConfig[currentiToken]["protocolFeeRatio"];
      // let toWriteProtocolFeeRatio = ethers.utils.parseEther(iTokenProtocolFeeRatio);
      // if (
      //   currentProtocolFeeRatio.toString() != toWriteProtocolFeeRatio.toString()
      // ) {
      //   console.log(
      //     "\ncurrent protocol fee ratio is:   ",
      //     currentProtocolFeeRatio.toString() / 1e18
      //   );
      //   console.log("going to set protocol fee ratio: ", iTokenProtocolFeeRatio);
      //   tx = await iToken._setNewProtocolFeeRatio(toWriteProtocolFeeRatio);
      //   await tx.wait(1);
      //   console.log("finish to set protocol fee ratio\n");

      //   currentProtocolFeeRatio = await iToken.protocolFeeRatio();
      //   console.log("current protocol fee ratio is: ", currentProtocolFeeRatio.toString());
      // }
    }

    // 5.4 Deploy iMSD implementation.
    const iMSDContractName = "iMSD";
    const iMSDArtifactsPath = `browser/artifacts/contracts/msd/${iMSDContractName}.sol/${iMSDContractName}.json`;
    const iMSDMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", iMSDArtifactsPath)
    );
    const iMSDIface = new ethers.utils.Interface(iMSDMetadata.abi);

    let iMSDConfig = assetsConfig["usx_imsd"];
    let iMSDInitArgs = [iMSDConfig["msdAddress"], iMSDConfig["iMTokenName"], iMSDConfig["iMTokenSymbol"], controllerProxyAddress, fixedInterestModelAddress, msdControllerProxyAddress];

    if (!iMSDImplementationAddress) {
      console.log("Going to deploy iMSD token implementation contract!");
      const iMSDFactory = new ethers.ContractFactory(iMSDMetadata.abi, iMSDMetadata.bytecode, signer);
      const iMSDContract = await iMSDFactory.deploy();
      await iMSDContract.deployed();

      console.log("iMSD token implementation contract address is: ", iMSDContract.address);
      iMSDImplementationAddress = iMSDContract.address;

      console.log("Going to call initialize function in the iMSD token");
      tx = await iMSDContract.initialize(...iMSDInitArgs);
      await tx.wait(1);
      console.log("Finish to deploy iMSD token contract!");
    }

    // 5.5 Deploy iMSD proxy contracts.
    let toDeployiMSDTokens = toDeployMSDTokens;
    let toDeployiMSDTokensLength = toDeployiMSDTokens.length;
    for (let i = 0; i < toDeployiMSDTokensLength; i++) {
      let currentiMSDToken = toDeployiMSDTokens[i];
      let iMSDTokenAddress = assetsConfig[currentiMSDToken]["iMTokenAddress"];

      iMSDConfig = assetsConfig[currentiMSDToken];
      iMSDInitArgs = [iMSDConfig["msdAddress"], iMSDConfig["iMTokenName"], iMSDConfig["iMTokenSymbol"], controllerProxyAddress, fixedInterestModelAddress, msdControllerProxyAddress];

      if (!iMSDTokenAddress) {
        console.log("\nGoing to deploy iMSD token: ", currentiMSDToken);
        let iMSDInitData = iMSDIface.encodeFunctionData("initialize", [...iMSDInitArgs]);
        console.log("iMSDInitData is: ", iMSDInitData);

        let iMSDProxyFactory = new ethers.ContractFactory(proxyMetadata.abi, proxyMetadata.bytecode, signer);
        let iMSDProxyContract = await iMSDProxyFactory.deploy(iMSDImplementationAddress, proxyAdminAddress, iMSDInitData);
        await iMSDProxyContract.deployed();
        assetsConfig[currentiMSDToken]["iMTokenAddress"] = iMSDProxyContract.address;
        console.log(currentiMSDToken, " iMSD token proxy contract address is: ", iMSDProxyContract.address);
      }
    }

    // 6.0 Deploy oracle.
    const oracleContractName = "PriceOracle";
    const oracleArtifactsPath = `browser/artifacts/contracts/${oracleContractName}.sol/${oracleContractName}.json`;
    const oracleMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", oracleArtifactsPath)
    );
    let oracleInitArgs = [posterAddress, ethers.utils.parseEther(maxSwing.toString())];

    if (!oracleAddress) {
      console.log("Going to deploy oracle contract!");
      const oracleFactory = new ethers.ContractFactory(oracleMetadata.abi, oracleMetadata.bytecode, signer);
      const oracleContract = await oracleFactory.deploy(...oracleInitArgs);
      await oracleContract.deployed();

      oracleAddress = oracleContract.address;
      console.log("Oracle contract address is: ", oracleAddress);
    }

    let oracle = new ethers.Contract(oracleAddress, oracleMetadata.abi, signer);

    // 6.1 Set price for BTC, ETH, USDC, EUX
    let allAssets = toDeployiTokens.concat(toDeployMSDTokens);
    let allAssetsLength = allAssets.length;
    let toSetAssets = [];
    let toSetAssetsAggregators = [];
    let toFeedAssets = [];
    let toFeedPrices = [];
    for (let i = 0; i < allAssetsLength; i++) {
      let currentiToken = allAssets[i];
      let assetAggregator = assetsConfig[currentiToken]["aggregator"];
      let iTokenAddress = assetsConfig[currentiToken]["iTokenAddress"];
      let iTokenPrice = await oracle.getUnderlyingPrice(iTokenAddress);

      if (assetAggregator) {
        if (iTokenPrice.toString() == "0") {
          console.log("Going to setting price for ", currentiToken);
          toSetAssets.push(iTokenAddress);
          toSetAssetsAggregators.push(assetAggregator);
        }
      } else {
        // It is iMUSX or iUSX.
        let toWriteiUSXPrice = ethers.utils.parseEther("1");
        if (iTokenPrice.toString() == "0") {
          toFeedAssets.push(iTokenAddress);
          toFeedPrices.push(toWriteiUSXPrice);
        }
      }
    }

    if (toSetAssets.length != 0) {
      await oracle._setAssetAggregatorBatch(toSetAssets, toSetAssetsAggregators);
    }

    if (toFeedAssets.length != 0) {
      await oracle.setPrices(toFeedAssets, toFeedPrices);
    }

    // 7.0 Deploy lending data implementation contract.
    const priceTokenAddress = assetsConfig["usx_imsd"]["iMTokenAddress"];
    const lendingDataContractName = "LendingDataV2";
    const lendingDataArtifactsPath = `browser/artifacts/contracts/helper/${lendingDataContractName}.sol/${lendingDataContractName}.json`;
    const lendingDataMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", lendingDataArtifactsPath)
    );
    const lendingDataIface = new ethers.utils.Interface(lendingDataMetadata.abi);
    let lendingDataInitArgs = [controllerProxyAddress, priceTokenAddress];

    if (!lendingDataImplAddress) {
      console.log("Going to deploy lending data implementation contract!");
      const lendingDataFactory = new ethers.ContractFactory(lendingDataMetadata.abi, lendingDataMetadata.bytecode, signer);
      const lendingDataContract = await lendingDataFactory.deploy(...lendingDataInitArgs);
      await lendingDataContract.deployed();

      lendingDataImplAddress = lendingDataContract.address;
      console.log("lending data implementation contract address is: ", lendingDataImplAddress);
    }

    // 7.1 Deploy lending data proxy contract.
    if (!lendingDataProxyAddress) {
      console.log("Deploy lending data contract proxy");
      const lendingDataInitData = lendingDataIface.encodeFunctionData("initialize", [...lendingDataInitArgs]);
      console.log("lending initData is: ", lendingDataInitData);

      const lendingDataProxyFactory = new ethers.ContractFactory(proxyMetadata.abi, proxyMetadata.bytecode, signer);
      const lendingDataContract = await lendingDataProxyFactory.deploy(lendingDataImplAddress, proxyAdminAddress, lendingDataInitData);
      await lendingDataContract.deployed();
      lendingDataProxyAddress = lendingDataContract.address;
      console.log("lendingDataContract proxy contract address is: ", lendingDataProxyAddress);
    }

    /// ------------------------
    /// Set config in controller
    /// ------------------------

    // 8.0 Sets oracle contract.
    let currentOracle = await controller.priceOracle();
    console.log("current oracle is: ", currentOracle);
    if (currentOracle != oracleAddress) {
      console.log("Going to set oracle in controller contract!");
      tx = await controller._setPriceOracle(oracleAddress);
      await tx.wait(1);

      currentOracle = await controller.priceOracle();
      console.log("after execution, oracle is: ", currentOracle);
    }

    // 8.1 Sets close factor:
    let currentCloseFactor = await controller.closeFactorMantissa();
    let iTokenCloseFactor = assetsConfig["closeFactor"];
    let toSetCloseFactor = ethers.utils.parseEther(iTokenCloseFactor);
    if (currentCloseFactor.toString() != toSetCloseFactor.toString()) {
      console.log("going to set close factor: ", iTokenCloseFactor);
      tx = await controller._setCloseFactor(toSetCloseFactor);
      await tx.wait(1);
      console.log("finish to set close factor\n");
      currentCloseFactor = await controller.closeFactorMantissa();
      console.log("after execution, close factor is: ", currentCloseFactor.toString());
    }

    // 8.2 Sets liquidation incentive: liquidationIncentive
    let currentLiquidationIncentive = await controller.liquidationIncentiveMantissa();
    let iTokenLiquidationIncentive = assetsConfig["liquidationIncentive"];
    let toSetLiquidatationIncentive = ethers.utils.parseEther(iTokenLiquidationIncentive);
    if (currentLiquidationIncentive.toString() != toSetLiquidatationIncentive.toString()) {
      console.log("going to set liquidation incentive: ", iTokenLiquidationIncentive);
      tx = await controller._setLiquidationIncentive(toSetLiquidatationIncentive);
      await tx.wait(1);
      console.log("finish to set liquidation incentive\n");
      currentLiquidationIncentive = await controller.liquidationIncentiveMantissa();
      console.log("after execution, liquidation incentive is: ", currentLiquidationIncentive.toString());
    }

    // 8.3 Set contract guardian.
    let currentPauseGuardian = await controller.pauseGuardian();
    console.log("Current pause guardian is: ", currentPauseGuardian);
    if (currentPauseGuardian != pauseGuardianAddress) {
      console.log("Going to set a pause guardian!");
      tx = await controller._setPauseGuardian(pauseGuardianAddress);
      await tx.wait(1);
      currentPauseGuardian = await controller.pauseGuardian();
      console.log("After execution, pause guardian is: ", currentPauseGuardian);
    }

    // TODO: Need to feed price at first!!!
    // 8.4 Add all iTokens to market.
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
        tx = await controller._addMarket(
          iTokenAddress,
          collateralFactor,
          borrowFactor,
          supplyCapacity,
          borrowCapacity,
          distributionFactor
        );
        await tx.wait(1);

        hasAdded = await controller.hasiToken(iTokenAddress);
        console.log("After execution, has added ", currentiTokenContract, " token to market: ", hasAdded);
      }
    }

    // 8.5 Add all iMSD tokens to market.
    let toAddiMSDToMarkets = toDeployiMSDTokens;
    let toAddiMSDToMarketsLength = toAddiMSDToMarkets.length;
    for (let i = 0; i < toAddiMSDToMarketsLength; i++) {
      let currentiMSDContract = toAddiMSDToMarkets[i];
      let iMSDContractConfigs = assetsConfig[currentiMSDContract];
      let iMTokenAddress = iMSDContractConfigs["iMTokenAddress"];
      let iMSDHasAdded = await controller.hasiToken(iMTokenAddress);
      console.log("Has added ", currentiMSDContract, " token to market: ", iMSDHasAdded);
      if (!iMSDHasAdded) {
        console.log("Going to add ", currentiMSDContract, " token to the market");
        let iMSDCollateralFactor = ethers.utils.parseEther(iMSDContractConfigs["collateralFactor"]);
        let iMSDBorrowFactor = ethers.utils.parseEther(iMSDContractConfigs["borrowFactor"]);
        let iMSDSupplyCapacity = ethers.utils.parseEther(iMSDContractConfigs["supplyCapacity"]);
        let iMSDBorrowCapacity = ethers.utils.parseEther(iMSDContractConfigs["borrowCapacity"]);
        let iMSDDistributionFactor = ethers.utils.parseEther(iMSDContractConfigs["distributionFactor"]);
        tx = await controller._addMarket(
          iMTokenAddress,
          iMSDCollateralFactor,
          iMSDBorrowFactor,
          iMSDSupplyCapacity,
          iMSDBorrowCapacity,
          iMSDDistributionFactor
        );
        await tx.wait(1);

        iMSDHasAdded = await controller.hasiToken(iMTokenAddress);
        console.log("After execution, has added ", currentiMSDContract, " token to market: ", iMSDHasAdded);
      }
    }

    /// ------------------------
    /// Set config in MSD
    /// ------------------------
    // 9.0 Add MSD controller as the only minter
    if (isNewMSDController) {
      for (let i = 0; i < toDeployMSDTokensLength; i++) {
        let MSDToken = toDeployMSDTokens[i];
        console.log("\nGoing to set MSD minter: ", MSDToken);
        let MSDTokenAddress = assetsConfig[MSDToken]["msdAddress"];
        let msdContract = new ethers.Contract(MSDTokenAddress, msdMetadata.abi, signer);
        console.log("going to set MSD controller as only minter");
        tx = await msdContract._addMinter(msdControllerProxyAddress);
        await tx.wait(1);
        console.log(MSDToken, " minters in MSD token are:      ", await msdContract.getMinters(), "\n");
      }
    }

    /// ------------------------
    /// Set config in iMSD
    /// ------------------------
    // 9.1 Sets relationship of MSD and iMSD in the msdController.
    for (let i = 0; i < toDeployMSDTokensLength; i++) {
      let MSDToken = toDeployMSDTokens[i];
      console.log("\nGoing to set MSD controller minter: ", MSDToken);
      let toAddMSDTokenAddress = assetsConfig[MSDToken]["msdAddress"];
      let toAddiMSDTokenAddress = assetsConfig[MSDToken]["iMTokenAddress"];
      let iMSD_apy = assetsConfig[MSDToken]["borrowAPY"];
      console.log("toAddMSDTokenAddress", toAddMSDTokenAddress);
      console.log("toAddiMSDTokenAddress", toAddiMSDTokenAddress);

      tx = await msdController._addMSD(toAddMSDTokenAddress, [toAddiMSDTokenAddress]);
      await tx.wait(1);

      // 8.2 Sets borrow rate for iMSD token
      let currentBorrowRate = await fixedInterestModel.borrowRatesPerBlock(toAddiMSDTokenAddress);
      console.log("\niMSD current borrow rate is:  ", currentBorrowRate.toString());
      let interestPerDay = Math.pow(iMSD_apy, 1 / 365);
      let actualBorrowRate = (interestPerDay - 1) * 10 ** 18 / (blocksPerYear / 365);
      actualBorrowRate = actualBorrowRate.toFixed();

      if (currentBorrowRate.toString() != actualBorrowRate.toString()) {
        console.log("\nset borrow rate for iMSD token");
        console.log("iMSD to write borrow rate is: ", actualBorrowRate);
        tx = await fixedInterestModel._setBorrowRate(toAddiMSDTokenAddress, actualBorrowRate);
        await tx.wait(1);
        currentBorrowRate = await fixedInterestModel.borrowRatesPerBlock(toAddiMSDTokenAddress);
        console.log("after setting, iMSD current borrow rate is: ", currentBorrowRate.toString());
      }
    }

    // 10 Going to set borrow capacity and supply capacity.
    let toResetConfigTokens = ["wbtc", "eth", "usdt", "usdc", "uni", "link", "usx_iToken", "eux_iToken", "usx_imsd", "eux_imsd"];
    let toResetConfigTokensLength = toResetConfigTokens.length;
    for (let i = 0; i < toResetConfigTokensLength; i++) {
      let iTokenName = toResetConfigTokens[i];
      console.log("\nGoing to set config for : ", iTokenName);
      let iTokenProxyAddress = assetsConfig[iTokenName]["iTokenAddress"];
      let iToken = new ethers.Contract(iTokenProxyAddress, iTokenMetadata.abi, signer);
      let newSupplyCapacity = ethers.utils.parseUnits((assetsConfig[iTokenName]["supplyCapacity"]).toString(), await iToken.decimals());
      let newBorrowCapacity = ethers.utils.parseUnits((assetsConfig[iTokenName]["borrowCapacity"]).toString(), await iToken.decimals());

      let iTokenDetails = await controller.markets(iTokenProxyAddress);
      let currentSupplyCapacity = iTokenDetails.supplyCapacity;
      let currentBorrowCapacity = iTokenDetails.borrowCapacity;

      if (newSupplyCapacity.toString() != currentSupplyCapacity.toString()) {
        console.log("Going to set supply capacity for: ", iTokenName);
        console.log("Current supply capacity is: ", currentSupplyCapacity.toString());
        console.log("To set supply capacity is: ", newSupplyCapacity.toString());
        tx = await controller._setSupplyCapacity(iTokenProxyAddress, newSupplyCapacity);
        await tx.wait(1);
      }

      if (newBorrowCapacity.toString() != currentBorrowCapacity.toString()) {
        console.log("Going to set borrow capacity for: ", iTokenName);
        console.log("Current borrow capacity is: ", currentBorrowCapacity.toString());
        console.log("To set borrow capacity is: ", newBorrowCapacity.toString());
        tx = await controller._setBorrowCapacity(iTokenProxyAddress, newBorrowCapacity);
        await tx.wait(1);
      }

      iTokenDetails = await controller.markets(iTokenProxyAddress);
      console.log("\nAfter set new config");
      console.log("Supply capacity is: ", (iTokenDetails.supplyCapacity).toString());
      console.log("Borrow capacity is: ", (iTokenDetails.borrowCapacity).toString());
    }

    console.log("Finish!");
    console.log("Run another script to set distribution speed!")

  } catch (e) {
    console.log(e.message);
  }
})();
