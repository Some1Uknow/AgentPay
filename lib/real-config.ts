import { privateKeyToAccount } from 'viem/accounts';

export const NETWORK = 'eip155:43113' as const;

type Address = `0x${string}`;
type EnvKey =
  | 'NEXT_PUBLIC_APP_URL'
  | 'AVALANCHE_FUJI_RPC'
  | 'X402_FACILITATOR_URL'
  | 'USDC_ADDRESS'
  | 'BUYER_PRIVATE_KEY'
  | 'CHEAPYIELDBOT_WALLET'
  | 'AVALANCHEYIELDSCOUT_WALLET'
  | 'RISKORACLEMCP_WALLET'
  | 'DEPLOYER_PRIVATE_KEY'
  | 'FEEDBACK_PRIVATE_KEY'
  | 'IDENTITY_REGISTRY_ADDRESS'
  | 'REPUTATION_REGISTRY_ADDRESS';

const ENV: Record<EnvKey, string | undefined> = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  AVALANCHE_FUJI_RPC: process.env.AVALANCHE_FUJI_RPC,
  X402_FACILITATOR_URL: process.env.X402_FACILITATOR_URL,
  USDC_ADDRESS: process.env.USDC_ADDRESS,
  BUYER_PRIVATE_KEY: process.env.BUYER_PRIVATE_KEY,
  CHEAPYIELDBOT_WALLET: process.env.CHEAPYIELDBOT_WALLET,
  AVALANCHEYIELDSCOUT_WALLET: process.env.AVALANCHEYIELDSCOUT_WALLET,
  RISKORACLEMCP_WALLET: process.env.RISKORACLEMCP_WALLET,
  DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY,
  FEEDBACK_PRIVATE_KEY: process.env.FEEDBACK_PRIVATE_KEY,
  IDENTITY_REGISTRY_ADDRESS: process.env.IDENTITY_REGISTRY_ADDRESS,
  REPUTATION_REGISTRY_ADDRESS: process.env.REPUTATION_REGISTRY_ADDRESS
};

const TOOL_WALLET_ENVS = {
  CheapYieldBot: 'CHEAPYIELDBOT_WALLET',
  AvalancheYieldScout: 'AVALANCHEYIELDSCOUT_WALLET',
  RiskOracleMCP: 'RISKORACLEMCP_WALLET'
} as const;

const ADDRESS_KEYS: EnvKey[] = [
  'USDC_ADDRESS',
  'CHEAPYIELDBOT_WALLET',
  'AVALANCHEYIELDSCOUT_WALLET',
  'RISKORACLEMCP_WALLET',
  'IDENTITY_REGISTRY_ADDRESS',
  'REPUTATION_REGISTRY_ADDRESS'
];

const PRIVATE_KEY_KEYS: EnvKey[] = [
  'BUYER_PRIVATE_KEY',
  'DEPLOYER_PRIVATE_KEY',
  'FEEDBACK_PRIVATE_KEY'
];

const AGENTS_REQUIRED_ENVS: EnvKey[] = [
  'AVALANCHE_FUJI_RPC',
  'USDC_ADDRESS',
  'CHEAPYIELDBOT_WALLET',
  'AVALANCHEYIELDSCOUT_WALLET',
  'RISKORACLEMCP_WALLET',
  'IDENTITY_REGISTRY_ADDRESS',
  'REPUTATION_REGISTRY_ADDRESS'
];

const PAYMENT_SERVER_REQUIRED_ENVS: EnvKey[] = ['X402_FACILITATOR_URL'];

const RUN_AGENT_REQUIRED_ENVS: EnvKey[] = [
  ...AGENTS_REQUIRED_ENVS,
  'BUYER_PRIVATE_KEY',
  'X402_FACILITATOR_URL',
  'FEEDBACK_PRIVATE_KEY'
];

const FEEDBACK_REQUIRED_ENVS: EnvKey[] = [
  'AVALANCHE_FUJI_RPC',
  'FEEDBACK_PRIVATE_KEY',
  'REPUTATION_REGISTRY_ADDRESS'
];

function isHexAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isPrivateKey(value: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function isHttpUrl(value: string) {
  return /^https?:\/\//.test(value);
}

function isValidValue(key: EnvKey, value: string) {
  if (ADDRESS_KEYS.includes(key)) return isHexAddress(value);
  if (PRIVATE_KEY_KEYS.includes(key)) return isPrivateKey(value);
  if (key === 'X402_FACILITATOR_URL' || key === 'NEXT_PUBLIC_APP_URL' || key === 'AVALANCHE_FUJI_RPC') return isHttpUrl(value);
  return true;
}

export class ConfigError extends Error {
  code = 'CONFIG_ERROR' as const;

  constructor(
    public scope: string,
    public missing: EnvKey[],
    public invalid: EnvKey[],
    public hint = 'Fill the missing values in .env.local or .env before running this real-only Fuji demo.'
  ) {
    const parts = [
      missing.length ? `missing ${missing.join(', ')}` : '',
      invalid.length ? `invalid ${invalid.join(', ')}` : ''
    ].filter(Boolean);
    super(`Configuration error for ${scope}: ${parts.join('; ')}.`);
  }
}

export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError;
}

function checkEnv(keys: EnvKey[]) {
  const missing: EnvKey[] = [];
  const invalid: EnvKey[] = [];

  for (const key of keys) {
    const value = ENV[key];
    if (!value) {
      missing.push(key);
      continue;
    }
    if (!isValidValue(key, value)) invalid.push(key);
  }

  return { missing, invalid, ok: missing.length === 0 && invalid.length === 0 };
}

function validateEnv(keys: EnvKey[], scope: string) {
  const result = checkEnv(keys);
  if (!result.ok) throw new ConfigError(scope, result.missing, result.invalid);
}

export function apiErrorBody(error: unknown, fallback: string) {
  if (isConfigError(error)) {
    return {
      error: error.message,
      code: error.code,
      scope: error.scope,
      missing: error.missing,
      invalid: error.invalid,
      hint: error.hint
    };
  }

  return { error: error instanceof Error ? error.message : fallback };
}

export function requiredEnv(name: EnvKey) {
  validateEnv([name], `env:${name}`);
  return ENV[name]!;
}

export function optionalEnv(name: EnvKey) {
  return ENV[name];
}

export function getPublicAppUrl() {
  const value = ENV.NEXT_PUBLIC_APP_URL;
  if (!value) return 'http://localhost:3000';
  if (!isValidValue('NEXT_PUBLIC_APP_URL', value)) throw new ConfigError('public app url', [], ['NEXT_PUBLIC_APP_URL']);
  return value;
}

export function getAgentsConfig() {
  validateEnv(AGENTS_REQUIRED_ENVS, 'agent catalog');
  return {
    network: NETWORK,
    rpcUrl: ENV.AVALANCHE_FUJI_RPC!,
    appUrl: getPublicAppUrl(),
    usdcAddress: ENV.USDC_ADDRESS as Address,
    identityRegistryAddress: ENV.IDENTITY_REGISTRY_ADDRESS as Address,
    reputationRegistryAddress: ENV.REPUTATION_REGISTRY_ADDRESS as Address,
    sellerWallets: {
      CheapYieldBot: ENV.CHEAPYIELDBOT_WALLET as Address,
      AvalancheYieldScout: ENV.AVALANCHEYIELDSCOUT_WALLET as Address,
      RiskOracleMCP: ENV.RISKORACLEMCP_WALLET as Address
    }
  };
}

export function getPaymentServerConfig() {
  validateEnv(PAYMENT_SERVER_REQUIRED_ENVS, 'x402 resource server');
  return { facilitatorUrl: ENV.X402_FACILITATOR_URL! };
}

export function getRunAgentConfig() {
  validateEnv(RUN_AGENT_REQUIRED_ENVS, 'agent runner');
  return {
    ...getAgentsConfig(),
    facilitatorUrl: ENV.X402_FACILITATOR_URL!,
    buyerPrivateKey: ENV.BUYER_PRIVATE_KEY as `0x${string}`,
    feedbackPrivateKey: ENV.FEEDBACK_PRIVATE_KEY!
  };
}

export function getFeedbackConfig() {
  validateEnv(FEEDBACK_REQUIRED_ENVS, 'feedback writer');
  return {
    rpcUrl: ENV.AVALANCHE_FUJI_RPC!,
    feedbackPrivateKey: ENV.FEEDBACK_PRIVATE_KEY!,
    reputationRegistryAddress: ENV.REPUTATION_REGISTRY_ADDRESS as Address
  };
}

export function getOnchainReputationConfig() {
  validateEnv(['AVALANCHE_FUJI_RPC', 'REPUTATION_REGISTRY_ADDRESS'], 'onchain reputation');
  return { rpcUrl: ENV.AVALANCHE_FUJI_RPC!, reputationRegistryAddress: ENV.REPUTATION_REGISTRY_ADDRESS as Address };
}

export function getDemoReadiness() {
  const sections = [
    { name: 'agent catalog', required: AGENTS_REQUIRED_ENVS },
    { name: 'x402 resource server', required: PAYMENT_SERVER_REQUIRED_ENVS },
    { name: 'autonomous agent runner', required: RUN_AGENT_REQUIRED_ENVS },
    { name: 'onchain feedback writer', required: FEEDBACK_REQUIRED_ENVS }
  ].map(section => ({ name: section.name, ...checkEnv(section.required) }));

  return {
    ok: sections.every(section => section.ok),
    network: NETWORK,
    sections,
    requirements: {
      avalancheFuji: checkEnv(['AVALANCHE_FUJI_RPC']).ok,
      x402Payments: checkEnv(['X402_FACILITATOR_URL', 'USDC_ADDRESS', 'BUYER_PRIVATE_KEY']).ok,
      erc8004Identity: checkEnv(['IDENTITY_REGISTRY_ADDRESS']).ok,
      erc8004Reputation: checkEnv(['REPUTATION_REGISTRY_ADDRESS', 'FEEDBACK_PRIVATE_KEY']).ok,
      sellerWallets: checkEnv(['CHEAPYIELDBOT_WALLET', 'AVALANCHEYIELDSCOUT_WALLET', 'RISKORACLEMCP_WALLET']).ok
    }
  };
}

export function assetAddress() {
  return getAgentsConfig().usdcAddress;
}

export function facilitatorUrl() {
  return getPaymentServerConfig().facilitatorUrl;
}

export function buyerAccount() {
  return privateKeyToAccount(getRunAgentConfig().buyerPrivateKey as `0x${string}`);
}

export function sellerWallet(toolName: string) {
  const key = TOOL_WALLET_ENVS[toolName as keyof typeof TOOL_WALLET_ENVS];
  if (!key) throw new Error(`Unknown tool name ${toolName} when resolving seller wallet.`);
  validateEnv([key], `seller wallet for ${toolName}`);
  return ENV[key] as Address;
}
