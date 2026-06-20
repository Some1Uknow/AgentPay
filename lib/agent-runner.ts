import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, stepCountIs, tool } from 'ai';
import { ethers } from 'ethers';
import { z } from 'zod';
import { buyerAccount, getAiAgentConfig, getFeedbackConfig, getValidationConfig, NETWORK } from './real-config';
import { toApiTool, tools } from './tools';
import { attachOnchainReputation } from './onchain-reputation';
import { AllowancePolicy, DecisionTraceEntry } from './types';

const reputationAbi = [
  'function giveFeedback(uint256 agentId,int128 value,uint8 valueDecimals,string tag1,string tag2,string endpoint,string feedbackURI,bytes32 feedbackHash) external',
  'function recordSuccessfulCall(uint256 agentId,bytes32 paymentRef) external'
];

const validationAbi = [
  'function validationRequest(address validatorAddress,uint256 agentId,string requestURI,bytes32 requestHash) external',
  'function validationResponse(bytes32 requestHash,uint8 response,string responseURI,bytes32 responseHash,string tag) external'
];

export const DEFAULT_ALLOWANCE_POLICY: AllowancePolicy = {
  maxBudgetAtomic: 100000,
  minReputation: 4,
  allowedCapabilities: ['avalanche-defi-yield-search', 'defi-risk-scoring'],
  maxTools: 2
};

export class AllowancePolicyError extends Error {
  code = 'ALLOWANCE_POLICY_BLOCKED' as const;
}

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

async function writeValidationProof(tool: Awaited<ReturnType<typeof scoreTools>>[number], response: unknown, paymentResponse: unknown, validation: { ok: boolean; reason: string }) {
  const config = getValidationConfig();
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const requester = new ethers.NonceManager(new ethers.Wallet(config.deployerPrivateKey, provider));
  const validator = new ethers.NonceManager(new ethers.Wallet(config.feedbackPrivateKey, provider));
  const validationFromRequester = new ethers.Contract(config.validationRegistryAddress, validationAbi, requester);
  const validationFromValidator = new ethers.Contract(config.validationRegistryAddress, validationAbi, validator);
  const requestBody = { agentId: tool.agentId, tool: tool.name, endpoint: tool.endpoint, paymentResponse, response, validation };
  const requestHash = ethers.keccak256(ethers.toUtf8Bytes(stableJson(requestBody)));
  const responseHash = ethers.keccak256(ethers.toUtf8Bytes(stableJson({ requestHash, ok: validation.ok, reason: validation.reason })));
  const requestTx = await validationFromRequester.validationRequest(await validator.getAddress(), BigInt(tool.agentId), '', requestHash);
  const requestReceipt = await requestTx.wait();
  const responseTx = await validationFromValidator.validationResponse(requestHash, validation.ok ? 100 : 0, '', responseHash, 'x402-paid-api-response');
  const responseReceipt = await responseTx.wait();

  return {
    agentId: tool.agentId,
    name: tool.name,
    requestHash,
    responseHash,
    score: validation.ok ? 100 : 0,
    tag: 'x402-paid-api-response',
    requestTxHash: requestReceipt?.hash,
    responseTxHash: responseReceipt?.hash
  };
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

function formatUsdc(atomic: number) {
  return `${(atomic / 1_000_000).toFixed(atomic >= 10000 ? 2 : 3)} USDC`;
}

function normalizeAllowancePolicy(input: Partial<AllowancePolicy> = {}): AllowancePolicy {
  const maxBudgetAtomic = Number(input.maxBudgetAtomic ?? DEFAULT_ALLOWANCE_POLICY.maxBudgetAtomic);
  const minReputation = Number(input.minReputation ?? DEFAULT_ALLOWANCE_POLICY.minReputation);
  const maxTools = Number(input.maxTools ?? DEFAULT_ALLOWANCE_POLICY.maxTools);
  const allowedCapabilities = Array.isArray(input.allowedCapabilities) && input.allowedCapabilities.length
    ? input.allowedCapabilities.map(String)
    : DEFAULT_ALLOWANCE_POLICY.allowedCapabilities;

  if (!Number.isFinite(maxBudgetAtomic) || maxBudgetAtomic <= 0) throw new Error('Allowance policy maxBudgetAtomic must be a positive number.');
  if (!Number.isFinite(minReputation) || minReputation < 0 || minReputation > 5) throw new Error('Allowance policy minReputation must be between 0 and 5.');
  if (!Number.isInteger(maxTools) || maxTools <= 0) throw new Error('Allowance policy maxTools must be a positive integer.');

  return { maxBudgetAtomic, minReputation, allowedCapabilities, maxTools };
}

function evaluateToolsForPolicy(
  discoveredTools: Awaited<ReturnType<typeof scoreTools>>,
  policy: AllowancePolicy
) {
  const selectedTools: typeof discoveredTools = [];
  const rejectedTools: Array<typeof discoveredTools[number] & { reason: string; rejectionReasons: string[] }> = [];
  const decisionTrace: DecisionTraceEntry[] = [];
  let remaining = policy.maxBudgetAtomic;

  for (const tool of discoveredTools) {
    const matchedCapabilities = tool.capabilities.filter(capability => policy.allowedCapabilities.includes(capability));
    const reasons: string[] = [];
    const capabilityPolicyPass = matchedCapabilities.length > 0;
    const reputationPolicyPass = Number(tool.reputation) >= policy.minReputation;
    const budgetPolicyPass = tool.priceAtomic <= remaining;
    const maxToolsPolicyPass = selectedTools.length < policy.maxTools;

    if (capabilityPolicyPass) reasons.push(`Capability match: ${matchedCapabilities.join(', ')}.`);
    else reasons.push(`No allowed capability match. Allowed: ${policy.allowedCapabilities.join(', ')}.`);

    if (reputationPolicyPass) reasons.push(`Reputation ${Number(tool.reputation).toFixed(1)}/5 meets minimum ${policy.minReputation}.`);
    else reasons.push(`Reputation ${Number(tool.reputation).toFixed(1)}/5 is below minimum ${policy.minReputation}.`);

    if (budgetPolicyPass) reasons.push(`Price ${formatUsdc(tool.priceAtomic)} fits remaining allowance ${formatUsdc(remaining)}.`);
    else reasons.push(`Price ${formatUsdc(tool.priceAtomic)} exceeds remaining allowance ${formatUsdc(remaining)}.`);

    if (!maxToolsPolicyPass) reasons.push(`Max tool count ${policy.maxTools} already reached.`);

    const policyPass = capabilityPolicyPass && reputationPolicyPass && budgetPolicyPass && maxToolsPolicyPass && tool.active;
    const action = policyPass ? 'selected' : 'rejected';

    decisionTrace.push({
      agentId: tool.agentId,
      name: tool.name,
      action,
      capabilityMatch: capabilityPolicyPass,
      matchedCapabilities,
      priceAtomic: tool.priceAtomic,
      budgetRemainingBefore: remaining,
      reputation: Number(tool.reputation),
      policyPass,
      reasons
    });

    if (policyPass) {
      selectedTools.push(tool);
      remaining -= tool.priceAtomic;
    } else {
      rejectedTools.push({ ...tool, reason: reasons.join(' '), rejectionReasons: reasons });
    }
  }

  return { selectedTools, rejectedTools, decisionTrace };
}

function policyCheckForTool(
  toolToCheck: Awaited<ReturnType<typeof scoreTools>>[number],
  policy: AllowancePolicy,
  remaining: number,
  paidCount: number
) {
  const matchedCapabilities = toolToCheck.capabilities.filter(capability => policy.allowedCapabilities.includes(capability));
  const reasons: string[] = [];
  const capabilityPolicyPass = matchedCapabilities.length > 0;
  const reputationPolicyPass = Number(toolToCheck.reputation) >= policy.minReputation;
  const budgetPolicyPass = toolToCheck.priceAtomic <= remaining;
  const maxToolsPolicyPass = paidCount < policy.maxTools;

  if (capabilityPolicyPass) reasons.push(`Capability match: ${matchedCapabilities.join(', ')}.`);
  else reasons.push(`No allowed capability match. Allowed: ${policy.allowedCapabilities.join(', ')}.`);

  if (reputationPolicyPass) reasons.push(`Reputation ${Number(toolToCheck.reputation).toFixed(1)}/5 meets minimum ${policy.minReputation}.`);
  else reasons.push(`Reputation ${Number(toolToCheck.reputation).toFixed(1)}/5 is below minimum ${policy.minReputation}.`);

  if (budgetPolicyPass) reasons.push(`Price ${formatUsdc(toolToCheck.priceAtomic)} fits remaining allowance ${formatUsdc(remaining)}.`);
  else reasons.push(`Price ${formatUsdc(toolToCheck.priceAtomic)} exceeds remaining allowance ${formatUsdc(remaining)}.`);

  if (maxToolsPolicyPass) reasons.push(`Paid tool count ${paidCount}/${policy.maxTools} leaves room for this call.`);
  else reasons.push(`Max paid tool count ${policy.maxTools} already reached.`);

  if (!toolToCheck.active) reasons.push('Tool is inactive.');

  const policyPass = capabilityPolicyPass && reputationPolicyPass && budgetPolicyPass && maxToolsPolicyPass && toolToCheck.active;
  return { policyPass, reasons, matchedCapabilities };
}

function publicToolView(toolToShow: Awaited<ReturnType<typeof scoreTools>>[number]) {
  return {
    agentId: toolToShow.agentId,
    name: toolToShow.name,
    description: toolToShow.description,
    endpoint: toolToShow.endpoint,
    priceAtomic: toolToShow.priceAtomic,
    priceDisplay: toolToShow.pricing.display,
    reputation: Number(toolToShow.reputation),
    successfulCalls: Number(toolToShow.successfulCalls || 0),
    failedCalls: Number(toolToShow.failedCalls || 0),
    capabilities: toolToShow.capabilities,
    active: toolToShow.active,
    scoring: toolToShow.scoring
  };
}

function requiresPaidToolFlow(task: string) {
  const normalized = task.trim().toLowerCase();
  if (!normalized) return false;

  const casualPatterns = [
    /^(hi|hey|hello|yo|gm|good\s+(morning|afternoon|evening))[\s!.?]*$/,
    /^(thanks|thank you|ok|okay|cool|nice|great)[\s!.?]*$/,
    /^(what can you do|help|how does this work|who are you)[\s?!.]*$/
  ];
  if (casualPatterns.some(pattern => pattern.test(normalized))) return false;

  const paidTaskKeywords = [
    'yield',
    'apy',
    'avalanche',
    'defi',
    'risk',
    'safest',
    'protocol',
    'lending',
    'borrow',
    'vault',
    'liquidity',
    'usdc',
    'x402',
    'payment',
    'pay',
    'spend',
    'hire',
    'tool',
    'provider',
    'reputation',
    'onchain',
    'fuji',
    'transaction',
    'tx'
  ];

  return paidTaskKeywords.some(keyword => normalized.includes(keyword));
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
  let validationUpdate: Awaited<ReturnType<typeof writeValidationProof>> | {
    agentId: number;
    name: string;
    requestHash: null;
    responseHash: null;
    score: number;
    tag: string;
    requestTxHash: null;
    responseTxHash: null;
    error: string;
  };
  try {
    validationUpdate = await writeValidationProof(tool, response, paymentResponse, validation);
  } catch (error) {
    validationUpdate = {
      agentId: tool.agentId,
      name: tool.name,
      requestHash: null,
      responseHash: null,
      score: validation.ok ? 100 : 0,
      tag: 'x402-paid-api-response',
      requestTxHash: null,
      responseTxHash: null,
      error: error instanceof Error ? error.message : 'Validation registry write failed'
    };
  }

  const config = getFeedbackConfig();
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.feedbackPrivateKey, provider);
  const managedWallet = new ethers.NonceManager(wallet);
  const reputation = new ethers.Contract(config.reputationRegistryAddress, reputationAbi, managedWallet);
  const paymentRef = paymentRefFor(tool.name, paymentResponse, response);
  const feedbackBody = {
    agentId: tool.agentId,
    tool: tool.name,
    endpoint: tool.endpoint,
    paymentRef,
    txHash: findTxHash(paymentResponse),
    validationRequestHash: validationUpdate.requestHash,
    validationResponseTxHash: validationUpdate.responseTxHash,
    validation,
    ratingValue: 5,
    tag1: 'paid-call',
    tag2: 'x402-autonomous-agent'
  };
  const feedbackHash = ethers.keccak256(ethers.toUtf8Bytes(stableJson(feedbackBody)));

  const callTx = await reputation.recordSuccessfulCall(BigInt(tool.agentId), paymentRef);
  const feedbackTx = await reputation.giveFeedback(BigInt(tool.agentId), 5n, 0, 'paid-call', 'x402-autonomous-agent', tool.endpoint, '', feedbackHash);
  const [callReceipt, feedbackReceipt] = await Promise.all([callTx.wait(), feedbackTx.wait()]);

  return {
    agentId: tool.agentId,
    name: tool.name,
    paymentRef,
    paymentTxHash: findTxHash(paymentResponse),
    successfulCallTxHash: callReceipt?.hash,
    feedbackTxHash: feedbackReceipt?.hash,
    validationUpdate,
    validation,
    update: 'Recorded validation, successful paid call, and 5/5 feedback on Avalanche Fuji ERC-8004 registries.'
  };
}

export async function runAgent(origin: string, task: string, policyInput: Partial<AllowancePolicy> = {}) {
  const aiConfig = getAiAgentConfig();
  const allowancePolicy = normalizeAllowancePolicy(policyInput);
  const usePaidFlow = requiresPaidToolFlow(task);
  const discoveredTools = usePaidFlow ? await scoreTools(task) : [];
  const openai = createOpenAI({ apiKey: aiConfig.apiKey });
  const agentEvents: any[] = [];
  const decisionTrace: DecisionTraceEntry[] = [];
  const paidCalls: Array<{
    tool: Awaited<ReturnType<typeof scoreTools>>[number];
    reason: string;
    response: unknown;
    paymentResponse: unknown;
    reputationUpdate: Awaited<ReturnType<typeof writeReputationUpdate>>;
  }> = [];

  function remainingBudget() {
    return allowancePolicy.maxBudgetAtomic - paidCalls.reduce((sum, call) => sum + call.tool.priceAtomic, 0);
  }

  if (!usePaidFlow) {
    const result = await generateText({
      model: openai(aiConfig.model),
      system: [
        'You are AgentPay, a concise chatbot for an autonomous agent spend demo.',
        'For greetings and general product questions, answer naturally without claiming that any payment, API call, or onchain transaction happened.',
        'Invite the user to give a concrete Avalanche/DeFi/yield/risk task when they want to see the paid x402 agent flow.'
      ].join('\n'),
      prompt: task
    });

    return {
      task,
      mode: 'chat',
      model: aiConfig.model,
      allowancePolicy,
      discoveredTools,
      selectedTools: [],
      rejectedTools: [],
      decisionTrace: [],
      payments: [],
      validationUpdates: [],
      reputationUpdates: [],
      toolResponses: {},
      result: result.text?.trim() || 'Hi. Give me an Avalanche yield or risk task when you want me to spend from the allowance and call paid tools.',
      agentEvents: [{ type: 'chat-response', output: { toolUseRequired: false } }],
      ai: {
        provider: 'openai',
        model: aiConfig.model,
        finishReason: result.finishReason,
        usage: result.totalUsage || result.usage
      },
      totalSpentAtomic: '0',
      remainingBudgetAtomic: String(allowancePolicy.maxBudgetAtomic),
      totalSpentDisplay: formatUsdc(0),
      remainingBudgetDisplay: formatUsdc(allowancePolicy.maxBudgetAtomic),
      network: 'Avalanche Fuji (eip155:43113)'
    };
  }

  const result = await generateText({
    model: openai(aiConfig.model),
    system: [
      'You are AgentPay, a real autonomous spend agent running on Avalanche Fuji.',
      'You may inspect paid API providers and request paid tool calls, but every payment is enforced by deterministic budget, capability, and reputation policy.',
      'Do not claim a payment, receipt, or onchain update happened unless a tool result reports it.',
      'For user tasks about Avalanche yield, lending, APY, safety, risk, or protocols, use paid tools when policy allows.',
      'For "safest" or risk-sensitive yield tasks, prefer using both a yield source and a risk source if budget and reputation policy allow it.',
      'If a provider is cheap but below the reputation policy, explain that it was not used.',
      'Your final answer must include: tools paid, tools rejected or skipped, total spend, remaining allowance, payment receipts if available, reputation transaction hashes if available, and a clear recommendation.'
    ].join('\n'),
    prompt: [
      `User task: ${task}`,
      '',
      'Allowance policy:',
      `- maxBudgetAtomic: ${allowancePolicy.maxBudgetAtomic} (${formatUsdc(allowancePolicy.maxBudgetAtomic)})`,
      `- minReputation: ${allowancePolicy.minReputation}/5`,
      `- allowedCapabilities: ${allowancePolicy.allowedCapabilities.join(', ')}`,
      `- maxPaidTools: ${allowancePolicy.maxTools}`,
      '',
      'Initial paid tool market:',
      JSON.stringify(discoveredTools.map(publicToolView), null, 2),
      '',
      'First call inspectToolMarket. Then request payApprovedTool only for tools needed to complete the task. The payment tool will deny unsafe spend automatically.'
    ].join('\n'),
    tools: {
      inspectToolMarket: tool({
        description: 'Inspect the current paid API/tool market with prices, capabilities, onchain reputation, and policy fit. This tool never spends money.',
        inputSchema: z.object({
          objective: z.string().describe('The user objective you are planning against.')
        }),
        execute: async ({ objective }) => {
          const view = discoveredTools.map(toolToShow => {
            const policy = policyCheckForTool(toolToShow, allowancePolicy, remainingBudget(), paidCalls.length);
            return { ...publicToolView(toolToShow), policy };
          });
          const output = { objective, remainingBudgetAtomic: remainingBudget(), remainingBudgetDisplay: formatUsdc(remainingBudget()), tools: view };
          agentEvents.push({ type: 'inspect-tool-market', output });
          return output;
        }
      }),
      payApprovedTool: tool({
        description: 'Request a real x402 payment to a paid API/tool, call it, validate delivered work, and write reputation to Avalanche Fuji if policy permits.',
        inputSchema: z.object({
          agentId: z.number().int().positive().describe('The agent/tool id to pay and call.'),
          reason: z.string().min(12).describe('Why this paid API is needed for the user task.'),
          expectedOutput: z.string().min(3).describe('What output you expect from this paid API.')
        }),
        execute: async ({ agentId, reason, expectedOutput }) => {
          const toolToPay = discoveredTools.find(toolItem => toolItem.agentId === agentId);
          if (!toolToPay) {
            const output = { approved: false, agentId, denialReason: `Unknown paid tool agentId ${agentId}.` };
            agentEvents.push({ type: 'payment-denied', output });
            return output;
          }

          if (paidCalls.some(call => call.tool.agentId === agentId)) {
            const output = { approved: false, agentId, tool: toolToPay.name, denialReason: `${toolToPay.name} was already paid in this run.` };
            agentEvents.push({ type: 'payment-denied', output });
            return output;
          }

          const policy = policyCheckForTool(toolToPay, allowancePolicy, remainingBudget(), paidCalls.length);
          decisionTrace.push({
            agentId: toolToPay.agentId,
            name: toolToPay.name,
            action: policy.policyPass ? 'selected' : 'rejected',
            capabilityMatch: policy.matchedCapabilities.length > 0,
            matchedCapabilities: policy.matchedCapabilities,
            priceAtomic: toolToPay.priceAtomic,
            budgetRemainingBefore: remainingBudget(),
            reputation: Number(toolToPay.reputation),
            policyPass: policy.policyPass,
            reasons: [`AI requested payment: ${reason}`, `Expected output: ${expectedOutput}`, ...policy.reasons]
          });

          if (!policy.policyPass) {
            const output = {
              approved: false,
              agentId: toolToPay.agentId,
              tool: toolToPay.name,
              denialReason: policy.reasons.join(' '),
              remainingBudgetAtomic: remainingBudget(),
              remainingBudgetDisplay: formatUsdc(remainingBudget())
            };
            agentEvents.push({ type: 'payment-denied', output });
            return output;
          }

          const paidCall = await callPaidTool(origin, toolToPay, { task, aiReason: reason, expectedOutput });
          const reputationUpdate = await writeReputationUpdate(toolToPay, paidCall.response, paidCall.paymentResponse);
          paidCalls.push({ tool: toolToPay, reason, ...paidCall, reputationUpdate });
          const output = {
            approved: true,
            agentId: toolToPay.agentId,
            tool: toolToPay.name,
            reason,
            expectedOutput,
            amountAtomic: String(toolToPay.priceAtomic),
            amountDisplay: formatUsdc(toolToPay.priceAtomic),
            paymentTxHash: findTxHash(paidCall.paymentResponse),
            paymentResponse: paidCall.paymentResponse,
            reputationUpdate,
            response: paidCall.response,
            remainingBudgetAtomic: remainingBudget(),
            remainingBudgetDisplay: formatUsdc(remainingBudget())
          };
          agentEvents.push({ type: 'paid-tool-call', output });
          return output;
        }
      })
    },
    stopWhen: stepCountIs(8),
    providerOptions: {
      openai: {
        parallelToolCalls: false
      }
    },
    experimental_onToolCallStart({ toolCall }) {
      agentEvents.push({ type: 'tool-call-start', toolCall });
    },
    experimental_onToolCallFinish(event) {
      agentEvents.push({
        type: 'tool-call-finish',
        toolCall: event.toolCall,
        ok: event.success,
        output: event.success ? event.output : undefined,
        error: !event.success && event.error instanceof Error ? event.error.message : undefined
      });
    }
  });

  const selectedTools = paidCalls.map(call => call.tool);
  const paidIds = new Set(selectedTools.map(tool => tool.agentId));
  for (const toolItem of discoveredTools) {
    if (decisionTrace.some(entry => entry.agentId === toolItem.agentId)) continue;
    const policy = policyCheckForTool(toolItem, allowancePolicy, remainingBudget(), paidCalls.length);
    decisionTrace.push({
      agentId: toolItem.agentId,
      name: toolItem.name,
      action: 'rejected',
      capabilityMatch: policy.matchedCapabilities.length > 0,
      matchedCapabilities: policy.matchedCapabilities,
      priceAtomic: toolItem.priceAtomic,
      budgetRemainingBefore: remainingBudget(),
      reputation: Number(toolItem.reputation),
      policyPass: false,
      reasons: paidIds.has(toolItem.agentId)
        ? ['Paid by the AI agent.']
        : [
            paidCalls.length >= allowancePolicy.maxTools ? `Max paid tool count ${allowancePolicy.maxTools} was reached.` : 'AI agent did not request payment for this provider.',
            ...policy.reasons
          ]
    });
  }

  const rejectedTools = discoveredTools
    .filter(toolItem => !paidIds.has(toolItem.agentId))
    .map(toolItem => {
      const trace = decisionTrace.find(entry => entry.agentId === toolItem.agentId);
      return { ...toolItem, reason: trace?.reasons.join(' ') || 'Not selected by the AI agent.', rejectionReasons: trace?.reasons || [] };
    });

  const total = selectedTools.reduce((sum, t) => sum + t.priceAtomic, 0);
  if (total > allowancePolicy.maxBudgetAtomic) throw new Error('Selected tools exceed max budget');
  if (selectedTools.length === 0) {
    const rejectionSummary = decisionTrace.map(entry => `${entry.name}: ${entry.reasons.join(' ')}`).join(' ');
    throw new AllowancePolicyError(`The OpenAI agent did not complete any approved paid tool call. ${rejectionSummary}`);
  }

  const yieldResponse = paidCalls.find(c => c.tool.name === 'AvalancheYieldScout')?.response as any;
  const riskResponse = paidCalls.find(c => c.tool.name === 'RiskOracleMCP')?.response as any;
  const bestOpportunity = yieldResponse?.opportunities?.[0];
  const rejectedToolNames = rejectedTools.map(tool => tool.name).join(', ') || 'none';
  const lowRiskProtocols = Array.isArray(riskResponse?.protocols)
    ? riskResponse.protocols.filter((p: any) => p.riskLabel === 'lower').slice(0, 3).map((p: any) => p.protocol)
    : [];
  const fallbackRecommendation = bestOpportunity
    ? `Recommendation: ${bestOpportunity.protocol} ${bestOpportunity.symbol} pool.\n\nEstimated APY: ${Number(bestOpportunity.apy || 0).toFixed(2)}%\nTVL checked: $${Number(bestOpportunity.tvlUsd || 0).toLocaleString()}\n\nWhy the agent chose this path:\n- The allowance policy capped spend at ${formatUsdc(allowancePolicy.maxBudgetAtomic)} and required reputation >= ${allowancePolicy.minReputation}/5.\n- AvalancheYieldScout supplied current USDC yield opportunities.\n- RiskOracleMCP cross-checked Avalanche protocol risk signals${lowRiskProtocols.length ? ` including ${lowRiskProtocols.join(', ')}.` : '.'}\n- Rejected providers: ${rejectedToolNames}.\n\nTotal paid: ${formatUsdc(total)} via x402.\nTrust updated: validation proof, successful paid calls, and 5/5 feedback written on Avalanche Fuji ERC-8004 registries.`
    : `Autonomous flow completed: ${selectedTools.map(tool => tool.name).join(', ')} selected by allowance policy, paid via x402, validated, and reputation was updated on Avalanche Fuji ERC-8004 registries. Rejected providers: ${rejectedToolNames}.`;
  const modelText = result.text?.trim();

  return {
    task,
    model: aiConfig.model,
    allowancePolicy,
    discoveredTools,
    selectedTools: selectedTools.map(t => ({
      ...t,
      reason: decisionTrace.find(entry => entry.agentId === t.agentId)?.reasons.join(' ') || 'Passed allowance policy.'
    })),
    rejectedTools,
    decisionTrace,
    payments: paidCalls.map(c => ({
      ...((c.paymentResponse || {}) as object),
      agentId: c.tool.agentId,
      tool: c.tool.name,
      txHash: findTxHash(c.paymentResponse),
      amount: String(c.tool.priceAtomic),
      asset: c.tool.pricing.asset,
      network: NETWORK,
      paymentRef: c.reputationUpdate.paymentRef
    })),
    validationUpdates: paidCalls.map(c => c.reputationUpdate.validationUpdate),
    reputationUpdates: paidCalls.map(c => c.reputationUpdate),
    toolResponses: Object.fromEntries(paidCalls.map(c => [c.tool.name, c.response])),
    result: modelText || fallbackRecommendation,
    fallbackResult: fallbackRecommendation,
    agentEvents,
    ai: {
      provider: 'openai',
      model: aiConfig.model,
      finishReason: result.finishReason,
      usage: result.totalUsage || result.usage
    },
    totalSpentAtomic: String(total),
    remainingBudgetAtomic: String(allowancePolicy.maxBudgetAtomic - total),
    totalSpentDisplay: formatUsdc(total),
    remainingBudgetDisplay: formatUsdc(allowancePolicy.maxBudgetAtomic - total),
    network: 'Avalanche Fuji (eip155:43113)'
  };
}
