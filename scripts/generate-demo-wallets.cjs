const { ethers } = require('ethers');

const buyer = ethers.Wallet.createRandom();
const deployer = ethers.Wallet.createRandom();
const feedback = ethers.Wallet.createRandom();
const cheap = ethers.Wallet.createRandom();
const scout = ethers.Wallet.createRandom();
const risk = ethers.Wallet.createRandom();

console.log(`# Throwaway Avalanche Fuji demo wallets generated at ${new Date().toISOString()}`);
console.log('# Fund BUYER/DEPLOYER/FEEDBACK addresses with Fuji AVAX. Fund BUYER with the facilitator-supported token too.');
console.log(`BUYER_PRIVATE_KEY=${buyer.privateKey}`);
console.log(`# BUYER_ADDRESS=${buyer.address}`);
console.log(`DEPLOYER_PRIVATE_KEY=${deployer.privateKey}`);
console.log(`# DEPLOYER_ADDRESS=${deployer.address}`);
console.log(`FEEDBACK_PRIVATE_KEY=${feedback.privateKey}`);
console.log(`# FEEDBACK_ADDRESS=${feedback.address}`);
console.log(`CHEAPYIELDBOT_WALLET=${cheap.address}`);
console.log(`AVALANCHEYIELDSCOUT_WALLET=${scout.address}`);
console.log(`RISKORACLEMCP_WALLET=${risk.address}`);
