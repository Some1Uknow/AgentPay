const fs = require('fs');
const dotenv = require('dotenv');
for (const file of ['.env.local', '.env']) {
  if (fs.existsSync(file)) dotenv.config({ path: file, override: false, quiet: true });
}
const { ethers } = require('ethers');

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
const required = [
  'NEXT_PUBLIC_APP_URL',
  'AVALANCHE_FUJI_RPC',
  'OPENAI_API_KEY',
  'X402_FACILITATOR_URL',
  'USDC_ADDRESS',
  'BUYER_PRIVATE_KEY',
  'CHEAPYIELDBOT_WALLET',
  'AVALANCHEYIELDSCOUT_WALLET',
  'RISKORACLEMCP_WALLET',
  'DEPLOYER_PRIVATE_KEY',
  'FEEDBACK_PRIVATE_KEY',
  'IDENTITY_REGISTRY_ADDRESS',
  'REPUTATION_REGISTRY_ADDRESS',
  'VALIDATION_REGISTRY_ADDRESS'
];
const addresses = new Set(['USDC_ADDRESS', 'CHEAPYIELDBOT_WALLET', 'AVALANCHEYIELDSCOUT_WALLET', 'RISKORACLEMCP_WALLET', 'IDENTITY_REGISTRY_ADDRESS', 'REPUTATION_REGISTRY_ADDRESS', 'VALIDATION_REGISTRY_ADDRESS']);
const privateKeys = new Set(['BUYER_PRIVATE_KEY', 'DEPLOYER_PRIVATE_KEY', 'FEEDBACK_PRIVATE_KEY']);
const secrets = new Set([...privateKeys, 'OPENAI_API_KEY']);
const urls = new Set(['NEXT_PUBLIC_APP_URL', 'AVALANCHE_FUJI_RPC', 'X402_FACILITATOR_URL']);

function valid(key, value) {
  if (!value) return false;
  if (addresses.has(key)) return ethers.isAddress(value) && value !== ADDRESS_ZERO;
  if (privateKeys.has(key)) return /^0x[a-fA-F0-9]{64}$/.test(value);
  if (urls.has(key)) return /^https?:\/\//.test(value);
  return true;
}
function mask(value = '') {
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}
async function main() {
  console.log('\nAgentPay demo status\n');
  const missing = [];
  const invalid = [];
  for (const key of required) {
    const value = process.env[key];
    const ok = valid(key, value);
    if (!value) missing.push(key);
    else if (!ok) invalid.push(key);
    console.log(`${ok ? '✅' : '❌'} ${key}${value ? ` = ${secrets.has(key) ? mask(value) : value}` : ' is missing'}`);
  }
  const model = process.env.OPENAI_MODEL || 'gpt-4.1';
  console.log(`✅ OPENAI_MODEL = ${model}`);
  if (missing.length || invalid.length) {
    console.log('\nFix missing/invalid envs before running the real demo.');
    if (missing.length) console.log('Missing:', missing.join(', '));
    if (invalid.length) console.log('Invalid:', invalid.join(', '));
    process.exitCode = 1;
    return;
  }

  const provider = new ethers.JsonRpcProvider(process.env.AVALANCHE_FUJI_RPC);
  const network = await provider.getNetwork();
  console.log(`\nChain: ${network.name} (${network.chainId})`);
  if (network.chainId !== 43113n) {
    console.log('❌ RPC is not Avalanche Fuji / chainId 43113');
    process.exitCode = 1;
  } else {
    console.log('✅ RPC is Avalanche Fuji');
  }

  for (const [label, pk] of [['buyer', process.env.BUYER_PRIVATE_KEY], ['deployer', process.env.DEPLOYER_PRIVATE_KEY], ['feedback', process.env.FEEDBACK_PRIVATE_KEY]]) {
    const wallet = new ethers.Wallet(pk, provider);
    const balance = await provider.getBalance(wallet.address);
    console.log(`${balance > 0n ? '✅' : '⚠️ '} ${label} ${wallet.address} AVAX balance: ${ethers.formatEther(balance)}`);
  }

  for (const [label, address] of [['USDC/token', process.env.USDC_ADDRESS], ['identity registry', process.env.IDENTITY_REGISTRY_ADDRESS], ['reputation registry', process.env.REPUTATION_REGISTRY_ADDRESS], ['validation registry', process.env.VALIDATION_REGISTRY_ADDRESS]]) {
    const code = await provider.getCode(address);
    console.log(`${code !== '0x' ? '✅' : '❌'} ${label} has contract code at ${address}`);
    if (code === '0x') process.exitCode = 1;
  }

  const identityAbi = ['function nextAgentId() view returns (uint256)', 'function getAgentURI(uint256) view returns (string)'];
  const repAbi = ['function getIdentityRegistry() view returns (address)', 'function getReputation(uint256) view returns (uint256,uint256,int256,uint256)', 'function getClients(uint256) view returns (address[])'];
  const validationAbi = ['function getIdentityRegistry() view returns (address)', 'function getSummary(uint256,address[],string) view returns (uint64,uint8)'];
  try {
    const identity = new ethers.Contract(process.env.IDENTITY_REGISTRY_ADDRESS, identityAbi, provider);
    const nextAgentId = await identity.nextAgentId();
    console.log(`${nextAgentId >= 4n ? '✅' : '⚠️ '} identity nextAgentId = ${nextAgentId} ${nextAgentId >= 4n ? '(3 tools registered)' : '(run deploy script or register tools)'}`);
    for (let i = 1; i <= 3; i++) console.log(`   agent ${i} URI: ${await identity.getAgentURI(i)}`);
  } catch (error) {
    console.log('❌ identity registry read failed:', error.message);
    process.exitCode = 1;
  }
  try {
    const rep = new ethers.Contract(process.env.REPUTATION_REGISTRY_ADDRESS, repAbi, provider);
    const repIdentity = await rep.getIdentityRegistry();
    console.log(`${repIdentity.toLowerCase() === process.env.IDENTITY_REGISTRY_ADDRESS.toLowerCase() ? '✅' : '❌'} reputation registry identity link: ${repIdentity}`);
    for (let i = 1; i <= 3; i++) {
      const [ok, failed, total, count] = await rep.getReputation(i);
      console.log(`✅ reputation ${i}: successful=${ok} failed=${failed} totalRating=${total} ratingCount=${count}`);
    }
  } catch (error) {
    console.log('❌ reputation registry read failed:', error.message);
    process.exitCode = 1;
  }
  try {
    const validation = new ethers.Contract(process.env.VALIDATION_REGISTRY_ADDRESS, validationAbi, provider);
    const validationIdentity = await validation.getIdentityRegistry();
    console.log(`${validationIdentity.toLowerCase() === process.env.IDENTITY_REGISTRY_ADDRESS.toLowerCase() ? '✅' : '❌'} validation registry identity link: ${validationIdentity}`);
  } catch (error) {
    console.log('❌ validation registry read failed:', error.message);
    process.exitCode = 1;
  }

  console.log('\nIf everything above is ✅, run `npm run dev` and open the UI.');
}
main().catch((error) => {
  console.error('\nStatus check failed:', error);
  process.exit(1);
});
