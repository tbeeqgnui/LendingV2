// Right click on the script name and hit "Run" to execute
(async () => {
    try {
        console.log("Running deployWithEthers script...");

        const abiCoder = new ethers.utils.AbiCoder();
        const zeroAddress = ethers.constants.AddressZero;

        const contractName = "Timelock"; // Change this for other contract
        // Ethereum Mainnet
        // SP interest model
        // let iUSDT = "0x1180c114f7fAdCB6957670432a3Cf8Ef08Ab5354";
        // let iUSDC = "0x2f956b2f801c6dad74E87E7f45c94f6283BF0f45";
        // let iDAI = "0x298f243aD592b6027d4717fBe9DeCda668E3c3A8";
        // // SS interest model
        // let iBUSD = "0x24677e213DeC0Ea53a430404cF4A11a6dc889FCe";
        // let iUSX = "0x1AdC34Af68e970a93062b67344269fD341979eb0";
        // let iEUX = "0x44c324970e5CbC5D4C3F3B7604CbC6640C2dcFbF";
        // let iTUSD = "0x6E6a689a5964083dFf9FD7A0f788BAF620ea2DBe";
        // // MP interest model
        // let iWBTC = "0x5812fCF91adc502a765E5707eBB3F36a07f63c02";
        // let ixBTC = "0x4013e6754634ca99aF31b5717Fa803714fA07B35";
        // let iETH = "0x5ACD75f21659a59fFaB9AEBAf350351a8bfaAbc0";
        // let ixETH = "0x237C69E082A94d37EBdc92a84b58455872e425d6";
        // let iHBTC = "0x47566acD7af49D2a192132314826ed3c3c5f3698";
        // // MS interest model
        // let iGOLDx = "0x164315EA59169D46359baa4BcC6479bB421764b6";
        // let iUNI = "0xbeC9A824D6dA8d0F923FD9fbec4FAA949d396320";
        // let iLINK = "0xA3068AA78611eD29d381E640bb2c02abcf3ca7DE";
        // let iMKR = "0x039E7Ef6a674f3EC1D88829B8215ED45385c24bc";
        // let iDF = "0xb3dc7425e63E1855Eb41107134D471DD34d7b239";

        // let blocksPerYear = "2425846";
        // let interestModelConfigs = {
        //     "StablePrimaryInterestModel": {
        //         "interestModelAddress": "",
        //         "iTokens": [iUSDT,iUSDC,iDAI,iBUSD,iUSX,iEUX,iTUSD],
        //     },
        //     "MainPrimaryInterestModel": {
        //         "interestModelAddress": "",
        //         "iTokens": [iWBTC,ixBTC,iETH,ixETH,iHBTC],
        //     },
        //     "MainSecondaryInterestModel": {
        //         "interestModelAddress": "",
        //         "iTokens": [iGOLDx,iUNI,iLINK,iMKR,iDF],
        //     },
        // };

        // // BSC
        // SP interest model
        // let iUSDT = "0x0BF8C72d618B5d46b055165e21d661400008fa0F";
        // let iUSDC = "0xAF9c10b341f55465E8785F0F81DBB52a9Bfe005d";
        // let iDAI = "0xAD5Ec11426970c32dA48f58c92b1039bC50e5492";
        // let iBUSD = "0x5511b64Ae77452C7130670C79298DEC978204a47";
        // let iUSX = "0x7B933e1c1F44bE9Fb111d87501bAADA7C8518aBe";
        // let iEUX = "0x983A727Aa3491AB251780A13acb5e876D3f2B1d8";
        // // BNBlike
        // let iBNB = "0xd57E1425837567F74A35d07669B23Bfb67aA4A93";
        // let iATOM = "0x55012aD2f0A50195aEF44f403536DF2465009Ef7";
        // let iDOT = "0x9ab060ba568B86848bF19577226184db6192725b";
        // let iFIL = "0xD739A569Ec254d6a20eCF029F024816bE58Fb810";

        // // MP interest model
        // let iWBTC = "0x0b66A250Dadf3237DdB38d485082a7BfE400356e";
        // let ixBTC = "0x219B850993Ade4F44E24E6cac403a9a40F1d3d2E";
        // let iETH = "0x390bf37355e9dF6Ea2e16eEd5686886Da6F47669";
        // let ixETH = "0xF649E651afE5F05ae5bA493fa34f44dFeadFE05d";
        
        // // MS interest model
        // let iGOLDx = "0xc35ACAeEdB814F42B2214378d8950F8555B2D670";
        // let iUNI = "0xee9099C1318cf960651b3196747640EB84B8806b";
        // let iLINK = "0x50E894894809F642de1E11B4076451734c963087";
        // let iDF = "0xeC3FD540A2dEE6F479bE539D64da593a59e12D08";
        // let iADA = "0xFc5Bb1E8C29B100Ef8F12773f972477BCab68862";
        // let iXRP = "0x6D64eFfe3af8697336Fc57efD5A7517Ad526Dd6d";
        // let iLTC = "0xd957BEa67aaDb8a72061ce94D033C631D1C1E6aC";
        // let iBCH = "0x9747e26c5Ad01D3594eA49ccF00790F564193c15";
        // let iXTZ = "0x8be8cd81737b282C909F1911f3f0AdE630c335AA";

        // // CakeLike
        // let iCAKE = "0xeFae8F7AF4BaDa590d4E707D900258fc72194d73";

        // let blocksPerYear = "10512000";
        // let interestModelConfigs = {
        //     "StablePrimaryInterestModel": {
        //         "interestModelAddress": "0x53a03328F24a979999d8eD62dCD438ec6d28AF25",
        //         "iTokens": [iUSDT,iUSDC,iDAI,iBUSD,iUSX,iEUX],
        //     },
        //     // "StableSecondaryInterestModel": {
        //     //     "interestModelAddress": "",
        //     //     "iTokens": [iUSX,iEUX],
        //     // },
        //     "BNBLikeInterestModel": {
        //         "interestModelAddress": "0x9b0FD221C2682A8990b41140a88fDAC2f17C7E27",
        //         "iTokens": [iBNB,iATOM,iDOT,iFIL]
        //     },
        //     "MainPrimaryInterestModel": {
        //         "interestModelAddress": "0xB181F1f928a105CFc6ba487096D6B11142558300",
        //         "iTokens": [iWBTC,ixBTC,iETH,ixETH],
        //     },
        //     "MainSecondaryInterestModel": {
        //         "interestModelAddress": "0x7F3A079b5aE25111ee778a42c00fF1F14CC36FC8",
        //         "iTokens": [iGOLDx,iUNI,iLINK,iDF,iADA,iXRP,iLTC,iBCH,iXTZ],
        //     },
        //     "CakeLikeInterestModel": {
        //         "interestModelAddress": "0x0068afa287993C5498D041E25532476665c7BD25",
        //         "iTokens": [iCAKE],
        //     },
        // };

        // // Arbitrum
        // // SP interest model
        let iUSDT = "0xf52f079Af080C9FB5AFCA57DDE0f8B83d49692a9";
        let iUSDC = "0x8dc3312c68125a94916d62B97bb5D925f84d4aE0";
        // SS interest model
        let iUSX = "0x0385F851060c09A552F1A28Ea3f612660256cBAA";
        let iEUX = "0x5675546Eb94c2c256e6d7c3F7DcAB59bEa3B0B8B";
        // MP interest model
        let iWBTC = "0xD3204E4189BEcD9cD957046A8e4A643437eE0aCC";
        let iETH = "0xEe338313f022caee84034253174FA562495dcC15";
        // MS interest model
        let iUNI = "0x46Eca1482fffb61934C4abCA62AbEB0b12FEb17A";
        let iLINK = "0x013ee4934ecbFA5723933c4B08EA5E47449802C8";
        let iDF = "0xaEa8e2e7C97C5B7Cd545d3b152F669bAE29C4a63";

        let blocksPerYear = "2425846";
        let interestModelConfigs = {
            "StablePrimaryInterestModel": {
                "interestModelAddress": "",
                "iTokens": [iUSDT,iUSDC,iUSX,iEUX],
            },
            "MainPrimaryInterestModel": {
                "interestModelAddress": "",
                "iTokens": [iWBTC,iETH],
            },
            "MainSecondaryInterestModel": {
                "interestModelAddress": "",
                "iTokens": [iUNI,iLINK,iDF],
            },
        };

        let tx;

        let targets = [];
        let values = [];
        let signatures = [];
        let calldatas = [];

        let rewardDistributionContractAddress, signer, owneableMetadata, metadata;
        let timeLockAddress;

        // Ethereum
        timeLockAddress = "0xBB247f5Ac912196A5AA80E9DD6aB252B79D6Ea25";

        // // BSC
        // timeLockAddress = "0x511b05f37e27a88E284322aF0bDE41A91771316d";

        // Note that the script needs the ABI which is generated from the compilation artifact.
        // Make sure contract is compiled and artifacts are generated
        const artifactsPath = `browser/artifacts/contracts/governance/${contractName}.sol/${contractName}.json`; // Change this for different path

        // 'web3Provider' is a remix global variable object
        signer = new ethers.providers.Web3Provider(web3Provider).getSigner();

        metadata = JSON.parse(
        await remix.call("fileManager", "getFile", artifactsPath)
        );

        const timeLock = new ethers.Contract(
            timeLockAddress,
            metadata.abi,
            signer
        );
        console.log("timeLock contract address: ", timeLock.address);

        // 1. Deploy new interest rate model contract.
        const iTokenContractName = "iToken";
        const iTokenArtifactsPath = `browser/artifacts/contracts/${iTokenContractName}.sol/${iTokenContractName}.json`;
        const iTokenMetadata = JSON.parse(
            await remix.call("fileManager", "getFile", iTokenArtifactsPath)
        );

        for (model in interestModelConfigs) {
            const modelName = model;
            const interestModelArtifactsPath = `browser/artifacts/contracts/interestRateModel/InterestRateModelV2.sol/${modelName}.json`;
            const interestModelMetadata = JSON.parse(
                await remix.call("fileManager", "getFile", interestModelArtifactsPath)
            );

            let currentModel = interestModelConfigs[model];
            let interestModelContractAddress = currentModel.interestModelAddress;
            console.log("currentModel", currentModel);
            if (!currentModel.interestModelAddress) {
                console.log("Going to deploy ", model, " interest model contract!");

                // Create an instance of a Contract Factory
                const interestModelFactory = new ethers.ContractFactory(interestModelMetadata.abi, interestModelMetadata.bytecode, signer);
                const interestModelContract = await interestModelFactory.deploy(
                    blocksPerYear
                );
                // The contract is NOT deployed yet; we must wait until it is mined
                await interestModelContract.deployed();
                interestModelContractAddress = interestModelContract.address;
                console.log(model, " interest model contract address: ", interestModelContractAddress);

                currentModel.interestModelAddress = interestModelContract.address;
                console.log("Finish to deploy ", model, " interest model contract!");
            }

            let toSetiTokens = currentModel.iTokens;
            let toSetiTokensLength = toSetiTokens.length;
            for (let i = 0; i < toSetiTokensLength; i++) {
                let iToken = new ethers.Contract(toSetiTokens[i], iTokenMetadata.abi, signer);
                // Update interest to settle interest.
                await iToken.updateInterest();

                let beforeInterestModel = await iToken.interestRateModel();
                console.log("\nbefore set new model, model in iToken is: ", beforeInterestModel);

                if (beforeInterestModel != interestModelContractAddress) {
                    console.log("Going to set new interest model");

                    let data = abiCoder.encode(
                        ["address"],
                        [interestModelContractAddress]
                    );

                    targets.push(toSetiTokens[i]);
                    values.push(0);
                    signatures.push("_setInterestRateModel(address)");
                    calldatas.push(data);

                    await iToken._setInterestRateModel(interestModelContractAddress)
                }
            }
        }

        // return;

        console.log("\ngoing to set new interest model by timelock contract");
        // console.log("\nbefore execute: ", targets, values, signatures, calldatas);
        // await timeLock.executeTransactions(targets, values, signatures, calldatas);
        console.log("Finish!");


    } catch (e) {
        console.log(e.message);
    }
})();
