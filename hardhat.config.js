require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-contract-sizer");

const testAccounts = require("./testAccounts.json");

const privateKey = process.env.PRIVATE_KEY;
const infuraKey = process.env.INFURA_KEY;
const alchemyKey = process.env.ALCHEMY_KEY;

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  mocha: { timeout: 2000000 },
  networks: {
    localhost: {
      hardfork: "istanbul",
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      accounts: testAccounts,
    },
    // hardhat: {
    //   forking: {
    //     url: `https://eth-mainnet.alchemyapi.io/v2/${alchemyKey}`,
    //     blockNumber: 12651421
    //   }
    // },
    "truffle-dashboard": {
      url: "http://localhost:24012/rpc",
      timeout: 200000,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${infuraKey}`,
      accounts: [`0x${privateKey}`],
      gas: 8000000,
      gasPrice: 1000000000, // 1gWei
      timeout: 200000,
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${infuraKey}`,
      accounts: [`0x${privateKey}`],
      gas: 8000000,
      gasPrice: 1000000000, // 1gWei
      timeout: 200000,
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${infuraKey}`,
      accounts: [`0x${privateKey}`],
      gas: 8000000,
    },
    bsc_test: {
      url: `https://data-seed-prebsc-2-s1.binance.org:8545/`,
      accounts: [`0x${privateKey}`],
      gas: 8000000,
      gasPrice: 20000000000, // 20gWei
    },
    bsc: {
      url: `https://rpc.ankr.com/bsc`,
      accounts: [`0x${privateKey}`],
      gas: 8000000,
      gasPrice: 10000000000, // 10gWei
    },
    arbitrum: {
      // url: `https://arbitrum-mainnet.infura.io/v3/${infuraKey}`,
      url: `https://arb1.arbitrum.io/rpc`,
      accounts: [`0x${privateKey}`],
      gas: 8000000,
      gasPrice: 10000000000, // 10gWei
    },
    optimistic_kovan: {
      url: `https://kovan.optimism.io`,
      accounts: [`0x${privateKey}`],
      gasPrice: 15000000,
      ovm: true,
    },
    optimistic_ethereum: {
      url: `https://rpc.ankr.com/optimism`,
      accounts: [`0x${privateKey}`],
      gasPrice: 15000000,
      ovm: true,
    },
    polygon: {
      url: `https://polygon-rpc.com/`,
      accounts: [`0x${privateKey}`],
      gasPrice: 15000000,
    },
    tenderly: {
      url: `https://rpc.tenderly.co/fork/${process.env.TENDERLY_FORK_ID}`,
      accounts: [`0x${privateKey}`],
      gas: 8000000,
    },
    confluxeSpaceTestnet: {
      url: "https://evmtestnet.confluxrpc.com",
      accounts: [`0x${privateKey}`],
    },
    confluxeSpace: {
      url: "https://evm.confluxrpc.com",
      accounts: [`0x${privateKey}`],
    },
    lineaTestnet: {
      url: "https://rpc.goerli.linea.build/",
      accounts: [`0x${privateKey}`],
    },
    scrollAlphaTestnet: {
      url: "https://alpha-rpc.scroll.io/l2",
      accounts: [`0x${privateKey}`],
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  // TODO: there is an unexpected case when tries to verify contracts, so do not use it at now!!!
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY,
    customChains: [
      {
        network: "confluxeSpaceTestnet",
        chainId: 71,
        urls: {
          apiURL: "https://evmapi-testnet.confluxscan.net/api",
          browserURL: "https://evmtestnet.confluxscan.net",
        },
      },
      {
        network: "confluxeSpace",
        chainId: 1030,
        urls: {
          apiURL: "https://evmapi.confluxscan.net/api",
          browserURL: "https://evm.confluxscan.net",
        },
      },
    ],
  },
  react: {
    providerPriority: ["hardhat", "web3modal"],
  },
  gasReporter: {
    currency: "USD",
    enabled: false,
    coinmarketcap: process.env.COINMARKET_API,
  },
};
