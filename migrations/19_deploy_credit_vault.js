// Right click on the script name and hit "Run" to execute
async function main() {
  try {
    let tx;

    const networks = JSON.parse(
      await remix.call("fileManager", "getFile", `browser/config/commonConfig.json`)
    );
    console.log(networks);

    let contractAddresses = JSON.parse(
      await remix.call("fileManager", "getFile", `browser/config/contractAddresses.json`)
    );

    let provider = new ethers.providers.Web3Provider(web3.currentProvider);
    let chainId = (await provider.getNetwork()).chainId;

    // 'web3Provider' is a remix global variable object
    const signer = await provider.getSigner();

    const maxSwing = "0.1";

    let toDeployiTokens = ["crt"];
    let toDeployMSDTokens = ["crt_msd"];
    let assetsConfig = JSON.parse(
      await remix.call("fileManager", "getFile", `browser/config/reservesConfig.json`)
    );

    let currentNetwork = networks[chainId];
    console.log("chainId is: ", chainId);
    console.log("Current network is: ", currentNetwork);
    let currentContractAddresses = contractAddresses[currentNetwork];
    let currentAssetConfigs = assetsConfig[currentNetwork];

    // 0.0 Deploys proxy admin.
    const proxyAdminName = "ProxyAdmin";
    const proxyAdminArtifactsPath = `browser/artifacts/contracts/library/${proxyAdminName}.sol/${proxyAdminName}.json`;
    const proxyAdminMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", proxyAdminArtifactsPath)
    );

    if (!currentContractAddresses.proxyAdminAddress) {
      console.log("U r going to deploy proxy admin");
      // Create an instance of a Contract Factory
      const proxyAdminFactory = new ethers.ContractFactory(
        proxyAdminMetadata.abi,
        proxyAdminMetadata.bytecode,
        signer
      );
      const proxyAdmin = await proxyAdminFactory.deploy();
      // The contract is NOT deployed yet; we must wait until it is mined
      await proxyAdmin.deployed();
      currentContractAddresses.proxyAdminAddress = proxyAdmin.address;
    }
    console.log("proxy admin contract address: ", currentContractAddresses.proxyAdminAddress);

    // 1.0 Deploys controller contract.
    const controllerName = "ControllerMiniPool";
    const controllerArtifactsPath = `browser/artifacts/contracts/MiniPool/${controllerName}.sol/${controllerName}.json`;
    const controllerMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", controllerArtifactsPath)
    );
    const controllerInIface = new ethers.utils.Interface(
      controllerMetadata.abi
    );

    if (!currentContractAddresses.controllerImplAddress) {
      console.log("Going to deploy a new  controller implementation contract!");

      // Create an instance of a Contract Factory
      const controllerFactory = new ethers.ContractFactory(
        controllerMetadata.abi,
        controllerMetadata.bytecode,
        signer
      );
      const controllerContract = await controllerFactory.deploy();
      // The contract is NOT deployed yet; we must wait until it is mined
      await controllerContract.deployed();
      console.log(
        " controller implementation contract address: ",
        controllerContract.address
      );

      console.log("Going to call initialize function in the  controller");
      tx = await controllerContract.initialize();
      await tx.wait(1);

      currentContractAddresses.controllerImplAddress = controllerContract.address;
      console.log("Finish to deploy  controller implementation!");
    }

    const proxyName = "TransparentUpgradeableProxy";
    const proxyArtifactsPath = `browser/artifacts/@openzeppelin/contracts/proxy/${proxyName}.sol/${proxyName}.json`;
    const proxyMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", proxyArtifactsPath)
    );

    if (!currentContractAddresses.controllerProxyAddress) {
      console.log("Going to deploy  controller proxy contract!");
      const initData = controllerInIface.encodeFunctionData("initialize", []);
      console.log("initData is: ", initData);

      const controllerProxyFactory = new ethers.ContractFactory(
        proxyMetadata.abi,
        proxyMetadata.bytecode,
        signer
      );
      const controllerProxy = await controllerProxyFactory.deploy(
        currentContractAddresses.controllerImplAddress,
        currentContractAddresses.proxyAdminAddress,
        initData
      );
      await controllerProxy.deployed();
      currentContractAddresses.controllerProxyAddress = controllerProxy.address;
      console.log(
        " controller proxy contract address: ",
        controllerProxy.address
      );
    }

    let controller = new ethers.Contract(
      currentContractAddresses.controllerProxyAddress,
      controllerMetadata.abi,
      signer
    );

    // 1.1 Deploys msd controller contract.
    const msdControllerName = "MSDControllerV2";
    const msdControllerArtifactsPath = `browser/artifacts/contracts/msd/${msdControllerName}.sol/${msdControllerName}.json`;
    const msdControllerMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", msdControllerArtifactsPath)
    );
    const msdControllerInIface = new ethers.utils.Interface(
      msdControllerMetadata.abi
    );

    if (!currentContractAddresses.msdControllerImplAddress) {
      console.log(
        "Going to deploy a new  MSD controller implementation contract!"
      );

      // Create an instance of a Contract Factory
      const msdControllerFactory = new ethers.ContractFactory(
        msdControllerMetadata.abi,
        msdControllerMetadata.bytecode,
        signer
      );
      const msdControllerContract = await msdControllerFactory.deploy();
      // The contract is NOT deployed yet; we must wait until it is mined
      await msdControllerContract.deployed();
      console.log(
        " MSD controller implementation contract address: ",
        msdControllerContract.address
      );

      console.log("Going to call initialize function in the  MSD controller");
      tx = await msdControllerContract.initialize();
      await tx.wait(1);

      currentContractAddresses.msdControllerImplAddress = msdControllerContract.address;
      console.log("Finish to deploy  MSD controller implementation!");
    }

    if (!currentContractAddresses.msdControllerProxyAddress) {
      console.log("Going to deploy  MSD controller proxy contract!");
      const msdControllerinitData = msdControllerInIface.encodeFunctionData(
        "initialize",
        []
      );
      console.log("msdControllerinitData is: ", msdControllerinitData);

      const msdControllerProxyFactory = new ethers.ContractFactory(
        proxyMetadata.abi,
        proxyMetadata.bytecode,
        signer
      );
      const msdControllerProxy = await msdControllerProxyFactory.deploy(
        currentContractAddresses.msdControllerImplAddress,
        currentContractAddresses.proxyAdminAddress,
        msdControllerinitData
      );
      await msdControllerProxy.deployed();
      currentContractAddresses.msdControllerProxyAddress = msdControllerProxy.address;
      console.log(
        " MSD controller proxy contract address: ",
        currentContractAddresses.msdControllerProxyAddress
      );
    }

    let msdController = new ethers.Contract(
      currentContractAddresses.msdControllerProxyAddress,
      msdControllerMetadata.abi,
      signer
    );

    // 2.0 Deploys reward distributor contract.
    const rewardName = "RewardDistributorV3";
    const rewardArtifactsPath = `browser/artifacts/contracts/${rewardName}.sol/${rewardName}.json`;
    const rewardMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", rewardArtifactsPath)
    );
    const rewardInIface = new ethers.utils.Interface(rewardMetadata.abi);
    let rewardInitArgs = [currentContractAddresses.controllerProxyAddress];

    if (!currentContractAddresses.rewardImplAddress) {
      console.log(
        "Going to deploy a new  reward distributor implementation contract!"
      );

      // Create an instance of a Contract Factory
      const rewardFactory = new ethers.ContractFactory(
        rewardMetadata.abi,
        rewardMetadata.bytecode,
        signer
      );
      const rewardContract = await rewardFactory.deploy();
      // The contract is NOT deployed yet; we must wait until it is mined
      await rewardContract.deployed();
      console.log(
        " reward distributor implementation contract address: ",
        rewardContract.address
      );

      console.log(
        "Going to call initialize function in the  reward distributor"
      );
      tx = await rewardContract.initialize(...rewardInitArgs);
      await tx.wait(1);

      currentContractAddresses.rewardImplAddress = rewardContract.address;
      console.log("Finish to deploy  reward distributor implementation!");
    }

    if (!currentContractAddresses.rewardProxyAddress) {
      console.log("Going to deploy  reward distributor proxy contract!");
      const rewardInitData = rewardInIface.encodeFunctionData("initialize", [
        ...rewardInitArgs,
      ]);
      console.log("rewardInitData is: ", rewardInitData);

      const rewardProxyFactory = new ethers.ContractFactory(
        proxyMetadata.abi,
        proxyMetadata.bytecode,
        signer
      );
      const rewardProxy = await rewardProxyFactory.deploy(
        currentContractAddresses.rewardImplAddress,
        currentContractAddresses.proxyAdminAddress,
        rewardInitData
      );
      await rewardProxy.deployed();
      currentContractAddresses.rewardProxyAddress = rewardProxy.address;
      console.log(
        " reward distributor proxy contract address: ",
        currentContractAddresses.rewardProxyAddress
      );
    }

    // 2.1 Set reward distributor in the controller
    let currentRewardContractInController = await controller.rewardDistributor();
    if (currentRewardContractInController != currentContractAddresses.rewardProxyAddress) {
      console.log("\nGoing to set reward distributor in controller contract!");
      await controller._setRewardDistributor(currentContractAddresses.rewardProxyAddress);
    }

    // 3.0 Deploy non-stable coin interest rate model contract.
    const nonStableName = "StandardInterestRateModel";
    const nonStableInterestModelArtifactsPath = `browser/artifacts/contracts/interestRateModel/${nonStableName}.sol/${nonStableName}.json`;
    const nonStableInterestMetadata = JSON.parse(
      await remix.call(
        "fileManager",
        "getFile",
        nonStableInterestModelArtifactsPath
      )
    );
    const nonStableInterestInIface = new ethers.utils.Interface(
      nonStableInterestMetadata.abi
    );
    let nonStableInterestModelThreshold = ethers.utils.parseEther("0.05");
    let nonStableInterestModelInitArgs = [nonStableInterestModelThreshold];

    if (!currentContractAddresses.nonStableInterestModelAddress) {
      console.log("Going to deploy non stable coin interest model contract!");

      // Create an instance of a Contract Factory
      const nonStableInterestModelFactory = new ethers.ContractFactory(
        nonStableInterestMetadata.abi,
        nonStableInterestMetadata.bytecode,
        signer
      );
      const nonStableInterestModelContract = await nonStableInterestModelFactory.deploy(
        ...nonStableInterestModelInitArgs
      );
      // The contract is NOT deployed yet; we must wait until it is mined
      await nonStableInterestModelContract.deployed();
      console.log(
        " non stable coin interest model contract address: ",
        nonStableInterestModelContract.address
      );

      currentContractAddresses.nonStableInterestModelAddress = nonStableInterestModelContract.address;
      console.log("Finish to deploy non stable coin interest model contract!");
    }

    // 3.1 Deploy stable coin interest rate model contract.
    const stableName = "StablecoinInterestRateModel";
    const stableInterestModelArtifactsPath = `browser/artifacts/contracts/interestRateModel/${stableName}.sol/${stableName}.json`;
    const stableInterestMetadata = JSON.parse(
      await remix.call(
        "fileManager",
        "getFile",
        stableInterestModelArtifactsPath
      )
    );
    const stableInterestInIface = new ethers.utils.Interface(
      stableInterestMetadata.abi
    );

    if (!currentContractAddresses.stableInterestModelAddress) {
      console.log("Going to deploy stable coin interest model contract!");

      // Create an instance of a Contract Factory
      const stableInterestModelFactory = new ethers.ContractFactory(
        stableInterestMetadata.abi,
        stableInterestMetadata.bytecode,
        signer
      );
      const stableInterestModelContract = await stableInterestModelFactory.deploy();
      // The contract is NOT deployed yet; we must wait until it is mined
      await stableInterestModelContract.deployed();
      console.log(
        " stable coin interest model contract address: ",
        stableInterestModelContract.address
      );

      currentContractAddresses.stableInterestModelAddress = stableInterestModelContract.address;
      console.log("Finish to deploy stable coin interest model contract!");
    }

    // 3.2 Deploy fixed interest rate model contract.
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

    if (!currentContractAddresses.fixedInterestModelAddress) {
      console.log("Going to deploy fixed interest model contract!");

      // Create an instance of a Contract Factory
      const fixedInterestModelFactory = new ethers.ContractFactory(
        fixedInterestModelMetadata.abi,
        fixedInterestModelMetadata.bytecode,
        signer
      );
      const fixedInterestModelContract = await fixedInterestModelFactory.deploy();
      // The contract is NOT deployed yet; we must wait until it is mined
      await fixedInterestModelContract.deployed();
      console.log(
        " fixed interest model contract address: ",
        fixedInterestModelContract.address
      );

      currentContractAddresses.fixedInterestModelAddress = fixedInterestModelContract.address;
      console.log("Finish to deploy fixed interest model contract!");
    }

    // Initialize fixed interest rate model contract.
    let fixedInterestModel = new ethers.Contract(
      currentContractAddresses.fixedInterestModelAddress,
      fixedInterestModelMetadata.abi,
      signer
    );

    // 4.0 Deploy MSD implementation contract.
    const msdContractName = "MSD";
    const msdArtifactsPath = `browser/artifacts/contracts/msd/${msdContractName}.sol/${msdContractName}.json`;
    const msdMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", msdArtifactsPath)
    );
    const msdIface = new ethers.utils.Interface(msdMetadata.abi);


    // 4.1 Deploy MSD proxy token.
    let toDeployMSDTokensLength = toDeployMSDTokens.length;


    // 5.0 Deploy iToken implementation contract.
    const iTokenContractName = "iToken";
    const iTokenArtifactsPath = `browser/artifacts/contracts/${iTokenContractName}.sol/${iTokenContractName}.json`;
    const iTokenMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", iTokenArtifactsPath)
    );
    const iTokenIface = new ethers.utils.Interface(iTokenMetadata.abi);

    let iTokenConfig = currentAssetConfigs["crt"];
    // Only for iToken implementation, so can use msd contract address!!!
    let iTokenImplInitArgs = [
      iTokenConfig["iTokenUnderlyingAddress"],
      iTokenConfig["iTokenName"],
      iTokenConfig["iTokenSymbol"],
      currentContractAddresses.controllerProxyAddress,
      currentContractAddresses.stableInterestModelAddress,
    ];

    if (!currentContractAddresses.iTokenImplementationAddress) {
      console.log("Going to deploy iToken implementation contract!");
      const iTokenFactory = new ethers.ContractFactory(
        iTokenMetadata.abi,
        iTokenMetadata.bytecode,
        signer
      );
      const iTokenContract = await iTokenFactory.deploy();
      await iTokenContract.deployed();

      currentContractAddresses.iTokenImplementationAddress = iTokenContract.address;

      console.log("Going to call initialize function in the iToken");
      tx = await iTokenContract.initialize(...iTokenImplInitArgs);
      await tx.wait(1);
      console.log("Finish to deploy iToken contract!");
    }
    console.log(
      "iToken implementation contract address is: ",
      currentContractAddresses.iTokenImplementationAddress
    );

    // // 5.1 Deploy iETH implementation contract.
    // const iETHContractName = "iETH";
    // const iETHArtifactsPath = `browser/artifacts/contracts/${iETHContractName}.sol/${iETHContractName}.json`;
    // const iETHMetadata = JSON.parse(
    //   await remix.call("fileManager", "getFile", iETHArtifactsPath)
    // );
    // const iETHIface = new ethers.utils.Interface(iETHMetadata.abi);

    // let iETHConfig = currentAssetConfigs["eth"];
    // let iETHImplInitArgs = [
    //   iETHConfig["iTokenName"],
    //   iETHConfig["iTokenSymbol"],
    //   currentContractAddresses.controllerProxyAddress,
    //   currentContractAddresses.nonStableInterestModelAddress,
    // ];

    // if (!currentContractAddresses.iETHImplementationAddress) {
    //   console.log("Going to deploy iETH implementation contract!");
    //   const iETHFactory = new ethers.ContractFactory(
    //     iETHMetadata.abi,
    //     iETHMetadata.bytecode,
    //     signer
    //   );
    //   const iETHContract = await iETHFactory.deploy();
    //   await iETHContract.deployed();

    //   console.log(
    //     "iETH implementation contract address is: ",
    //     iETHContract.address
    //   );
    //   currentContractAddresses.iETHImplementationAddress = iETHContract.address;

    //   console.log("Going to call initialize function in the iETH");
    //   tx = await iETHContract.initialize(...iETHImplInitArgs);
    //   await tx.wait(1);
    //   console.log("Finish to deploy iETH contract!");
    // }

    // 5.2 Deploy iToken proxy contract.
    let toDeployiTokensLength = toDeployiTokens.length;
    for (let i = 0; i < toDeployiTokensLength; i++) {
      let currentiToken = toDeployiTokens[i];
      let iTokenProxyAddress = currentAssetConfigs[currentiToken]["iTokenAddress"];
      iTokenConfig = currentAssetConfigs[currentiToken];
      let interestModelType = currentAssetConfigs[currentiToken]["interestModelType"];
      let actualInterestModel =
        interestModelType == "nonStableInterestModel"
          ? currentContractAddresses.nonStableInterestModelAddress
          : currentContractAddresses.stableInterestModelAddress;
      let iTokenInitData;

      let iTokenImplementationAddress = currentContractAddresses.iTokenImplementationAddress;
      if (!iTokenProxyAddress) {
        console.log("\nGoing to deploy iToken proxy: ", currentiToken);
        if (currentiToken == "eth") {
          // Replace iToken implementation to iETH implementation.
          iTokenImplementationAddress = currentContractAddresses.iETHImplementationAddress;
          iTokenImplInitArgs = [
            iTokenConfig["iTokenName"],
            iTokenConfig["iTokenSymbol"],
            currentContractAddresses.controllerProxyAddress,
            actualInterestModel,
          ];
          iTokenInitData = iETHIface.encodeFunctionData("initialize", [
            ...iTokenImplInitArgs,
          ]);
        } else {
          iTokenImplInitArgs = [
            iTokenConfig["iTokenUnderlyingAddress"],
            iTokenConfig["iTokenName"],
            iTokenConfig["iTokenSymbol"],
            currentContractAddresses.controllerProxyAddress,
            actualInterestModel,
          ];
          iTokenInitData = iTokenIface.encodeFunctionData("initialize", [
            ...iTokenImplInitArgs,
          ]);
        }
        console.log("iTokenInitData is: ", iTokenInitData);

        const iTokenProxyFactory = new ethers.ContractFactory(
          proxyMetadata.abi,
          proxyMetadata.bytecode,
          signer
        );
        const iTokenProxy = await iTokenProxyFactory.deploy(
          iTokenImplementationAddress,
          currentContractAddresses.proxyAdminAddress,
          iTokenInitData
        );
        await iTokenProxy.deployed();

        currentAssetConfigs[currentiToken]["iTokenAddress"] = iTokenProxy.address;
        console.log(
          currentiToken,
          " iToken token proxy contract address is: ",
          iTokenProxy.address
        );
      }

      console.log("\nGoing to set configs for ", currentiToken);
      iTokenProxyAddress = currentAssetConfigs[currentiToken]["iTokenAddress"];
      let iToken = new ethers.Contract(
        iTokenProxyAddress,
        iTokenMetadata.abi,
        signer
      );
      // 5.3.0 Set configs for iTokens: reserveRatio
      let currentReserveRatio = await iToken.reserveRatio();
      let iTokenReserveRatio = currentAssetConfigs[currentiToken]["reserveRatio"];
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
        console.log(
          "current reserve ratio is: ",
          currentReserveRatio.toString()
        );
      }

      // // 5.3.1 Set configs for iTokens: flashloanFeeRatio
      // let currentFlashloanFeeRatio = await iToken.flashloanFeeRatio();
      // let iTokenFlashloanFeeRatio = currentAssetConfigs[currentiToken]["flashloanFeeRatio"];
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
      // let iTokenProtocolFeeRatio = currentAssetConfigs[currentiToken]["protocolFeeRatio"];
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
    const iMSDContractName = "iMSDMiniPool";
    const iMSDArtifactsPath = `browser/artifacts/contracts/MiniPool/${iMSDContractName}.sol/${iMSDContractName}.json`;
    const iMSDMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", iMSDArtifactsPath)
    );
    const iMSDIface = new ethers.utils.Interface(iMSDMetadata.abi);

    let iMSDConfig = currentAssetConfigs["crt_msd"];
    let collateral = iMSDConfig["collateral"];
    let iMSDInitArgs = [
      iMSDConfig["msdAddress"],
      iMSDConfig["iMTokenName"],
      iMSDConfig["iMTokenSymbol"],
      currentContractAddresses.controllerProxyAddress,
      currentContractAddresses.fixedInterestModelAddress,
      currentContractAddresses.msdControllerProxyAddress,
      currentAssetConfigs[collateral]["iTokenAddress"],
      iMSDConfig["feeRecipient"],
      ethers.utils.parseEther(iMSDConfig["feeRatio"]),
    ];

    if (!currentContractAddresses.iMSDImplementationAddress) {
      console.log("Going to deploy iMSD token implementation contract!");
      const iMSDFactory = new ethers.ContractFactory(
        iMSDMetadata.abi,
        iMSDMetadata.bytecode,
        signer
      );
      const iMSDContract = await iMSDFactory.deploy();
      await iMSDContract.deployed();

      console.log(
        "iMSD token implementation contract address is: ",
        iMSDContract.address
      );
      currentContractAddresses.iMSDImplementationAddress = iMSDContract.address;

      console.log("Going to call initialize function in the iMSD token");
      const contractImpl = new ethers.Contract(
        currentContractAddresses.iMSDImplementationAddress,
        iMSDMetadata.abi,
        signer
      );
      tx = await contractImpl[
        "initialize(address,string,string,address,address,address,address,address,uint256)"
      ](...iMSDInitArgs);
      // tx = await iMSDContract.initialize(...iMSDInitArgs);
      await tx.wait(1);
      console.log("Finish to deploy iMSD token contract!");
    }

    // 5.5 Deploy iMSD proxy contracts.
    let toDeployiMSDTokens = toDeployMSDTokens;
    let toDeployiMSDTokensLength = toDeployiMSDTokens.length;
    for (let i = 0; i < toDeployiMSDTokensLength; i++) {
      let currentiMSDToken = toDeployiMSDTokens[i];
      let iMSDTokenAddress = currentAssetConfigs[currentiMSDToken]["iMTokenAddress"];

      iMSDConfig = currentAssetConfigs[currentiMSDToken];
      let collateral = iMSDConfig["collateral"];

      iMSDInitArgs = [
        iMSDConfig["msdAddress"],
        iMSDConfig["iMTokenName"],
        iMSDConfig["iMTokenSymbol"],
        currentContractAddresses.controllerProxyAddress,
        currentContractAddresses.fixedInterestModelAddress,
        currentContractAddresses.msdControllerProxyAddress,
        currentAssetConfigs[collateral]["iTokenAddress"],
        iMSDConfig["feeRecipient"],
        ethers.utils.parseEther(iMSDConfig["feeRatio"]),
      ];

      if (!iMSDTokenAddress) {
        console.log("\nGoing to deploy iMSD token: ", currentiMSDToken);
        let iMSDInitData = iMSDIface.encodeFunctionData(
          "initialize(address,string,string,address,address,address,address,address,uint256)",
          [...iMSDInitArgs]
        );
        console.log("iMSDInitData is: ", iMSDInitData);

        let iMSDProxyFactory = new ethers.ContractFactory(
          proxyMetadata.abi,
          proxyMetadata.bytecode,
          signer
        );
        let iMSDProxyContract = await iMSDProxyFactory.deploy(
          currentContractAddresses.iMSDImplementationAddress,
          currentContractAddresses.proxyAdminAddress,
          iMSDInitData
        );
        await iMSDProxyContract.deployed();
        currentAssetConfigs[currentiMSDToken]["iMTokenAddress"] =
          iMSDProxyContract.address;
        console.log(
          currentiMSDToken,
          " iMSD token proxy contract address is: ",
          iMSDProxyContract.address
        );
      }
    }

    // 6.0 Deploy oracle.
    const oracleContractName = "PriceOracleV2";
    const oracleArtifactsPath = `browser/artifacts/contracts/${oracleContractName}.sol/${oracleContractName}.json`;
    const oracleMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", oracleArtifactsPath)
    );
    let oracleInitArgs = [
      currentContractAddresses.posterAddress,
      ethers.utils.parseEther(maxSwing.toString()),
    ];

    if (!currentContractAddresses.oracleAddress) {
      console.log("Going to deploy oracle contract!");
      const oracleFactory = new ethers.ContractFactory(
        oracleMetadata.abi,
        oracleMetadata.bytecode,
        signer
      );
      const oracleContract = await oracleFactory.deploy(...oracleInitArgs);
      await oracleContract.deployed();

      currentContractAddresses.oracleAddress = oracleContract.address;
      console.log("Oracle contract address is: ", currentContractAddresses.oracleAddress);
    }

    let oracle = new ethers.Contract(currentContractAddresses.oracleAddress, oracleMetadata.abi, signer);

    // 7.0 Deploy lending data implementation contract.
    const priceTokenAddress = currentAssetConfigs["crt_msd"]["iMTokenAddress"];
    const lendingDataContractName = "LendingDataMini";
    const lendingDataArtifactsPath = `browser/artifacts/contracts/helper/${lendingDataContractName}.sol/${lendingDataContractName}.json`;
    const lendingDataMetadata = JSON.parse(
      await remix.call("fileManager", "getFile", lendingDataArtifactsPath)
    );
    const lendingDataIface = new ethers.utils.Interface(
      lendingDataMetadata.abi
    );
    let lendingDataInitArgs = [priceTokenAddress];

    if (!currentContractAddresses.lendingDataImplAddress) {
      console.log("Going to deploy lending data implementation contract!");
      const lendingDataFactory = new ethers.ContractFactory(
        lendingDataMetadata.abi,
        lendingDataMetadata.bytecode,
        signer
      );
      const lendingDataContract = await lendingDataFactory.deploy(
        ...lendingDataInitArgs
      );
      await lendingDataContract.deployed();

      currentContractAddresses.lendingDataImplAddress = lendingDataContract.address;
      console.log(
        "lending data implementation contract address is: ",
        currentContractAddresses.lendingDataImplAddress
      );
    }

    // 7.1 Deploy lending data proxy contract.
    if (!currentContractAddresses.lendingDataProxyAddress) {
      console.log("Deploy lending data contract proxy");
      const lendingDataInitData = lendingDataIface.encodeFunctionData(
        "initialize",
        [...lendingDataInitArgs]
      );
      console.log("lending initData is: ", lendingDataInitData);

      const lendingDataProxyFactory = new ethers.ContractFactory(
        proxyMetadata.abi,
        proxyMetadata.bytecode,
        signer
      );
      const lendingDataContract = await lendingDataProxyFactory.deploy(
        currentContractAddresses.lendingDataImplAddress,
        currentContractAddresses.proxyAdminAddress,
        lendingDataInitData
      );
      await lendingDataContract.deployed();
      currentContractAddresses.lendingDataProxyAddress = lendingDataContract.address;
      console.log(
        "lendingDataContract proxy contract address is: ",
        currentContractAddresses.lendingDataProxyAddress
      );
    }

    /// ------------------------
    /// Set config in controller
    /// ------------------------

    // 8.0 Sets oracle contract.
    let currentOracle = await controller.priceOracle();
    console.log("current oracle is: ", currentOracle);
    if (currentOracle != currentContractAddresses.oracleAddress) {
      console.log("Going to set oracle in controller contract!");
      tx = await controller._setPriceOracle(currentContractAddresses.oracleAddress);
      await tx.wait(1);

      currentOracle = await controller.priceOracle();
      console.log("after execution, oracle is: ", currentOracle);
    }

    // 8.1 Sets close factor:
    let currentCloseFactor = await controller.closeFactorMantissa();
    let iTokenCloseFactor = currentAssetConfigs["closeFactor"];
    let toSetCloseFactor = ethers.utils.parseEther(iTokenCloseFactor);
    if (currentCloseFactor.toString() != toSetCloseFactor.toString()) {
      console.log("going to set close factor: ", iTokenCloseFactor);
      tx = await controller._setCloseFactor(toSetCloseFactor);
      await tx.wait(1);
      console.log("finish to set close factor\n");
      currentCloseFactor = await controller.closeFactorMantissa();
      console.log(
        "after execution, close factor is: ",
        currentCloseFactor.toString()
      );
    }

    // 8.2 Sets liquidation incentive: liquidationIncentive
    let currentLiquidationIncentive = await controller.liquidationIncentiveMantissa();
    let iTokenLiquidationIncentive = currentAssetConfigs["liquidationIncentive"];
    let toSetLiquidatationIncentive = ethers.utils.parseEther(
      iTokenLiquidationIncentive
    );
    if (
      currentLiquidationIncentive.toString() !=
      toSetLiquidatationIncentive.toString()
    ) {
      console.log(
        "going to set liquidation incentive: ",
        iTokenLiquidationIncentive
      );
      tx = await controller._setLiquidationIncentive(
        toSetLiquidatationIncentive
      );
      await tx.wait(1);
      console.log("finish to set liquidation incentive\n");
      currentLiquidationIncentive = await controller.liquidationIncentiveMantissa();
      console.log(
        "after execution, liquidation incentive is: ",
        currentLiquidationIncentive.toString()
      );
    }

    // 8.3 Set contract guardian.
    let currentPauseGuardian = await controller.pauseGuardian();
    console.log("Current pause guardian is: ", currentPauseGuardian);
    if (currentPauseGuardian != currentContractAddresses.pauseGuardianAddress) {
      console.log("Going to set a pause guardian!");
      tx = await controller._setPauseGuardian(currentContractAddresses.pauseGuardianAddress);
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
      let iTokenContractConfigs = currentAssetConfigs[currentiTokenContract];
      let iTokenAddress = iTokenContractConfigs["iTokenAddress"];
      let hasAdded = await controller.hasiToken(iTokenAddress);
      console.log(
        "Has added ",
        currentiTokenContract,
        " token to market: ",
        hasAdded
      );
      if (!hasAdded) {
        console.log(
          "Going to add ",
          currentiTokenContract,
          " token to the market"
        );
        let collateralFactor = ethers.utils.parseEther(
          iTokenContractConfigs["collateralFactor"]
        );
        let borrowFactor = ethers.utils.parseEther(
          iTokenContractConfigs["borrowFactor"]
        );
        let supplyCapacity = iTokenContractConfigs["supplyCapacity"];
        let borrowCapacity = iTokenContractConfigs["borrowCapacity"];
        let distributionFactor = ethers.utils.parseEther(
          iTokenContractConfigs["distributionFactor"]
        );
        console.log("iTokenAddress", iTokenAddress);
        console.log("collateralFactor", collateralFactor);
        console.log("borrowFactor", borrowFactor);
        console.log("supplyCapacity", supplyCapacity);
        console.log("borrowCapacity", borrowCapacity);
        console.log("distributionFactor", distributionFactor);
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
        console.log(
          "After execution, has added ",
          currentiTokenContract,
          " token to market: ",
          hasAdded
        );
      }
    }

    // 8.5 Add all iMSD tokens to market.
    let toAddiMSDToMarkets = toDeployiMSDTokens;
    let toAddiMSDToMarketsLength = toAddiMSDToMarkets.length;
    for (let i = 0; i < toAddiMSDToMarketsLength; i++) {
      let currentiMSDContract = toAddiMSDToMarkets[i];
      let iMSDContractConfigs = currentAssetConfigs[currentiMSDContract];
      let iMTokenAddress = iMSDContractConfigs["iMTokenAddress"];
      let iMSDHasAdded = await controller.hasiToken(iMTokenAddress);
      console.log(
        "Has added ",
        currentiMSDContract,
        " token to market: ",
        iMSDHasAdded
      );
      if (!iMSDHasAdded) {
        console.log(
          "Going to add ",
          currentiMSDContract,
          " token to the market"
        );
        let iMSDCollateralFactor = ethers.utils.parseEther(
          iMSDContractConfigs["collateralFactor"]
        );
        let iMSDBorrowFactor = ethers.utils.parseEther(
          iMSDContractConfigs["borrowFactor"]
        );
        let iMSDSupplyCapacity = iMSDContractConfigs["supplyCapacity"];
        let iMSDBorrowCapacity = iMSDContractConfigs["borrowCapacity"];
        let iMSDDistributionFactor = ethers.utils.parseEther(
          iMSDContractConfigs["distributionFactor"]
        );
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
        console.log(
          "After execution, has added ",
          currentiMSDContract,
          " token to market: ",
          iMSDHasAdded
        );
      }
    }

    /// ------------------------
    /// Set config in MSD
    /// ------------------------
    // 9.0 Add MSD controller as the only minter
    for (let i = 0; i < toDeployMSDTokensLength; i++) {
      let MSDToken = toDeployMSDTokens[i];
      console.log("\nGoing to set MSD minter: ", MSDToken);
      let MSDTokenAddress = currentAssetConfigs[MSDToken]["msdAddress"];
      let msdContract = new ethers.Contract(
        MSDTokenAddress,
        msdMetadata.abi,
        signer
      );
      let allMinters = await msdContract.getMinters();
      minterIndex = allMinters.indexOf(currentContractAddresses.msdControllerProxyAddress);
      console.log("minterIndex is: ", minterIndex);
      if (minterIndex == -1) {
        console.log("going to set MSD controller as only minter");
        tx = await msdContract._addMinter(currentContractAddresses.msdControllerProxyAddress);
        await tx.wait(1);
        console.log(
          MSDToken,
          " minters in MSD token are:      ",
          await msdContract.getMinters(),
          "\n"
        );
      }
    }

    /// ------------------------
    /// Set config in iMSD
    /// ------------------------
    // 9.1 Sets relationship of MSD and iMSD in the msdController.
    for (let i = 0; i < toDeployMSDTokensLength; i++) {
      let MSDToken = toDeployMSDTokens[i];
      console.log("\nGoing to set relationship of MSD and iMSD in the msdController: ", MSDToken);
      let toAddMSDTokenAddress = currentAssetConfigs[MSDToken]["msdAddress"];
      let toAddiMSDTokenAddress = currentAssetConfigs[MSDToken]["iMTokenAddress"];
      let iMSD_apy = currentAssetConfigs[MSDToken]["borrowAPY"];
      let mintCap = currentAssetConfigs[MSDToken]["mintCap"];
      console.log("toAddMSDTokenAddress", toAddMSDTokenAddress);
      console.log("toAddiMSDTokenAddress", toAddiMSDTokenAddress);

      let allMinters = await msdController.getMSDMinters(toAddMSDTokenAddress);
      let minterIndex = allMinters.indexOf(toAddiMSDTokenAddress);
      if (minterIndex == -1) {
        tx = await msdController._addMSD(
          toAddMSDTokenAddress,
          [toAddiMSDTokenAddress],
          [mintCap]
        );
        await tx.wait(1);
      }

      // 8.2 Sets borrow rate for iMSD token
      let currentBorrowRate = await fixedInterestModel.borrowRatesPerBlock(
        toAddiMSDTokenAddress
      );
      console.log(
        "\niMSD current borrow rate is:  ",
        currentBorrowRate.toString()
      );
      let interestPerDay = Math.pow(iMSD_apy, 1 / 365);
      let actualBorrowRate =
        ((interestPerDay - 1) * 10 ** 18) / (currentContractAddresses.blocksPerYear / 365);
      actualBorrowRate = actualBorrowRate.toFixed();

      if (currentBorrowRate.toString() != actualBorrowRate.toString()) {
        console.log("\nset borrow rate for iMSD token");
        console.log("iMSD to write borrow rate is: ", actualBorrowRate);
        tx = await fixedInterestModel._setBorrowRate(
          toAddiMSDTokenAddress,
          actualBorrowRate
        );
        await tx.wait(1);
        currentBorrowRate = await fixedInterestModel.borrowRatesPerBlock(
          toAddiMSDTokenAddress
        );
        console.log(
          "after setting, iMSD current borrow rate is: ",
          currentBorrowRate.toString()
        );
      }
    }

    console.log("Finish!");
    console.log("Run another script to set distribution speed!");
  } catch (e) {
    console.log(e.message);
  }
}

main()
  .then(() => console.log('DONE'))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
