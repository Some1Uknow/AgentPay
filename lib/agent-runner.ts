import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';
import { ethers } from 'ethers';
import { buyerAccount, getFeedbackConfig, NETWORK } from './real-config';
import { toApiTool, tools } from './tools';
import { attachOnchainReputation } from './onchain-reputation';

const reputationAbi = [
  'function giveFeedback(uint256 agentId,int128 value,uint8 valueDecimals,string tag1,string tag2,string endpoint,string feedbackURI,bytes32 feedbackHash) external',
  'function recordSuccessfulCall(uint256 agentId,bytes32 paymentRef) external'
];

function stableJson(value: unknown) {
  return JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
}

function paymentRefFor(toolName: string, paymentResponse: unknown, response: unknown) {
  return ethers.keccak256(ethers.toUtf8Bytes(stableJson({ toolName, paymentResponse, response })));
}

function findTxHash(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  for (const key of ['txHash', 'transactionHash', 'transaction', 'hash']) {
    const candidate = obj[key];
    if (typeof candidate === 'string' && candidate.startsWith('0x')) return candidate;
  }
  for (const nested of Object.values(obj)) {
    const found = findTxHash(nested);
    if (found) return found;
  }
  return null;
}

function validateDeliveredWork(toolName: string, response: any) {
  if (!response || response.tool !== toolName) return { ok: false, reason: 'tool response identity mismatch' };
  if (toolName === 'RiskOracleMCP') return { ok: Array.isArray(response.protocols) && response.protocols.length > 0, reason: 'risk protocols returned' };
  return { ok: Array.isArray(response.opportunities) && response.opportunities.length > 0, reason: 'yield opportunities returned' };
}

function capabilityMatch(toolCaps: string[], task: string) {
  const lower = task.toLowerCase();
  if (toolCaps.includes('defi-risk-scoring') && (lower.includes('safest') || lower.includes('risk'))) return 0.96;
  if (toolCaps.includes('avalanche-defi-yield-search') && lower.includes('yield')) return 0.95;
  if (toolCaps.includes('basic-apy-list')) return 0.72;
  return 0.35;
}

export async function scoreTools(task: string) {
  const currentTools = await attachOnchainReputation(tools());
  const maxPrice = Math.max(...currentTools.map(t => t.priceAtomic));
  return currentTools.map(tool => {
    const capability = capabilityMatch(tool.capabilities, task);
    const normalizedReputation = tool.reputation / 5;
    const normalizedPriceScore = 1 - tool.priceAtomic / maxPrice;
    const score = capability * 0.45 + normalizedReputation * 0.35 + normalizedPriceScore * 0.20;
    return { ...toApiTool(tool), scoring: { capabilityMatch: Number(capability.toFixed(2)), normalizedReputation: Number(normalizedReputation.toFixed(2)), normalizedPriceScore: Number(normalizedPriceScore.toFixed(2)), score: Number(score.toFixed(3)) } };
  }).sort((a, b) => b.scoring.score - a.scoring.score);
}

export async function callPaidTool(origin: string, tool: Awaited<ReturnType<typeof scoreTools>>[number], payload: unknown) {
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: NETWORK, client: new ExactEvmScheme(buyerAccount()) }]
  });
  const response = await fetchWithPayment(`${origin}${tool.endpoint}`, { method: 'POST', body: JSON.stringify(payload), headers: { 'content-type': 'application/json' } });
  const data = await response.json();
  if (!response.ok) throw new Error(`Real x402 paid call failed for ${tool.name}: ${JSON.stringify(data)}`);
  const paymentHeader = response.headers.get('PAYMENT-RESPONSE');
  const paymentResponse = paymentHeader ? decodePaymentResponseHeader(paymentHeader) : null;
  return { response: data, paymentResponse };
}

async function writeReputationUpdate(tool: Awaited<ReturnType<typeof scoreTools>>[number], response: unknown, paymentResponse: unknown) {
  const validation = validateDeliveredWork(tool.name, response);
  if (!validation.ok) throw new Error(`Delivered work validation failed for ${tool.name}: ${validation.reason}`);

  const config = getFeedbackConfig();
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.feedbackPrivateKey, provider);
  const reputation = new ethers.Contract(config.reputationRegistryAddress, reputationAbi, wallet);
  const paymentRef = paymentRefFor(tool.name, paymentResponse, response);
  const feedbackBody = {
    agentId: tool.agentId,
    tool: tool.name,
    endpoint: tool.endpoint,
    paymentRef,
    txHash: findTxHash(paymentResponse),
    validation,
    ratingValue: 5,
    tag1: 'paid-call',
    tag2: 'x402-autonomous-agent'
  };
  const feedbackHash = ethers.keccak256(ethers.toUtf8Bytes(stableJson(feedbackBody)));

  const callTx = await reputation.recordSuccessfulCall(BigInt(tool.agentId), paymentRef);
  const callReceipt = await callTx.wait();
  const feedbackTx = await reputation.giveFeedback(BigInt(tool.agentId), 5n, 0, 'paid-call', 'x402-autonomous-agent', tool.endpoint, '', feedbackHash);
  const feedbackReceipt = await feedbackTx.wait();

  return {
    agentId: tool.agentId,
    name: tool.name,
    paymentRef,
    paymentTxHash: findTxHash(paymentResponse),
    successfulCallTxHash: callReceipt?.hash,
    feedbackTxHash: feedbackReceipt?.hash,
    validation,
    update: 'Recorded successful paid call and 5/5 feedback on Avalanche Fuji reputation registry.'
  };
}

export async function runAgent(origin: string, task: string, maxBudgetAtomic = 100000) {
  const discoveredTools = await scoreTools(task);
  const selectedTools = discoveredTools.filter(t => ['AvalancheYieldScout', 'RiskOracleMCP'].includes(t.name));
  const total = selectedTools.reduce((sum, t) => sum + t.priceAtomic, 0);
  if (total > maxBudgetAtomic) throw new Error('Selected tools exceed max budget');

  const calls = [];
  for (const tool of selectedTools) {
    const paidCall = await callPaidTool(origin, tool, { task });
    const reputationUpdate = await writeReputationUpdate(tool, paidCall.response, paidCall.paymentResponse);
    calls.push({ tool, ...paidCall, reputationUpdate });
  }

  return {
    task,
    discoveredTools,
    selectedTools: selectedTools.map(t => ({ ...t, reason: t.name === 'AvalancheYieldScout' ? 'Best reputation-adjusted current Avalanche USDC yield data.' : 'Highest reputation risk oracle for safety checks.' })),
    rejectedTools: discoveredTools.filter(t => t.name === 'CheapYieldBot').map(t => ({ ...t, reason: 'Not selected for this task because specialized yield and risk tools matched better.' })),
    payments: calls.map(c => ({
      ...((c.paymentResponse || {}) as object),
      agentId: c.tool.agentId,
      tool: c.tool.name,
      txHash: findTxHash(c.paymentResponse),
      amount: String(c.tool.priceAtomic),
      asset: c.tool.pricing.asset,
      network: NETWORK,
      paymentRef: c.reputationUpdate.paymentRef
    })),
    reputationUpdates: calls.map(c => c.reputationUpdate),
    toolResponses: Object.fromEntries(calls.map(c => [c.tool.name, c.response])),
    result: 'Autonomous flow completed: tools were selected by score, paid via x402, validated, and reputation was updated on Avalanche Fuji.',
    totalSpentAtomic: String(total),
    totalSpentDisplay: `${(total / 1_000_000).toFixed(2)} USDC`,
    network: 'Avalanche Fuji (eip155:43113)'
  };
}
