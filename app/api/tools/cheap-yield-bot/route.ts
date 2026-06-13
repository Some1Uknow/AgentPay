import { NextRequest, NextResponse } from 'next/server';
import { apiErrorBody } from '@/lib/real-config';
import { tools } from '@/lib/tools';
import { withRealPayment } from '@/lib/x402-server';

async function handler() {
  const res = await fetch('https://yields.llama.fi/pools', { next: { revalidate: 300 } });
  if (!res.ok) throw new Error('DeFiLlama yield API unavailable');
  const json = await res.json();
  const opportunities = json.data
    .filter((p: any) => String(p.chain).toLowerCase() === 'avalanche')
    .slice(0, 5)
    .map((p: any) => ({ protocol: p.project, symbol: p.symbol, apy: p.apy, tvlUsd: p.tvlUsd }));
  return NextResponse.json({ tool: 'CheapYieldBot', source: 'https://yields.llama.fi/pools', opportunities });
}

export async function POST(req: NextRequest) {
  try {
    const tool = tools().find(t => t.agentId === 1);
    if (!tool) throw new Error('CheapYieldBot not found');
    return await withRealPayment(tool, handler)(req);
  } catch (e) {
    return NextResponse.json(apiErrorBody(e, 'CheapYieldBot failed'), { status: 500 });
  }
}
