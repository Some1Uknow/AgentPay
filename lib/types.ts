export type Pricing = {
  network: 'eip155:43113';
  asset: string;
  amountInAtomicUnits: string;
  display: string;
};

export type AgentTool = {
  agentId: number;
  name: string;
  description: string;
  endpoint: string;
  mcpEndpoint: string;
  priceAtomic: number;
  reputation: number;
  successfulCalls: number;
  failedCalls: number;
  capabilities: string[];
  weakness?: string;
  wallet: string;
  active: boolean;
};

export type PaymentReceipt = {
  agentId: number;
  txHash: string;
  amount: string;
  asset: string;
  network: string;
  paymentRef: string;
};

export type AllowancePolicy = {
  maxBudgetAtomic: number;
  minReputation: number;
  allowedCapabilities: string[];
  maxTools: number;
};

export type DecisionTraceEntry = {
  agentId: number;
  name: string;
  action: 'selected' | 'rejected';
  capabilityMatch: boolean;
  matchedCapabilities: string[];
  priceAtomic: number;
  budgetRemainingBefore: number;
  reputation: number;
  policyPass: boolean;
  reasons: string[];
};
