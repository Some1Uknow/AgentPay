import { NextRequest, NextResponse } from 'next/server';
import { apiErrorBody } from '@/lib/real-config';
import { tools } from '@/lib/tools';
import { withRealPayment } from '@/lib/x402-server';

async function handler() {
  const res = await fetch('https://yields.llama.fi/pools', { next: { revalidate: 60 } });
  if (!res.ok) throw new Error('DeFiLlama yield API unavailable');
  const json = await res.json();
  const opportunities = json.data
    .filter((p: any) => String(p.chain).toLowerCase() === 'avalanche' && String(p.symbol).toUpperCase().includes('USDC'))
    .sort((a: any, b: any) => Number(b.tvlUsd || 0) - Number(a.tvlUsd || 0))
    .slice(0, 8)
    .map((p: any) => ({ protocol: p.project, pool: p.pool, symbol: p.symbol, apy: p.apy, tvlUsd: p.tvlUsd, url: p.url }));
  return NextResponse.json({ tool: 'AvalancheYieldScout', source: 'https://yields.llama.fi/pools', opportunities });
}

export async function POST(req: NextRequest) {
  try {
    const tool = tools().find(t => t.agentId === 2);
    if (!tool) throw new Error('AvalancheYieldScout not found');
    return await withRealPayment(tool, handler)(req);
  } catch (e) {
    return NextResponse.json(apiErrorBody(e, 'AvalancheYieldScout failed'), { status: 500 });
  }
}
