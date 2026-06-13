import { NextRequest, NextResponse } from 'next/server';
import { apiErrorBody } from '@/lib/real-config';
import { tools } from '@/lib/tools';
import { withRealPayment } from '@/lib/x402-server';

async function handler(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const res = await fetch('https://api.llama.fi/protocols', { next: { revalidate: 300 } });
  if (!res.ok) throw new Error('DeFiLlama protocols API unavailable');
  const protocols = await res.json();
  const avalancheProtocols = protocols
    .filter((p: any) => Array.isArray(p.chains) && p.chains.includes('Avalanche'))
    .slice(0, 25)
    .map((p: any) => ({
      protocol: p.name,
      category: p.category,
      tvl: p.tvl,
      audits: p.audits,
      audit_note: p.audit_note,
      riskLabel: Number(p.audits || 0) > 0 && Number(p.tvl || 0) > 10_000_000 ? 'lower' : 'higher'
    }));
  return NextResponse.json({ tool: 'RiskOracleMCP', source: 'https://api.llama.fi/protocols', task: body.task, protocols: avalancheProtocols });
}

export async function POST(req: NextRequest) {
  try {
    const tool = tools().find(t => t.agentId === 3);
    if (!tool) throw new Error('RiskOracleMCP not found');
    return await withRealPayment(tool, handler)(req);
  } catch (e) {
    return NextResponse.json(apiErrorBody(e, 'RiskOracleMCP failed'), { status: 500 });
  }
}
