import 'dotenv/config';
import '@nomicfoundation/hardhat-ethers';
import { HardhatUserConfig } from 'hardhat/config';

const privateKey = process.env.DEPLOYER_PRIVATE_KEY || '';

const config: HardhatUserConfig = {
  solidity: '0.8.20',
  networks: {
    fuji: {
      url: process.env.AVALANCHE_FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc',
      chainId: 43113,
      accounts: privateKey ? [privateKey] : []
    }
  }
};

export default config;
