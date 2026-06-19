# AgentPay MCP — real-only Next.js MVP

This build intentionally contains **no local/mock payment settlement**. It will fail fast until real testnet configuration is provided.

## Required real infrastructure

- Avalanche Fuji RPC
- OpenAI API key for model-driven agent reasoning
- Deployed `AgentIdentityRegistry` and `AgentReputationRegistry`
- A real Fuji ERC-20 stablecoin address accepted by your x402 facilitator
- A real x402 facilitator URL that supports `eip155:43113` and that token
- Buyer wallet funded with the token, and any approval required by the selected x402 transfer method
- Seller wallets for all three tools
- Bootstrap provider reputation written to `AgentReputationRegistry` so the default `minReputation: 4` policy can spend on a fresh Fuji deployment

If any of those are missing, the app returns configuration errors instead of pretending a payment happened.

## Run

```bash
npm install
cp .env.example .env
# fill every required value
npm run dev
```

## Demo bring-up checklist

1. Generate throwaway wallets if you do not already have test wallets:

```bash
npm run demo:wallets
```

Copy the printed private keys / seller addresses into `.env`. Fund `BUYER`, `DEPLOYER`, and `FEEDBACK` with Fuji AVAX. Fund `BUYER` with the token accepted by your x402 facilitator.

2. Configure real x402 settlement:

```env
X402_FACILITATOR_URL=https://...
USDC_ADDRESS=0x...
```

The facilitator/token pair must support Avalanche Fuji (`eip155:43113`) and the `exact` EVM scheme used by this app.

3. Configure the OpenAI agent:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1
```

`OPENAI_MODEL` is optional and defaults to `gpt-4.1`. The OpenAI model reasons over the task, inspects the paid tool market, and requests paid calls. The app still enforces budget, reputation, capability, and max-tool policy in code before any x402 payment is attempted.

4. Deploy and register the contracts/tools:

```bash
npm run compile:contracts
npm run deploy:contracts
```

Copy the printed `IDENTITY_REGISTRY_ADDRESS` and `REPUTATION_REGISTRY_ADDRESS` into `.env`. The deploy script also writes initial onchain reputation ratings: `CheapYieldBot` at `2/5`, `AvalancheYieldScout` at `5/5`, and `RiskOracleMCP` at `5/5`. That lets the default allowance policy reject the low-trust provider before payment while selecting the yield and risk specialists.

5. Verify readiness:

```bash
npm run demo:status
npm run dev
curl http://localhost:3000/api/health/config
```

6. Run the end-to-end agent flow from the UI or with:

```bash
curl -X POST http://localhost:3000/api/run-agent \
  -H "content-type: application/json" \
  -d '{"task":"Find the safest Avalanche yield opportunity for 1,000 USDC","maxBudgetAtomic":100000,"minReputation":4,"allowedCapabilities":["avalanche-defi-yield-search","defi-risk-scoring"],"maxTools":2}'
```

## API

- `GET /api/agents`
- `GET /api/agents/:id`
- `GET /api/agents/search?capability=avalanche-defi-yield-search`
- `POST /api/tools/cheap-yield-bot` — protected by real x402
- `POST /api/tools/yield-scout` — protected by real x402
- `POST /api/tools/risk-oracle` — protected by real x402
- `POST /api/run-agent` — uses AI SDK + OpenAI for model-driven tool selection, then `@x402/fetch` with `BUYER_PRIVATE_KEY` for approved paid calls; accepts `task`, `maxBudgetAtomic`, `minReputation`, `allowedCapabilities`, and `maxTools`
- `POST /api/feedback` — writes to `AgentReputationRegistry` on Fuji

`POST /api/run-agent` returns the OpenAI model id, allowance policy, discovered providers, selected providers, rejected providers, AI tool-call events, deterministic decision trace, x402 payments, reputation writes, tool responses, and final model-generated result.

## Speedrun delta

Built before this challenge:

- Basic paid MCP-style tool registry
- Initial agent runner and Next.js UI shell
- Solidity identity/reputation registry contracts

Added for this challenge:

- OpenAI + AI SDK model-driven agent loop
- AI tool calls for inspecting paid providers and requesting paid API calls
- Deterministic spend guardrails for budget, reputation, capabilities, and max paid tools
- Real x402 paid calls on Avalanche Fuji for approved tool requests
- Autonomous Fuji reputation transactions after validated paid tool responses
- UI proof panels for AI tool calls, policy decisions, x402 receipts, and reputation tx hashes

## Contracts

```bash
npm run deploy:contracts
```

Then set:

```bash
IDENTITY_REGISTRY_ADDRESS=...
REPUTATION_REGISTRY_ADDRESS=...
```

## Why this may not run immediately

A fully real x402 payment on Avalanche Fuji is only possible if the facilitator you configure supports:

1. `eip155:43113`
2. the chosen `USDC_ADDRESS`
3. the token transfer method, either EIP-3009 or Permit2
4. settlement gas/payment relaying for Fuji

Without that, there is no honest fallback: the endpoint must return an error rather than fabricate a tx hash.
