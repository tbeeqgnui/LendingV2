import { run, sendTransaction } from "./helpers/utils";
import { attachContractAtAdddress, printParam } from "./helpers/contract";
import { printArgs2 } from "./helpers/timelock";

let task = { name: "dForceLending" };

const network = {
  1: "mainnet",
  56: "bsc",
  42161: "arbitrum",
  10: "optimism",
  137: "polygon",
  42: "kovan",
  43114: "avalanche",
  2222: "kava",
};
const addressList = {
  mainnet: {
    // '0x4FF0455bcfBB5886607c078E0F43Efb5DE34DeF4': 'proxyAdmin',
    // '0x8B53Ab2c0Df3230EA327017C91Eb909f815Ad113': 'controller',
    // '0x8fAeF85e436a8dd85D8E636Ea22E3b90f1819564': 'rewardDistributor',
    // '0x5ACD75f21659a59fFaB9AEBAf350351a8bfaAbc0': 'iETH',
    // '0x5812fCF91adc502a765E5707eBB3F36a07f63c02': 'iWBTC',
    // '0x44c324970e5CbC5D4C3F3B7604CbC6640C2dcFbF': 'iEUX',
    // '0xA3068AA78611eD29d381E640bb2c02abcf3ca7DE': 'iLINK',
    // '0xbeC9A824D6dA8d0F923FD9fbec4FAA949d396320': 'iUNI',
    // '0x47566acD7af49D2a192132314826ed3c3c5f3698': 'iHBTC',
    // '0x039E7Ef6a674f3EC1D88829B8215ED45385c24bc': 'iMKR',
    // '0x298f243aD592b6027d4717fBe9DeCda668E3c3A8': 'iDAI',
    // '0xb3dc7425e63E1855Eb41107134D471DD34d7b239': 'iDF',
    // '0x4013e6754634ca99aF31b5717Fa803714fA07B35': 'ixBTC',
    // '0x164315EA59169D46359baa4BcC6479bB421764b6': 'iGOLDx',
    // '0x6E6a689a5964083dFf9FD7A0f788BAF620ea2DBe': 'iTUSD',
    // '0x1180c114f7fAdCB6957670432a3Cf8Ef08Ab5354': 'iUSDT',
    // '0x24677e213DeC0Ea53a430404cF4A11a6dc889FCe': 'iBUSD',
    // '0x2f956b2f801c6dad74E87E7f45c94f6283BF0f45': 'iUSDC',
    // '0x1AdC34Af68e970a93062b67344269fD341979eb0': 'iUSX',
    // '0x237C69E082A94d37EBdc92a84b58455872e425d6': 'ixETH',
    // '0xfa2e831c674B61475C175B2206e81A5938B298Dd': 'iMxBTC',
    // '0x028DB7A9d133301bD49f27b5E41F83F56aB0FaA6': 'iMxETH',
    // '0xd1254d280e7504836e1B0E36535eBFf248483cEE': 'iMUSX',
    // '0x4c3F88A792325aD51d8c446e1815DA10dA3D184c': 'iMUSX',
    // '0x591595Bfae3f5d51A820ECd20A1e3FBb6638f34B': 'iMEUX',
    // '0x527Ec46Ac094B399265d1D71Eff7b31700aA655D': 'xBTC',
    // '0x8d2Cb35893C01fa8B564c84Bd540c5109d9D278e': 'xETH',
    // '0x0a5E677a6A24b2F1A2Bf4F3bFfC443231d2fDEc8': 'USX',
    // '0xb986F3a2d91d3704Dc974A24FB735dCc5E3C1E70': 'EUX',
    // '0x45677a101D70E9910C418D9426bC6c5874CE2Fd7': 'msdController',
    // '0x22961D0Ba5150f97AE0F3248b4c415875cBf42d5': 'fixedInterestRateModel',
    // '0x3bA6e5e5dF88b9A88B2c19449778A4754170EA17': 'controller',
    // '0xCf4aD4da361671dC84bE51A6c1131eaf84926E00': 'rewardDistributor',
    // '0xab9C8C81228aBd4687078EBDA5AE236789b08673': 'iEUX',
    // '0xF54954BA7e3cdFDA23941753b48039aB5192AEa0': 'iUSX',
    // '0xa4C13398DAdB3a0A7305647b406ACdCD0689FCC5': 'iMxTSLA',
    // '0xb0ffBD1E81B60C4e8a8E19cEF3A6A92fe18Be86D': 'iMxCOIN',
    // '0xaab2BAb88ceeDCF6788F45885155B278faD09110': 'iMxAMZN',
    // '0x3481E1a5A8014F9C7E03322e4d4532D8ec723409': 'iMxAAPL',
    // '0x32F9063bC2A2A57bCBe26ef662Dc867d5e6446d1': 'xCOIN',
    // '0x966E726853Ca97449F458A3B012318a08B508202': 'xAMZN',
    // '0xc4Ba45BeE9004408403b558a26099134282F2185': 'xAAPL',
    // '0x8dc6987F7D8E5aE9c39F767A324C5e46C1f731eB': 'xTSLA',
    // '0x0965BD5C993a012C7A5f2212E0c95fD1B45e3506': 'statusOracle'
    // '0xe39672DFa87C824BcB3b38aA480ef684687CBC09': 'iCRV',
    // '0x3e5CB932D7A1c0ca096b71Cc486b2aD7e0DC3D0e': 'iAAVE',
    // '0x59055220e00da46C891283EA1d79363c769158b9': 'irenFIL'
    "0x41602ccf9b1F63ea1d0Ab0F0A1D2F4fd0da53f60": "StakeDF",
    "0x6050B7040cF4Ae3e60c3c1A5d0367B565a1460C1": "veDF",
    "0xc0d7f11455aacD225c6fd1Be7dDF0bCf93b31cb3": "veDFManager",
    "0x1D22AFC7dc4Bf336532dd6248d453C647CecA1B3": "Treasury",
    "0x1E96e916A64199069CcEA2E6Cf4D63d30a61b93d": "controller",
    "0x5ebc758AC96316Fb3c80AbFF549962f305A54a30": "rewardDistributor",
    "0xd8d07A8ab4F6a1cC4cF86b3cB11b78A7C1e701ad": "vCRV USX/3CRV",
    "0x53BF3c82f62B152800E0152DB743451849F1aFF9": "vMUSX",
  },
  bsc: {
    // '0x0800604DA276c1D5e9c2C7FEC0e3b43FAb1Ca61a': 'proxyAdmin',
    // '0x0b53E608bD058Bb54748C35148484fD627E6dc0A': 'controller',
    // '0x6fC21a5a767212E8d366B3325bAc2511bDeF0Ef4': 'rewardDistributor',
    // '0xd57E1425837567F74A35d07669B23Bfb67aA4A93': 'iBNB',
    // '0xd957BEa67aaDb8a72061ce94D033C631D1C1E6aC': 'iLTC',
    // '0x983A727Aa3491AB251780A13acb5e876D3f2B1d8': 'iEUX',
    // '0x50E894894809F642de1E11B4076451734c963087': 'iLINK',
    // '0xeC3FD540A2dEE6F479bE539D64da593a59e12D08': 'iDF',
    // '0xeFae8F7AF4BaDa590d4E707D900258fc72194d73': 'iCAKE',
    // '0xAD5Ec11426970c32dA48f58c92b1039bC50e5492': 'iDAI',
    // '0xFc5Bb1E8C29B100Ef8F12773f972477BCab68862': 'iADA',
    // '0xAF9c10b341f55465E8785F0F81DBB52a9Bfe005d': 'iUSDC',
    // '0x6D64eFfe3af8697336Fc57efD5A7517Ad526Dd6d': 'iXRP',
    // '0x55012aD2f0A50195aEF44f403536DF2465009Ef7': 'iATOM',
    // '0x8be8cd81737b282C909F1911f3f0AdE630c335AA': 'iXTZ',
    // '0x5511b64Ae77452C7130670C79298DEC978204a47': 'iBUSD',
    // '0xF649E651afE5F05ae5bA493fa34f44dFeadFE05d': 'ixETH',
    // '0x9747e26c5Ad01D3594eA49ccF00790F564193c15': 'iBCH',
    // '0x0b66A250Dadf3237DdB38d485082a7BfE400356e': 'iBTC',
    // '0x9ab060ba568B86848bF19577226184db6192725b': 'iDOT',
    // '0x390bf37355e9dF6Ea2e16eEd5686886Da6F47669': 'iETH',
    // '0x0BF8C72d618B5d46b055165e21d661400008fa0F': 'iUSDT',
    // '0x7B933e1c1F44bE9Fb111d87501bAADA7C8518aBe': 'iUSX',
    // '0x219B850993Ade4F44E24E6cac403a9a40F1d3d2E': 'ixBTC',
    // '0xee9099C1318cf960651b3196747640EB84B8806b': 'iUNI',
    // '0xc35ACAeEdB814F42B2214378d8950F8555B2D670': 'iGOLDx',
    // '0xD739A569Ec254d6a20eCF029F024816bE58Fb810': 'iFIL',
    // '0x6E42423e1bcB6A093A58E203b5eB6E8A8023b4e5': 'iMxBTC',
    // '0x36f4C36D1F6e8418Ecb2402F896B2A8fEDdE0991': 'iMUSX',
    // '0xee0D3450b577743Eee2793C0Ec6d59361eB9a454': 'iMUSX',
    // '0x6AC0a0B3959C1e5fcBd09b59b09AbF7C53C72346': 'iMxETH',
    // '0xb22eF996C0A2D262a19db2a66A256067f51511Eb': 'iMEUX',
    // '0x20Ecc92F0a33e16e8cf0417DFc3F586cf597F3a9': 'xBTC',
    // '0xB5102CeE1528Ce2C760893034A4603663495fD72': 'USX',
    // '0x463E3D1e01D048FDf872710F7f3745B5CDF50D0E': 'xETH',
    // '0x367c17D19fCd0f7746764455497D63c8e8b2BbA3': 'EUX',
    // '0x4601d9C8dEF18c101496deC0A4864e8751295Bee': 'msdController',
    // '0x0BCb6Be12022c1881031F86C502daA49909b74a1': 'fixedInterestRateModel',
    // '0xb6f29c4507A53A7Ab78d99C1698999dbCf33c800': 'controller',
    // '0xa28F287630184d3b5EeE31a5FE8dB0A63c4A6e2f': 'rewardDistributor',
    // '0x8Af4f25019E00c64B5c9d4A49D71464d411c2199': 'iEUX',
    // '0x911F90e98D5c5C3a3B0c6c37Bf6ea46D15eA6466': 'iUSX',
    // '0x500F397FcEe86eBEE89592b38005ab331De94AfF': 'iMxAMZN',
    // '0x8633cEb128F46a6a8d5b9EceA5161e84127D3c0a': 'iMxAAPL',
    // '0x45055315dfCCBC91aC7107300FAAd7Abb234E7b7': 'iMxTSLA',
    // '0x82279995B210d63fba31790c5C64E3FF5e37d1E0': 'iMxCOIN',
    // '0x0326dA9E3fA36F946CFDC87e59D24B45cbe4aaD0': 'xAMZN',
    // '0x70D1d7cDeC24b16942669A5fFEaDA8527B744502': 'xAAPL',
    // '0x3D9a9ED8A28A64827A684cEE3aa499da1824BF6c': 'xCOIN',
    // '0xf21259B517D307F0dF8Ff3D3F53cF1674EBeAFe8': 'xTSLA',
    // '0x5548Bb3a5bc984a3F196C230C72fDB2917BCbf3a': 'statusOracle'
    "0x959715da68DC2D1329F4bb34e13Da03FE10c374b": "treasury",
    "0x428e1914404dbFf52bD8C7Baed9719cc5eD181be": "controller",
    "0xA2c3996a9DbAFD5B23f5f8f5aa6CAC1B9c346059": "viUSDT",
    "0x870ac6a76A30742800609F205c741E86Db9b71a2": "vMUSX",
    "0x5bedE655e2386AbC49E2Cc8303Da6036bF78564c": "controller",
    "0xc34C5CaCACe9b18e9e996AdBAE658D6fcc103815": "viUSDC",
    "0xA7A084538DE04d808f20C785762934Dd5dA7b3B4": "vMUSX",
    "0x7e7e1d8757b241Aa6791c089314604027544Ce43": "controller",
    "0x295C2D8055b72c9450a980716D165D77EDD7Bc77": "viDAI",
    "0xec85F77104Ffa35a5411750d70eDFf8f1496d95b": "vMUSX",
  },
  arbitrum: {
    // '0xc9aa79F70ac4a11619c649e857D74F517bBFeE47': 'proxyAdmin',
    // '0x8E7e9eA9023B81457Ae7E6D2a51b003D421E5408': 'controller',
    // '0xF45e2ae152384D50d4e9b08b8A1f65F0d96786C3': 'rewardDistributor',
    // '0x0385F851060c09A552F1A28Ea3f612660256cBAA': 'iUSX',
    // '0xEe338313f022caee84034253174FA562495dcC15': 'iETH',
    // '0xD3204E4189BEcD9cD957046A8e4A643437eE0aCC': 'iWBTC',
    // '0x013ee4934ecbFA5723933c4B08EA5E47449802C8': 'iLINK',
    // '0x5675546Eb94c2c256e6d7c3F7DcAB59bEa3B0B8B': 'iEUX',
    // '0x8dc3312c68125a94916d62B97bb5D925f84d4aE0': 'iUSDC',
    // '0xf52f079Af080C9FB5AFCA57DDE0f8B83d49692a9': 'iUSDT',
    // '0xf6995955e4B0E5b287693c221f456951D612b628': 'iDAI',
    // '0xaEa8e2e7C97C5B7Cd545d3b152F669bAE29C4a63': 'iDF',
    // '0x46Eca1482fffb61934C4abCA62AbEB0b12FEb17A': 'iUNI',
    // '0xe8c85B60Cb3bA32369c699015621813fb2fEA56c': 'iMUSX',
    // '0x5BE49B2e04aC55A17c72aC37E3a85D9602322021': 'iMEUX',
    // '0x641441c631e2F909700d2f41FD87F0aA6A6b4EDb': 'USX',
    // '0xC2125882318d04D266720B598d620f28222F3ABd': 'EUX',
    // '0x38a5585d347E8DFc3965C1914498EAfbDeD7c5Ff': 'msdController',
    // '0x96429fD3a3b29C918c3734b86871142aAA6ce2fd': 'fixedInterestRateModel'
    // '0x7702dC73e8f8D9aE95CF50933aDbEE68e9F1D725': 'iAAVE',
    // '0x662da37F0B992F58eF0d9b482dA313a3AB639C0D': 'iCRV'
    "0xc0Dc7C5057141C9065bd9bedf79fd4E9EA69a739": "treasury",
    "0x50210A88217d1dD9e7FBc3E4a927Cc55829a38eB": "controller",
    "0x00b006A1Db650f41aaA367F353572c869b373592": "rewardDistributor",
    "0x3EA2c9daa2aB26dbc0852ea653f99110c335f10a": "vCRV USX/2CRV",
    "0x8A49dbE58CE2D047D3453a3ee4f0F245b7195f67": "vMUSX",
  },
  optimism: {
    // '0x1C4d5eCFBf2AF57251f20a524D0f0c1b4f6ED1C9': 'proxyAdmin',
    // '0xA300A84D8970718Dac32f54F61Bd568142d8BCF4': 'controller',
    // '0x870ac6a76A30742800609F205c741E86Db9b71a2': 'rewardDistributor',
    // '0xA7A084538DE04d808f20C785762934Dd5dA7b3B4': 'iETH',
    // '0x24d30216c07Df791750081c8D77C83cc8b06eB27': 'iWBTC',
    // '0x5bedE655e2386AbC49E2Cc8303Da6036bF78564c': 'iDAI',
    // '0xB344795f0e7cf65a55cB0DDe1E866D46041A2cc2': 'iUSDC',
    // '0x5d05c14D71909F4Fe03E13d486CCA2011148FC44': 'iUSDT',
    // '0x7e7e1d8757b241Aa6791c089314604027544Ce43': 'iUSX',
    // '0xDd40BBa0faD6810A7A09e8Ccca9bCe1E48B28Ece': 'iLINK',
    // '0x94a14Ba6E59f4BE36a77041Ef5590Fe24445876A': 'iMUSX',
    // '0xbfD291DA8A403DAAF7e5E9DC1ec0aCEaCd4848B9': 'USX',
    // '0x9E8B68E17441413b26C2f18e741EAba69894767c': 'msdController',
    // '0xC5b1EC605738eF73a4EFc562274c1c0b6609cF59': 'fixedInterestRateModel'
    // '0x6832364e9538Db15655FA84A497f2927F74A6cE6': 'iDF',
    // '0x7702dC73e8f8D9aE95CF50933aDbEE68e9F1D725': 'OP',
    // '0xED3c20d047D2c57C3C6DD862C9FDd1b353Aff36f': 'iCRV',
    // '0xD65a18dAE68C846297F3038C93deea0B181288d5': 'iAAVE',
    // '0x1f144cD63d7007945292EBCDE14a6Df8628e2Ed7': 'isUSD'
    "0x7B598182875Df02236eEa8a3e264f9376511D5ad": "treasury",
  },
  polygon: {
    // '0x7e2Dc2b896b7AAc98D6ee8e954d3f5bDCC90076b': 'proxyAdmin',
    // '0x52eaCd19E38D501D006D2023C813d7E37F025f37': 'controller',
    // '0x47C19A2ab52DA26551A22e2b2aEED5d19eF4022F': 'rewardDistributor',
    // '0x94a14Ba6E59f4BE36a77041Ef5590Fe24445876A': 'iWBTC',
    // '0x5268b3c4afb0860D365a093C184985FCFcb65234': 'iUSDC',
    // '0xb3ab7148cCCAf66686AD6C1bE24D83e58E6a504e': 'iUSDT',
    // '0xec85F77104Ffa35a5411750d70eDFf8f1496d95b': 'iDAI',
    // '0xc171EBE1A2873F042F1dDdd9327D00527CA29882': 'iUSX',
    // '0x0c92617dF0753Af1CaB2d9Cc6A56173970d81740': 'iWETH',
    // '0x15962427A9795005c640A6BF7f99c2BA1531aD6d': 'iEUX',
    // '0x40BE37096ce3b8A2E9eC002468Ab91071501C499': 'msdController',
    // '0x369Da886fC07B6d5ee5F1bb471d4f8E7833526F9': 'fixedInterestRateModel',
    // '0xCf66EB3D546F0415b368d98A95EAF56DeD7aA752': 'USX',
    // '0x448BBbDB706cD0a6AB74fA3d1157e7A33Dd3A4a8': 'EUX'
    // '0x6A3fE5342a4Bd09efcd44AC5B9387475A0678c74': 'iMATIC',
    // '0x38D0c498698A35fc52a6EB943E47e4A5471Cd6f9': 'iAAVE',
    // '0xcB5D9b6A9BA8eA6FA82660fAA9cC130586F939B2': 'iDF',
    // '0x7D86eE431fbAf60E86b5D3133233E478aF691B68': 'iCRV'
    "0x958b0166B9De547a1998cc06A55c4fa5B4304d0d": "treasury",
  },
  avalanche: {
    "0xdD7A872603453E5f451147E1F689D22Ca3D587A1": "proxyAdmin",
    "0x078ad8d6faeD9DAeE55f5d446C80E0C81230DE6b": "controller",
    "0x73C01B355F2147E5FF315680E068354D6344Eb0b": "iUSX",
    "0xFBf64A8cAEA1D641affa185f850dbBF90d5c84dC": "rewardDistributor",
    "0x853ea32391AaA14c112C645FD20BA389aB25C5e0": "USX",
    "0x654f07ee98022Ec7Ed66DabDC5C0da18868bC2f0": "msdController",
    "0xFd07eE5d6608Be3A7A39734d6674B3f342666756": "fixedInterestRateModel",
    "0x1736Bd778aC995EeFd0c8E9848E18F46d06FcC8d": "controller",
    "0xf6f2E11C6974cb7910Ba17F22a0B40709aCA6cb2": "vMUSX",
    "0x511eE68214890773ad112B15574d08980A83b770": "viUSX",
    "0x2610CC2f20F9F3c1B180b7e8836C8c222a540cc8": "OperatorUSX",
  },
  kava: {
    "0xded0fb0Fd5585140960EAE4d6109d88eceAF1e86": "proxyAdmin",
    "0xFBf64A8cAEA1D641affa185f850dbBF90d5c84dC": "controller",
    "0x9787aF345E765a3fBf0F881c49f8A6830D94A514": "iUSX",
    "0xe04A00B811896f415640b9d5D40256068F2956e6": "iUSDC",
    "0x4522Ce95a9A2bFd474f91827D68De01Adb4c8b33": "iUSDT",
    "0xD37FAe28D8Fb886201f4CFC9eE7777571469398E": "rewardDistributor",
    "0xDb0E1e86B01c4ad25241b1843E407Efc4D615248": "USX",
    "0x853ea32391AaA14c112C645FD20BA389aB25C5e0": "msdController",
    "0x7DA545B2AC13bB89D430E0Ee91452F0479Fd49a5": "fixedInterestRateModel",
    "0xC8e4A88560EabC8027A84bcC5742927BeBcF35C8": "FVcontroller",
    "0x9Ee9Ed4b19100DEb781313D426A43adf2A218AB4": "vMUSX",
    "0x7Ad45b901f4d15a2756E422768D1f4d37dAf96c1": "viUSX",
    "0xcA09A0a386ac213703e7F70f0b468dde39f026BC": "OperatorUSX",
  },
};
const pendingOwner = {
  mainnet: "0x17e66B1e0260C930bfA567ff3ab5c71794279b94",
  bsc: "0x8C3984Fb0F649c304D68DB69457DBF137D156D7a",
  arbitrum: "0x1E96e916A64199069CcEA2E6Cf4D63d30a61b93d",
  optimism: "0x0D535ca4C27f0C25a20e2D474Ee3E99c1316BAfe",
  polygon: "0x1C4d5eCFBf2AF57251f20a524D0f0c1b4f6ED1C9",
  avalanche: "0xB9498979c686f6662D916ceC08A9B759d6783E9C",
  kava: "0x5237d212F9BbC83d91c2cbd810D2b07808d94f08",
};

async function setPendingOwner() {
  let transactions = await Promise.all(
    Object.keys(addressList[network[task.chainId]]).map(async (address) => {
      let contract = await attachContractAtAdddress(
        task.signer,
        address,
        "Ownable",
        "contracts/library/"
      );
      return [
        contract,
        "_setPendingOwner",
        [pendingOwner[network[task.chainId]]],
      ];
    })
  );

  // printParam(transactions, '_setPendingOwner');
  // await printArgs2(task, transactions);

  for ([contract, method, args] of transactions) {
    console.log(`Going to call ${contract}.${method} with args: ${args}`);
    await contract[method](...args);
  }
}

async function acceptOwner() {
  let transactions = await Promise.all(
    Object.keys(addressList[network[task.chainId]]).map(async (address) => {
      let contract = await attachContractAtAdddress(
        task.signer,
        address,
        "Ownable",
        "contracts/library/"
      );
      return [contract, "_acceptOwner", []];
    })
  );

  printParam(transactions, "_acceptOwner");
  await printArgs2(task, transactions);

  for ([contract, method, args] of transactions) {
    console.log(`Going to call ${target}.${method} with args: ${args}`);
    await contract.method(...args);
  }

  let targets = [];
  let values = [];
  let signatures = [];
  let calldatas = [];

  for ([target, _, _] of transactions) {
    targets.push(target.address);
    values.push(0);
    signatures.push("_acceptOwner()");
    calldatas.push("0x");
  }

  await sendTransaction(task, "timelock", "executeTransactions", [
    targets,
    values,
    signatures,
    calldatas,
  ]);
}

run(task, setPendingOwner);
run(task, acceptOwner);
