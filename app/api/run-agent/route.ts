import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/lib/agent-runner';
import { apiErrorBody } from '@/lib/real-config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const origin = req.nextUrl.origin;
    const result = await runAgent(origin, body.task || 'Find the safest Avalanche yield opportunity for 1,000 USDC', Number(body.maxBudgetAtomic || 100000));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(apiErrorBody(e, 'Agent run failed'), { status: 500 });
  }
}
