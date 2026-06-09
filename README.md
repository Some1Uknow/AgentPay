# AgentPay MCP — real-only Next.js MVP

This build intentionally contains **no local/mock payment settlement**. It will fail fast until real testnet configuration is provided.

## Required real infrastructure

- Avalanche Fuji RPC
- Deployed `AgentIdentityRegistry` and `AgentReputationRegistry`
- A real Fuji ERC-20 stablecoin address accepted by your x402 facilitator
- A real x402 facilitator URL that supports `eip155:43113` and that token
- Buyer wallet funded with the token, and any approval required by the selected x402 transfer method
- Seller wallets for all three tools

If any of those are missing, the app returns configuration errors instead of pretending a payment happened.

## Run

```bash
npm install
cp .env.example .env
# fill every required value
npm run dev
```

## API

- `GET /api/agents`
- `GET /api/agents/:id`
- `GET /api/agents/search?capability=avalanche-defi-yield-search`
- `POST /api/tools/cheap-yield-bot` — protected by real x402
- `POST /api/tools/yield-scout` — protected by real x402
- `POST /api/tools/risk-oracle` — protected by real x402
- `POST /api/run-agent` — uses `@x402/fetch` with `BUYER_PRIVATE_KEY`
- `POST /api/feedback` — writes to `AgentReputationRegistry` on Fuji

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
