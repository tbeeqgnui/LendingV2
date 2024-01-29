// Right click on the script name and hit "Run" to execute
(async () => {
    try {
      const network = {
        1: 'mainnet',
        56: 'bsc',
        42161: 'arbitrum',
      };
      let contractAddresses = {
        mainnet: {
          msdControllerImp: "0xd45a90376220237f18eF0B72F31d5683345566db",
          iMSDImp: "0xeb25293808c97f1def991f15f756e00d595520ef",
          MSDController: "0x45677a101D70E9910C418D9426bC6c5874CE2Fd7",
          ProxyAdmin: "0x4FF0455bcfBB5886607c078E0F43Efb5DE34DeF4",
          Timelock: '0xBB247f5Ac912196A5AA80E9DD6aB252B79D6Ea25',
        },
        bsc: {
          msdControllerImp: "0x8C350Ffc15D9848C3061421554A3bA943210332F",
          iMSDImp: "0xd993845bCbaaafe74a2c6d584E42DF4F049ADccD",
          MSDController: "0x4601d9C8dEF18c101496deC0A4864e8751295Bee",
          ProxyAdmin: "0x0800604DA276c1D5e9c2C7FEC0e3b43FAb1Ca61a",
          Timelock: '0x511b05f37e27a88E284322aF0bDE41A91771316d',
        },
        arbitrum: {
          msdControllerImp: "0x5b88565856518c88C1FD4fe5e92F45a0Df3dcF39",
          iMSDImp: "0x06246560298C5EBdDA06aB8be6731B9cf8C72C96",
          MSDController: "0x38a5585d347E8DFc3965C1914498EAfbDeD7c5Ff",
          ProxyAdmin: "0xc9aa79F70ac4a11619c649e857D74F517bBFeE47",
          Timelock: '0xdf00c38AC044Fcfa22B8F3C4fF06f6587FeD0248',
        },
      };
      
      let chainId;
      let signer;
      let msdControllerMetadata;
      let timeLockMetadata;
      let proxyAdminMetadata;
      let imsdMetadata;
      let controllerMetadata;
      if (typeof remix == "object") {
        
        // 'web3Provider' is a remix global variable object
        let provider = new ethers.providers.Web3Provider(web3.currentProvider);
        chainId = (await provider.getNetwork()).chainId;
        signer = await provider.getSigner();
        
        // Note that the script needs the ABI which is generated from the compilation artifact.
        // Make sure contract is compiled and artifacts are generated
        msdControllerMetadata = JSON.parse(
          await remix.call("fileManager", "getFile", "browser/artifacts/contracts/msd/MSDControllerV2.sol/MSDControllerV2.json")
        );

        timeLockMetadata = JSON.parse(
          await remix.call("fileManager", "getFile", "browser/artifacts/contracts/governance/Timelock.sol/Timelock.json")
        );

        proxyAdminMetadata = JSON.parse(
          await remix.call("fileManager", "getFile", "browser/artifacts/contracts/library/ProxyAdmin.sol/ProxyAdmin.json")
        );

        imsdMetadata = JSON.parse(
          await remix.call("fileManager", "getFile", "browser/artifacts/contracts/msd/iMSD.sol/iMSD.json")
        );

        controllerMetadata = JSON.parse(
          await remix.call("fileManager", "getFile", "browser/artifacts/contracts/Controller.sol/Controller.json")
        );

      } else {

        console.log("you are forking");
        
        chainId = 1;
        let owner = "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8";

        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [owner],
        });

        signer = await ethers.provider.getSigner(owner);
        console.log(`deployer: ${signer._address}`);
        
        const MSDControllerV2Factory = await ethers.getContractFactory("MSDControllerV2");
        const msdControllerV2 = await MSDControllerV2Factory.connect(signer).deploy();
        await msdControllerV2.deployed();
        contractAddresses[network[chainId]].msdControllerImp = msdControllerV2.address;
        console.log(`msdControllerV2 implementation is: ${msdControllerV2.address}`);

        const iMSDFactory = await ethers.getContractFactory("iMSD");
        const imsd = await iMSDFactory.connect(signer).deploy();
        await imsd.deployed();
        contractAddresses[network[chainId]].iMSDImp = imsd.address;
        console.log(`imsd implementation is: ${imsd.address}`);

        owner = "0xbD206d0677BEf61f3abA309f84473fCF5C44C880";

        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [owner],
        });

        signer = await ethers.provider.getSigner(owner);

        msdControllerMetadata = require("../artifacts/contracts/msd/MSDControllerV2.sol/MSDControllerV2.json");
        timeLockMetadata = require("../artifacts/contracts/governance/Timelock.sol/Timelock.json");
        proxyAdminMetadata = require("../artifacts/contracts/library/ProxyAdmin.sol/ProxyAdmin.json");
        imsdMetadata = require("../artifacts/contracts/msd/iMSD.sol/iMSD.json");
        controllerMetadata = require("../artifacts/contracts/Controller.sol/Controller.json");
      }
      console.log(`Running ${network[chainId]} upgrade MSDControllerV2 and iMSD implementation script...`);
      console.log(`owner: ${await signer.getAddress()}`);

      const msdController = new ethers.Contract(contractAddresses[network[chainId]].MSDController, msdControllerMetadata.abi, signer);
      console.log(`msdController contract address: ${msdController.address}`);

      let msdList = await msdController.getAllMSDs();
      console.log("msdController msd List is: ", msdList);

      const abiCoder = new ethers.utils.AbiCoder();
      let imsdList = [];
      let mintCapInfo = {};
      let imsdCap = {};
      let iMSD;
      let controller;
      
      let targets = [];
      let values = [];
      let signatures = [];
      let calldatas = [];
      let data;
      for (let index = 0; index < msdList.length; index++) {

        mintCapInfo[msdList[index]] = {};
        mintCapInfo[msdList[index]].imsdList = await msdController.getMSDMinters(msdList[index]);
        mintCapInfo[msdList[index]].mintCaps = [];

        for (let i = 0; i < mintCapInfo[msdList[index]].imsdList.length; i++) {

          iMSD = new ethers.Contract(mintCapInfo[msdList[index]].imsdList[i], imsdMetadata.abi, signer);
          controller = new ethers.Contract(await iMSD.controller(), controllerMetadata.abi, signer);
          let borrowCapacity = (await controller.markets(iMSD.address)).borrowCapacity;
          mintCapInfo[msdList[index]].mintCaps.push(borrowCapacity);
          imsdCap[iMSD.address] = borrowCapacity;
        }

        imsdList.push(...mintCapInfo[msdList[index]].imsdList);
        data = abiCoder.encode(
          ["address"],
          [msdList[index]]
        );

        targets.push(msdController.address);
        values.push(0);
        signatures.push("calcEquity(address)");
        calldatas.push(data);
      }
      console.log("msdController minter List is: ", imsdList);
      console.log("mint cap info is: ", mintCapInfo);

      data = abiCoder.encode(
        ["address", "address"],
        [msdController.address, contractAddresses[network[chainId]].msdControllerImp]
      );
      targets.push(contractAddresses[network[chainId]].ProxyAdmin);
      values.push(0);
      signatures.push("upgrade(address,address)");
      calldatas.push(data);

      for (let index = 0; index < msdList.length; index++) {
        data = abiCoder.encode(
          ["address", "address[]", "uint256[]"],
          [
            msdList[index],
            mintCapInfo[msdList[index]].imsdList,
            mintCapInfo[msdList[index]].mintCaps,
          ]
        );

        targets.push(msdController.address);
        values.push(0);
        signatures.push("_setMintCaps(address,address[],uint256[])");
        calldatas.push(data);
      }

      for (let index = 0; index < imsdList.length; index++) {
        data = abiCoder.encode(
          ["address", "address"],
          [imsdList[index], contractAddresses[network[chainId]].iMSDImp]
        );

        targets.push(contractAddresses[network[chainId]].ProxyAdmin);
        values.push(0);
        signatures.push("upgrade(address,address)");
        calldatas.push(data);

        data = abiCoder.encode(
          ["uint256"],
          [ethers.utils.parseEther("1")]
        );

        targets.push(imsdList[index]);
        values.push(0);
        signatures.push("_setNewReserveRatio(uint256)");
        calldatas.push(data);
      }

      console.log(targets);
      console.log(values);
      console.log(signatures);
      console.log(calldatas);

      data = abiCoder.encode(
        ["address[]", "uint256[]", "string[]", "bytes[]"],
        [targets, values, signatures, calldatas]
      );

      console.log(`transaction data: ${"0x4bc24c89" + data.slice(2)}`);

      const timeLock = new ethers.Contract(contractAddresses[network[chainId]].Timelock, timeLockMetadata.abi, signer);
      console.log(`timeLock contract address: ${timeLock.address}`);

       let tx = await timeLock.executeTransactions(targets, values, signatures, calldatas);
       await tx.wait(1);

      const proxyAdmin = new ethers.Contract(contractAddresses[network[chainId]].ProxyAdmin, proxyAdminMetadata.abi, signer);
      console.log(`Proxy admin contract address: ${proxyAdmin.address}`);

      const msdControllerImp = await proxyAdmin.getProxyImplementation(msdController.address);
      console.log(`msdController address is:    ${msdController.address}\n`);
      console.log(`new implementation is:       ${msdControllerImp}`);
      console.log(`expected implementation is:  ${contractAddresses[network[chainId]].msdControllerImp}\n`);

      for (let index = 0; index < imsdList.length; index++) {
        iMSD = new ethers.Contract(imsdList[index], imsdMetadata.abi, signer);
        const symbol = await iMSD.symbol();
        const reserveRatio = await iMSD.reserveRatio();
        const iMSDImp = await proxyAdmin.getProxyImplementation(imsdList[index]);
        const mintCaps = await msdController.mintCaps(await iMSD.underlying(), iMSD.address);

        console.log(`${symbol} address is:        ${imsdList[index]}`);
        console.log(`new implementation is:       ${iMSDImp}`);
        console.log(`expected implementation is:  ${contractAddresses[network[chainId]].iMSDImp}`);

        console.log(`mint caps is:          ${mintCaps.toString()}`);
        console.log(`expected mint caps is: ${imsdCap[iMSD.address]}`);

        console.log(`reserveRatio is:          ${reserveRatio.toString()}`);
        console.log(`expected reserveRatio is: ${ethers.utils.parseEther("1").toString()}\n`);
      }

      console.log("Finish!");
    } catch (e) {
      console.log(e.message);
    }
  })();
