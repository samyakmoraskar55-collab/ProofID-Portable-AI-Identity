require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const MONAD_TESTNET_RPC = process.env.MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    monad_testnet: {
      url: MONAD_TESTNET_RPC,
      chainId: 10143,
      accounts: DEPLOYER_PRIVATE_KEY !== "0x000..." ? [DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
