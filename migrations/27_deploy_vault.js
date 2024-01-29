import { run, sendTransaction, sendTransaction2 } from "./helpers/utils";
import { attachContractAtAdddress, printParam } from "./helpers/contract";
import { deployContracts } from "./helpers/deploy";

const secondPerDay = ethers.utils.parseUnits((24 * 60 * 60).toString(), "wei");
let task = { name: "VaultsPool" };

const network = {
    1: "mainnet",
    56: "bsc",
    42161: "arbitrum",
    42: "kovan",
    10: "optimism",
};

const deployInfo = {
    mainnet: {
        maxSwing: ethers.utils.parseEther("0.1"),
        secondPerBlock: "13",
        vaults: [
            {
                liquidationIncentive: ethers.utils.parseEther("1.04"),
                closeFactor: ethers.utils.parseEther("0.5"),
                pauseGuardian: "0x491C366614b971596cFf5570665DD9d24966de49",
                controller: {
                    key: "controller_USX/3CRV",
                },
                iToken: {
                    key: "iToken_USX/3CRV",
                    underlying: "0x76264772707c8Bc24261516b560cBF3Cbe6F7819",
                    name: "dForce Curve USX/3CRV",
                    symbol: "vCRV USX/3CRV",
                    interestRateModel: "0x8DfBF566566A8F29e86F490594Bd170162EE99fC",
                    priceKey: "aggregatorModel",
                    aggregatorModel: "LPCurveAggregatorModel",
                    collateralFactor: ethers.utils.parseEther("0.92"),
                    borrowFactor: ethers.utils.parseEther("1"),
                    supplyCapacity: ethers.utils.parseEther("10000000"),
                    borrowCapacity: ethers.utils.parseEther("0"),
                    distributionFactor: ethers.utils.parseEther("1"),
                    supplySpeedPerDay: ethers.utils.parseEther("2142.857143"),
                    borrowSpeedPerDay: ethers.utils.parseEther("0"),
                },
                vMUSX: {
                    key: "vMUSX_USX/3CRV",
                    underlying: "0x0a5E677a6A24b2F1A2Bf4F3bFfC443231d2fDEc8",
                    name: "dForce Vault USD",
                    symbol: "vMUSX",
                    feeRatio: ethers.utils.parseEther("0.0001"),
                    priceKey: "price",
                    price: ethers.utils.parseEther("1"),
                    collateralFactor: ethers.utils.parseEther("0"),
                    borrowFactor: ethers.utils.parseEther("1"),
                    supplyCapacity: ethers.utils.parseEther("0"),
                    borrowCapacity: ethers.utils.parseEther("10000000"),
                    distributionFactor: ethers.utils.parseEther("1"),
                    mintCap: ethers.utils.parseEther("10000000"),
                    borrowRate: ethers.utils.parseUnits("2056062391", "wei"),
                    supplySpeedPerDay: ethers.utils.parseEther("0"),
                    borrowSpeedPerDay: ethers.utils.parseEther("0"),
                },
            },
        ],
    },
    bsc: {
        maxSwing: ethers.utils.parseEther("0.1"),
        secondPerBlock: "3",
        vaults: [],
    },
    arbitrum: {
        maxSwing: ethers.utils.parseEther("0.1"),
        secondPerBlock: "13",
        vaults: [
            {
                liquidationIncentive: ethers.utils.parseEther("1.04"),
                closeFactor: ethers.utils.parseEther("0.5"),
                pauseGuardian: "0x491C366614b971596cFf5570665DD9d24966de49",
                controller: {
                    key: "controller_USX/2CRV",
                },
                iToken: {
                    key: "iToken_USX/2CRV",
                    underlying: "0x2ce5Fd6f6F4a159987eac99FF5158B7B62189Acf",
                    name: "dForce Curve USX/2CRV",
                    symbol: "vCRV USX/2CRV",
                    interestRateModel: "0xAF72329e42d0be8bee137Bc3420f20Fc04a49eFb",
                    priceKey: "aggregatorModel",
                    aggregatorModel: "LPCurveAggregatorModel",
                    collateralFactor: ethers.utils.parseEther("0.92"),
                    borrowFactor: ethers.utils.parseEther("1"),
                    supplyCapacity: ethers.utils.parseEther("10000000"),
                    borrowCapacity: ethers.utils.parseEther("0"),
                    distributionFactor: ethers.utils.parseEther("1"),
                    supplySpeedPerDay: ethers.utils.parseEther("3000"),
                    borrowSpeedPerDay: ethers.utils.parseEther("0"),
                },
                vMUSX: {
                    key: "vMUSX_USX/2CRV",
                    underlying: "0x641441c631e2F909700d2f41FD87F0aA6A6b4EDb",
                    name: "dForce Vault USD",
                    symbol: "vMUSX",
                    feeRatio: ethers.utils.parseEther("0.0001"),
                    priceKey: "price",
                    price: ethers.utils.parseEther("1"),
                    collateralFactor: ethers.utils.parseEther("0"),
                    borrowFactor: ethers.utils.parseEther("1"),
                    supplyCapacity: ethers.utils.parseEther("0"),
                    borrowCapacity: ethers.utils.parseEther("10000000"),
                    distributionFactor: ethers.utils.parseEther("1"),
                    mintCap: ethers.utils.parseEther("10000000"),
                    borrowRate: ethers.utils.parseUnits("2056062391", "wei"),
                    supplySpeedPerDay: ethers.utils.parseEther("0"),
                    borrowSpeedPerDay: ethers.utils.parseEther("0"),
                },
            },
            {
                liquidationIncentive: ethers.utils.parseEther("1.07"),
                closeFactor: ethers.utils.parseEther("0.5"),
                pauseGuardian: "0x491C366614b971596cFf5570665DD9d24966de49",
                controller: {
                    key: "controller_iwstETH",
                },
                iToken: {
                    key: "iToken_iwstETH",
                    underlying: "0xa8bAd6CE1937F8e047bcA239Cff1f2224B899b23",
                    name: "dForce iwstETH",
                    symbol: "viwstETH",
                    interestRateModel: "0xbFFA37B585B7AcF7Ed8A93D03506e794A8Ee6d50",
                    priceKey: "aggregatorModel",
                    aggregatorModel: "iTokenAggregatorModel",
                    collateralFactor: ethers.utils.parseEther("0.825"),
                    borrowFactor: ethers.utils.parseEther("1"),
                    supplyCapacity: ethers.utils.parseEther("20000"),
                    borrowCapacity: ethers.utils.parseEther("0"),
                    distributionFactor: ethers.utils.parseEther("1"),
                    supplySpeedPerDay: ethers.utils.parseEther("0"),
                    borrowSpeedPerDay: ethers.utils.parseEther("0"),
                },
                vMUSX: {
                    key: "vMUSX_iwstETH",
                    underlying: "0x641441c631e2F909700d2f41FD87F0aA6A6b4EDb",
                    name: "dForce Vault USD",
                    symbol: "vMUSX",
                    feeRatio: ethers.utils.parseEther("0"),
                    priceKey: "price",
                    price: ethers.utils.parseEther("1"),
                    collateralFactor: ethers.utils.parseEther("0"),
                    borrowFactor: ethers.utils.parseEther("1"),
                    supplyCapacity: ethers.utils.parseEther("0"),
                    borrowCapacity: ethers.utils.parseEther("3000000"),
                    distributionFactor: ethers.utils.parseEther("1"),
                    mintCap: ethers.utils.parseEther("3000000"),
                    borrowRate: ethers.utils.parseUnits("12186263318", "wei"),
                    supplySpeedPerDay: ethers.utils.parseEther("0"),
                    borrowSpeedPerDay: ethers.utils.parseEther("0"),
                },
            },
            {
                liquidationIncentive: ethers.utils.parseEther("1.07"),
                closeFactor: ethers.utils.parseEther("0.5"),
                pauseGuardian: "0x491C366614b971596cFf5570665DD9d24966de49",
                controller: {
                    key: "controller_wstETHCRV-gauge",
                },
                iToken: {
                    key: "iToken_wstETHCRV-gauge",
                    underlying: "0x098EF55011B6B8c99845128114A9D9159777d697",
                    name: "dForce wstETHCRV-gauge",
                    symbol: "vwstETHCRV-gauge",
                    interestRateModel: "0xbFFA37B585B7AcF7Ed8A93D03506e794A8Ee6d50",
                    priceKey: "aggregatorModel",
                    aggregatorModel: "LPCurveGaugeAggregatorModel",
                    collateralFactor: ethers.utils.parseEther("0.70"),
                    borrowFactor: ethers.utils.parseEther("1"),
                    supplyCapacity: ethers.utils.parseEther("50000"),
                    borrowCapacity: ethers.utils.parseEther("0"),
                    distributionFactor: ethers.utils.parseEther("1"),
                    supplySpeedPerDay: ethers.utils.parseEther("0"),
                    borrowSpeedPerDay: ethers.utils.parseEther("0"),
                },
                vMUSX: {
                    key: "vMUSX_wstETHCRV-gauge",
                    underlying: "0x641441c631e2F909700d2f41FD87F0aA6A6b4EDb",
                    name: "dForce Vault USD",
                    symbol: "vMUSX",
                    feeRatio: ethers.utils.parseEther("0"),
                    priceKey: "price",
                    price: ethers.utils.parseEther("1"),
                    collateralFactor: ethers.utils.parseEther("0"),
                    borrowFactor: ethers.utils.parseEther("1"),
                    supplyCapacity: ethers.utils.parseEther("0"),
                    borrowCapacity: ethers.utils.parseEther("3000000"),
                    distributionFactor: ethers.utils.parseEther("1"),
                    mintCap: ethers.utils.parseEther("3000000"),
                    borrowRate: ethers.utils.parseUnits("12186263318", "wei"),
                    supplySpeedPerDay: ethers.utils.parseEther("0"),
                    borrowSpeedPerDay: ethers.utils.parseEther("0"),
                },
            },
        ],
    },
    optimism: {
        maxSwing: ethers.utils.parseEther("0.1"),
        secondPerBlock: "13",
        vaults: [
            {
                liquidationIncentive: ethers.utils.parseEther("1.07"),
                closeFactor: ethers.utils.parseEther("0.5"),
                pauseGuardian: "0x491C366614b971596cFf5570665DD9d24966de49",
                controller: {
                    key: "controller_iwstETH",
                },
                iToken: {
                    key: "iToken_iwstETH",
                    underlying: "0x4B3488123649E8A671097071A02DA8537fE09A16",
                    name: "dForce iwstETH",
                    symbol: "viwstETH",
                    interestRateModel: "0xec85F77104Ffa35a5411750d70eDFf8f1496d95b",
                    priceKey: "aggregatorModel",
                    aggregatorModel: "iTokenAggregatorModel",
                    collateralFactor: ethers.utils.parseEther("0.825"),
                    borrowFactor: ethers.utils.parseEther("1"),
                    supplyCapacity: ethers.utils.parseEther("20000"),
                    borrowCapacity: ethers.utils.parseEther("0"),
                    distributionFactor: ethers.utils.parseEther("1"),
                    supplySpeedPerDay: ethers.utils.parseEther("0"),
                    borrowSpeedPerDay: ethers.utils.parseEther("0"),
                },
                vMUSX: {
                    key: "vMUSX_iwstETH",
                    underlying: "0xbfD291DA8A403DAAF7e5E9DC1ec0aCEaCd4848B9",
                    name: "dForce Vault USD",
                    symbol: "vMUSX",
                    feeRatio: ethers.utils.parseEther("0"),
                    priceKey: "price",
                    price: ethers.utils.parseEther("1"),
                    collateralFactor: ethers.utils.parseEther("0"),
                    borrowFactor: ethers.utils.parseEther("1"),
                    supplyCapacity: ethers.utils.parseEther("0"),
                    borrowCapacity: ethers.utils.parseEther("3000000"),
                    distributionFactor: ethers.utils.parseEther("1"),
                    mintCap: ethers.utils.parseEther("3000000"),
                    borrowRate: ethers.utils.parseUnits("12186263318", "wei"),
                    supplySpeedPerDay: ethers.utils.parseEther("0"),
                    borrowSpeedPerDay: ethers.utils.parseEther("0"),
                },
            },
            {
                liquidationIncentive: ethers.utils.parseEther("1.07"),
                closeFactor: ethers.utils.parseEther("0.5"),
                pauseGuardian: "0x491C366614b971596cFf5570665DD9d24966de49",
                controller: {
                    key: "controller_wstETHCRV-gauge",
                },
                iToken: {
                    key: "iToken_wstETHCRV-gauge",
                    underlying: "0xD53cCBfED6577d8dc82987e766e75E3cb73a8563",
                    name: "dForce wstETHCRV-gauge",
                    symbol: "vwstETHCRV-gauge",
                    interestRateModel: "0xec85F77104Ffa35a5411750d70eDFf8f1496d95b",
                    priceKey: "aggregatorModel",
                    aggregatorModel: "LPCurveGaugeAggregatorModel",
                    collateralFactor: ethers.utils.parseEther("0.70"),
                    borrowFactor: ethers.utils.parseEther("1"),
                    supplyCapacity: ethers.utils.parseEther("50000"),
                    borrowCapacity: ethers.utils.parseEther("0"),
                    distributionFactor: ethers.utils.parseEther("1"),
                    supplySpeedPerDay: ethers.utils.parseEther("0"),
                    borrowSpeedPerDay: ethers.utils.parseEther("0"),
                },
                vMUSX: {
                    key: "vMUSX_wstETHCRV-gauge",
                    underlying: "0xbfD291DA8A403DAAF7e5E9DC1ec0aCEaCd4848B9",
                    name: "dForce Vault USD",
                    symbol: "vMUSX",
                    feeRatio: ethers.utils.parseEther("0"),
                    priceKey: "price",
                    price: ethers.utils.parseEther("1"),
                    collateralFactor: ethers.utils.parseEther("0"),
                    borrowFactor: ethers.utils.parseEther("1"),
                    supplyCapacity: ethers.utils.parseEther("0"),
                    borrowCapacity: ethers.utils.parseEther("3000000"),
                    distributionFactor: ethers.utils.parseEther("1"),
                    mintCap: ethers.utils.parseEther("3000000"),
                    borrowRate: ethers.utils.parseUnits("12186263318", "wei"),
                    supplySpeedPerDay: ethers.utils.parseEther("0"),
                    borrowSpeedPerDay: ethers.utils.parseEther("0"),
                },
            },
        ],
    },    
    kovan: {
        maxSwing: ethers.utils.parseEther("0.1"),
        secondPerBlock: "4",
        vaults: [],
    },
};

async function deployVault(vault) {
    let controller = vault.controller;
    task.contractsToDeploy[controller.key] = {};
    task.contractsToDeploy[controller.key] = {
        contract: "Controller",
        path: "contracts/",
        useProxy: true,
        getArgs: () => [],
    };

    task.contractsToDeploy[`${controller.key}_RewardDistributor`] = {};
    task.contractsToDeploy[`${controller.key}_RewardDistributor`] = {
        contract: "RewardDistributorV3",
        path: "contracts/",
        useProxy: true,
        getArgs: (deployments) => [deployments[controller.key].address],
    };

    let iToken = vault.iToken;
    task.contractsToDeploy[iToken.key] = {};
    task.contractsToDeploy[iToken.key] = {
        contract: "iToken",
        path: "contracts/",
        useProxy: true,
        getArgs: (deployments) => [
            iToken.underlying,
            iToken.name,
            iToken.symbol,
            deployments[controller.key].address,
            iToken.interestRateModel,
        ],
    };

    let vMUSX = vault.vMUSX;
    task.contractsToDeploy[vMUSX.key] = {};
    task.contractsToDeploy[vMUSX.key] = {
        contract: "iMSDMiniPool",
        path: "contracts/MiniPool/",
        useProxy: true,
        getArgs: (deployments) => [
            vMUSX.underlying,
            vMUSX.name,
            vMUSX.symbol,
            deployments[controller.key].address,
            deployments.fixedInterestRateModel.address,
            deployments.msdControllerV2.address,
            deployments[iToken.key].address,
            deployments.treasury.address,
            vMUSX.feeRatio,
        ],
        initializer: "initialize(address,string,string,address,address,address,address,address,uint256)",
    };

    await deployContracts(task);
}

async function deployOther() {
    task.contractsToDeploy = {
        treasury: {
            contract: "Treasury",
            path: "contracts/MiniPool/",
            useProxy: true,
            getArgs: () => [],
        },
        fixedInterestRateModel: {
            contract: "FixedInterestRateModel",
            path: "contracts/InterestRateModel/",
            useProxy: false,
            getArgs: () => [],
        },
        msdControllerV2: {
            contract: "MSDControllerV2",
            path: "contracts/msd/",
            useProxy: true,
            getArgs: () => [],
        },
    };

    await deployContracts(task);
}

async function deployPriceOracle() {
    task.contractsToDeploy = {
        priceOracle: {
            contract: "PriceOracleV2",
            path: "contracts/",
            useProxy: false,
            getArgs: () => [task.signerAddr, deployInfo[network[task.chainId]].maxSwing],
        },
        aggregatorProxy: {
            contract: "AggregatorProxy",
            path: "contracts/aggregatorModelV2/",
            useProxy: false,
            getArgs: () => [],
        },
    };

    await deployContracts(task);
    await setAggregatorProxy();
}

async function deployAggregator(key, contract) {
    if (!task.contractsToDeploy.hasOwnProperty(key)) task.contractsToDeploy[key] = {};

    task.contractsToDeploy[key] = {
        contract: contract,
        path: "contracts/aggregatorModelV2/",
        useProxy: false,
        getArgs: () => [],
    };

    await deployContracts(task);
}

async function setAggregatorProxy() {
    let aggregatorProxy = await task.contracts.priceOracle.aggregatorProxy();
    if (aggregatorProxy == task.contracts.aggregatorProxy.address) return;

    await sendTransaction(task, "priceOracle", "_setAggregatorProxy", [task.deployments.aggregatorProxy.address]);
}

async function setPrices(assets, prices) {
    if (assets.length == 0 || prices.length == 0 || assets.length != prices.length) return;
    await sendTransaction(task, "priceOracle", "setPrices", [assets, prices]);
}

async function getAssetPrices(vaults) {
    let priceOracle = await attachContractAtAdddress(
        task.signer,
        task.deployments.priceOracle.address,
        "IPriceOracle",
        "contracts/interface/"
    );
    let assets = [];
    let prices = [];
    for (let index = 0; index < vaults.length; index++) {
        let asset;
        let price;
        if (vaults[index].vMUSX.priceKey == "price") {
            asset = task.deployments[vaults[index].vMUSX.key].address;
            price = vaults[index].vMUSX.price;
            if (!price.eq(await priceOracle.getUnderlyingPrice(asset))) {
                assets.push(asset);
                prices.push(price);
            }
        }

        if (vaults[index].iToken.priceKey == "price") {
            asset = task.deployments[vaults[index].iToken.key].address;
            price = vaults[index].iToken.price;
            if (!price.eq(await priceOracle.getUnderlyingPrice(asset))) {
                assets.push(asset);
                prices.push(price);
            }
        }
    }
    return { assets: assets, prices: prices };
}

async function getAssetAggregatorModels(vaults) {
    let assets = [];
    let aggregators = [];
    for (let index = 0; index < vaults.length; index++) {
        let asset;
        let aggregator;
        if (vaults[index].vMUSX.priceKey == "aggregatorModel") {
            asset = task.deployments[vaults[index].vMUSX.key].address;
            aggregator = task.deployments[vaults[index].vMUSX.aggregatorModel].address;
            if (aggregator != (await task.contracts.priceOracle.aggregator(asset))) {
                assets.push(asset);
                aggregators.push(aggregator);
            }
        }

        if (vaults[index].iToken.priceKey == "aggregatorModel") {
            asset = task.deployments[vaults[index].iToken.key].address;
            aggregator = task.deployments[vaults[index].iToken.aggregatorModel].address;
            if (aggregator != (await task.contracts.priceOracle.aggregator(asset))) {
                assets.push(asset);
                aggregators.push(aggregator);
            }
        }
    }

    return { assets: assets, aggregators: aggregators };
}

async function getUnderlyingPrices(vaults) {
    let priceOracle = await attachContractAtAdddress(
        task.signer,
        task.deployments.priceOracle.address,
        "IPriceOracle",
        "contracts/interface/"
    );
    let assets = [];
    let prices = [];
    for (let index = 0; index < vaults.length; index++) {
        let asset;
        let price;
        if (vaults[index].vMUSX.priceKey == "price") {
            asset = vaults[index].vMUSX.underlying;
            price = vaults[index].vMUSX.price;
            if (!price.eq(await priceOracle.getUnderlyingPrice(asset)) && !assets.includes(asset)) {
                assets.push(asset);
                prices.push(price);
            }
        }

        if (vaults[index].iToken.priceKey == "price") {
            asset = asset = vaults[index].iToken.underlying;
            price = vaults[index].iToken.price;
            if (!price.eq(await priceOracle.getUnderlyingPrice(asset)) && !assets.includes(asset)) {
                assets.push(asset);
                prices.push(price);
            }
        }
    }
    return { assets: assets, prices: prices };
}

async function getUnderlyingAggregatorModels(vaults) {
    let assets = [];
    let aggregators = [];
    for (let index = 0; index < vaults.length; index++) {
        let asset;
        let aggregator;
        if (vaults[index].vMUSX.priceKey == "aggregatorModel") {
            asset = vaults[index].vMUSX.underlying;
            aggregator = task.deployments[vaults[index].vMUSX.aggregatorModel].address;
            if (aggregator != (await task.contracts.priceOracle.aggregator(asset)) && !assets.includes(asset)) {
                assets.push(asset);
                aggregators.push(aggregator);
            }
        }

        if (vaults[index].iToken.priceKey == "aggregatorModel") {
            asset = asset = vaults[index].iToken.underlying;
            aggregator = task.deployments[vaults[index].iToken.aggregatorModel].address;
            if (aggregator != (await task.contracts.priceOracle.aggregator(asset)) && !assets.includes(asset)) {
                assets.push(asset);
                aggregators.push(aggregator);
            }
        }
    }

    return { assets: assets, aggregators: aggregators };
}

async function setAssetAggregator(assets, assetAggregators) {
    if (assets.length == 0 || assetAggregators.length == 0 || assets.length != assetAggregators.length) return;
    await sendTransaction(task, "priceOracle", "_setAssetAggregatorBatch", [assets, assetAggregators]);
}

async function controllerConfig(controller, vault, target = vault.controller.key) {
    // Set oralce in the controller contract.
    if ((await controller.priceOracle()) != task.deployments.priceOracle.address)
        await sendTransaction2(controller, target, "_setPriceOracle", [task.deployments.priceOracle.address]);

    // Set rewardDistributor in the controller contract.
    if ((await controller.rewardDistributor()) != task.deployments[`${target}_RewardDistributor`].address)
        await sendTransaction2(controller, target, "_setRewardDistributor", [
            task.deployments[`${target}_RewardDistributor`].address,
        ]);

    // Set liquidationIncentive in the controller contract.
    let liquidationIncentive = await controller.liquidationIncentiveMantissa();
    if (!liquidationIncentive.eq(vault.liquidationIncentive))
        await sendTransaction2(controller, target, "_setLiquidationIncentive", [vault.liquidationIncentive]);

    // Set closeFactor in the controller contract.
    let closeFactor = await controller.closeFactorMantissa();
    if (!closeFactor.eq(vault.closeFactor))
        await sendTransaction2(controller, target, "_setCloseFactor", [vault.closeFactor]);

    // Set pauseGuardian in the controller contract.
    if ((await controller.pauseGuardian()) != vault.pauseGuardian)
        await sendTransaction2(controller, target, "_setPauseGuardian", [vault.pauseGuardian]);

    let assets = await controller.getAlliTokens();
    // Add iToken to market.
    let iToken = vault.iToken;
    if (!assets.includes(task.deployments[iToken.key].address))
        await sendTransaction2(controller, target, "_addMarket", [
            task.deployments[iToken.key].address,
            iToken.collateralFactor,
            iToken.borrowFactor,
            iToken.supplyCapacity,
            iToken.borrowCapacity,
            iToken.distributionFactor,
        ]);

    // Add mini USX to market.
    let vMUSX = vault.vMUSX;
    if (!assets.includes(task.deployments[vMUSX.key].address))
        await sendTransaction2(controller, target, "_addMarket", [
            task.deployments[vMUSX.key].address,
            vMUSX.collateralFactor,
            vMUSX.borrowFactor,
            vMUSX.supplyCapacity,
            vMUSX.borrowCapacity,
            vMUSX.distributionFactor,
        ]);
}

async function getMinters(vaults) {
    let minters = {};
    for (let index = 0; index < vaults.length; index++) {
        let underlying = vaults[index].vMUSX.underlying;
        let asset = task.deployments[vaults[index].vMUSX.key].address;
        let mintCap = vaults[index].vMUSX.mintCap;
        if (!mintCap.eq(await task.contracts.msdControllerV2.mintCaps(underlying, asset))) {
            if (!minters.hasOwnProperty(underlying)) {
                minters[underlying] = {};
                minters[underlying].assets = [];
                minters[underlying].mintCaps = [];
            }
            minters[underlying].assets.push(asset);
            minters[underlying].mintCaps.push(mintCap);
        }
    }

    return minters;
}

async function msdControllerConfig(msd, minters, mintCaps) {
    await sendTransaction(task, "msdControllerV2", "_addMinters", [msd, minters, mintCaps]);
}

async function getBorrowRates(vaults) {
    let assets = [];
    let borrowRates = [];
    for (let index = 0; index < vaults.length; index++) {
        let asset = task.deployments[vaults[index].vMUSX.key].address;
        let borrowRate = vaults[index].vMUSX.borrowRate;
        if (!borrowRate.eq(await task.contracts.fixedInterestRateModel.borrowRatesPerBlock(asset))) {
            assets.push(asset);
            borrowRates.push(borrowRate);
        }
    }

    return { assets: assets, borrowRates: borrowRates };
}

async function fixedInterestRateModelConfig(msds, borrowRates) {
    await sendTransaction(task, "fixedInterestRateModel", "_setBorrowRates", [msds, borrowRates]);
}

function calcRewardPerBlock(rewardPerDay) {
    const blocksPerDay = secondPerDay.div(ethers.utils.parseUnits(deployInfo[network[task.chainId]].secondPerBlock, "wei"));
    return rewardPerDay.add(blocksPerDay.sub(1)).div(blocksPerDay);
}

async function getRewardSpeeds(vault) {
    let supplyAssets = [];
    let supplySpeeds = [];

    let borrowAssets = [];
    let borrowSpeeds = [];

    let active = false;
    let rewardDistributor = task.contracts[`${vault.controller.key}_RewardDistributor`];

    let vToken = task.deployments[vault.vMUSX.key].address;
    let vTokenBorrowSpeed = calcRewardPerBlock(vault.vMUSX.borrowSpeedPerDay);
    if (!vTokenBorrowSpeed.eq(await rewardDistributor.distributionSpeed(vToken))) {
        borrowAssets.push(vToken);
        borrowSpeeds.push(vTokenBorrowSpeed);
        active = true;
    }

    let iToken = task.deployments[vault.iToken.key].address;
    let iTokenBorrowSpeed = calcRewardPerBlock(vault.iToken.borrowSpeedPerDay);
    if (!iTokenBorrowSpeed.eq(await rewardDistributor.distributionSpeed(iToken))) {
        borrowAssets.push(iToken);
        borrowSpeeds.push(iTokenBorrowSpeed);
        active = true;
    }

    let iTokenSupplySpeed = calcRewardPerBlock(vault.iToken.supplySpeedPerDay);
    if (!iTokenSupplySpeed.eq(await rewardDistributor.distributionSupplySpeed(iToken))) {
        supplyAssets.push(iToken);
        supplySpeeds.push(iTokenSupplySpeed);
        active = true;
    }

    return {
        active: active,
        rewardDistributor: rewardDistributor,
        supplyAssets: supplyAssets,
        supplySpeeds: supplySpeeds,
        borrowAssets: borrowAssets,
        borrowSpeeds: borrowSpeeds,
    };
}

async function createVault() {
    await deployOther();
    await deployPriceOracle();
    // await deployAggregator("LPCurveAggregatorModel", "LPCurveAggregatorModel");
    await deployAggregator("iTokenAggregatorModel", "iTokenAggregatorModel");

    let vaults = deployInfo[network[task.chainId]].vaults;
    for (let index = 0; index < vaults.length; index++) await deployVault(vaults[index]);

    let assetPrices = await getAssetPrices(vaults);
    let underlyingPrices = await getUnderlyingPrices(vaults);
    await setPrices(
        assetPrices.assets.concat(underlyingPrices.assets),
        assetPrices.prices.concat(underlyingPrices.prices)
    );

    let assetAggregatorModels = await getAssetAggregatorModels(vaults);
    let underlyingAggregatorModels = await getUnderlyingAggregatorModels([]);
    await setAssetAggregator(
        assetAggregatorModels.assets.concat(underlyingAggregatorModels.assets),
        assetAggregatorModels.aggregators.concat(underlyingAggregatorModels.aggregators)
    );

    for (let index = 0; index < vaults.length; index++)
        await controllerConfig(task.contracts[vaults[index].controller.key], vaults[index]);

    let minters = await getMinters(vaults);
    Object.keys(minters).map((token) => {
        printParam(
            [[task.contracts.msdControllerV2, "_addMSD", [token, minters[token].assets, minters[token].mintCaps]]],
            "msdController _addMSD!"
        );
        // await msdControllerConfig(token, minters[token].assets, minters[token].mintCaps);
    });

    let borrowRates = await getBorrowRates(vaults);
    if (borrowRates.assets.length > 0) {
        printParam(
            [[task.contracts.fixedInterestRateModel, "_setBorrowRates", [borrowRates.assets, borrowRates.borrowRates]]],
            "fixedInterestRateModel _setBorrowRates!"
        );
        // await fixedInterestRateModelConfig(borrowRates.assets, borrowRates.borrowRates);
    }

    let distributionSpeed = [];
    await Promise.all(
        Object.values(vaults).map(async (vault) => {
            let res = await getRewardSpeeds(vault);
            if (res.active) {

                distributionSpeed.push([
                    res.rewardDistributor,
                    "_unpause",
                    [res.borrowAssets, res.borrowSpeeds, res.supplyAssets, res.supplySpeeds],
                ]);
                await res.rewardDistributor._unpause(res.borrowAssets, res.borrowSpeeds, res.supplyAssets, res.supplySpeeds);
            }
        })
    );

    if (distributionSpeed.length > 0) printParam(distributionSpeed);
}

run(task, createVault);
