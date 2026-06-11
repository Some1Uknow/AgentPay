import { getAgentsConfig, NETWORK, sellerWallet } from './real-config';
import { AgentTool } from './types';

export const toolDefinitions: Omit<AgentTool, 'wallet'>[] = [
  {
    agentId: 1,
    name: 'CheapYieldBot',
    description: 'Paid MCP tool that returns Avalanche yield listings from live public data sources.',
    endpoint: '/api/tools/cheap-yield-bot',
    mcpEndpoint: '/mcp/cheap-yield-bot',
    priceAtomic: 5000,
    reputation: 0,
    successfulCalls: 0,
    failedCalls: 0,
    capabilities: ['avalanche-defi-yield-search', 'basic-apy-list'],
    weakness: 'Lower historical reputation signal',
    active: true
  },
  {
    agentId: 2,
    name: 'AvalancheYieldScout',
    description: 'Paid MCP tool that returns Avalanche USDC lending/yield opportunities from live public data sources.',
    endpoint: '/api/tools/yield-scout',
    mcpEndpoint: '/mcp/yield-scout',
    priceAtomic: 30000,
    reputation: 0,
    successfulCalls: 0,
    failedCalls: 0,
    capabilities: ['avalanche-defi-yield-search', 'usdc-lending-analysis'],
    active: true
  },
  {
    agentId: 3,
    name: 'RiskOracleMCP',
    description: 'Paid MCP tool that returns protocol risk signals from live public security/liquidity data sources.',
    endpoint: '/api/tools/risk-oracle',
    mcpEndpoint: '/mcp/risk-oracle',
    priceAtomic: 50000,
    reputation: 0,
    successfulCalls: 0,
    failedCalls: 0,
    capabilities: ['defi-risk-scoring', 'protocol-safety-analysis'],
    active: true
  }
];

export function tools(): AgentTool[] {
  return toolDefinitions.map(t => ({ ...t, wallet: sellerWallet(t.name) }));
}

export function metadataFor(tool: AgentTool) {
  const config = getAgentsConfig();
  const base = config.appUrl;
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: tool.name,
    description: tool.description,
    services: [
      { name: 'MCP', endpoint: `${base}${tool.mcpEndpoint}`, version: '2025-06-18' },
      { name: 'x402-http', endpoint: `${base}${tool.endpoint}`, version: 'v2' }
    ],
    x402Support: true,
    active: tool.active,
    pricing: {
      network: NETWORK,
      asset: config.usdcAddress,
      amountInAtomicUnits: String(tool.priceAtomic),
      display: `${(tool.priceAtomic / 1_000_000).toFixed(3).replace(/0$/, '')} USDC per call`
    },
    capabilities: tool.capabilities,
    registrations: [{ agentId: tool.agentId, agentRegistry: `eip155:43113:${config.identityRegistryAddress}` }],
    supportedTrust: ['reputation']
  };
}

export function toApiTool(tool: AgentTool) {
  return { ...tool, agentURI: `/api/agents/${tool.agentId}`, metadata: metadataFor(tool), pricing: metadataFor(tool).pricing, reputationSummary: { score: tool.reputation, successfulCalls: tool.successfulCalls, failedCalls: tool.failedCalls } };
}
