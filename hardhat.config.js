require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      viaIR: false,
      optimizer: {
        enabled: true,
        runs: 1000
      }
    }
  },
  networks: {
    hardhat: {
      gas: 12000000,
      gasPrice: 8000000000,
      accounts: {
        accountsBalance: "100000000000000000000000000" // 100,000,000 ETH
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  },
  paths: {
    sources: "./blockchain/contracts",
    tests: "./blockchain/test",
    cache: "./blockchain/cache",
    artifacts: "./blockchain/artifacts"
  }
}; 