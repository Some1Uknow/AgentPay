const fs = require('fs');
const dotenv = require('dotenv');
for (const file of ['.env.local', '.env']) {
  if (fs.existsSync(file)) dotenv.config({ path: file, override: false, quiet: true });
}
require('@nomicfoundation/hardhat-ethers');

const privateKey = process.env.DEPLOYER_PRIVATE_KEY || '';

/** @type {import('hardhat/config').HardhatUserConfig} */
const config = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true
    }
  },
  networks: {
    fuji: {
      url: process.env.AVALANCHE_FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc',
      chainId: 43113,
      accounts: privateKey ? [privateKey] : []
    }
  }
};

module.exports = config;
