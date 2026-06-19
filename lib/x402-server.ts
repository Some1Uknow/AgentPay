import { NextRequest, NextResponse } from 'next/server';
import { HTTPFacilitatorClient, x402ResourceServer } from '@x402/core/server';
import { withX402 } from '@x402/next';
import { ExactEvmScheme, registerExactEvmScheme } from '@x402/evm/exact/server';
import { assetAddress, facilitatorUrl, NETWORK } from './real-config';
import { AgentTool } from './types';

function resourceServer() {
  const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: facilitatorUrl() }));
  registerExactEvmScheme(server, { networks: [NETWORK] });
  server.register(NETWORK, new ExactEvmScheme());
  return server;
}

export function withRealPayment<T>(tool: AgentTool, handler: (request: NextRequest) => Promise<NextResponse<T>>) {
  return withX402(handler, {
    accepts: {
      scheme: 'exact',
      network: NETWORK,
      payTo: tool.wallet,
      price: {
        amount: String(tool.priceAtomic),
        asset: assetAddress()
      },
      extra: {
        name: 'USD Coin',
        version: '2'
      }
    },
    resource: tool.endpoint,
    description: `${tool.name} paid MCP tool call`,
    mimeType: 'application/json',
    serviceName: 'AgentPay MCP',
    unpaidResponseBody: () => ({
      contentType: 'application/json',
      body: { error: 'Payment Required', message: 'This endpoint requires a real x402 payment on Avalanche Fuji.' }
    })
  }, resourceServer());
}
