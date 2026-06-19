import { NextRequest, NextResponse } from 'next/server';
import { AllowancePolicyError, DEFAULT_ALLOWANCE_POLICY, runAgent } from '@/lib/agent-runner';
import { apiErrorBody } from '@/lib/real-config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const origin = req.nextUrl.origin;
    const result = await runAgent(origin, body.task || 'Find the safest Avalanche yield opportunity for 1,000 USDC', {
      maxBudgetAtomic: Number(body.maxBudgetAtomic ?? DEFAULT_ALLOWANCE_POLICY.maxBudgetAtomic),
      minReputation: Number(body.minReputation ?? DEFAULT_ALLOWANCE_POLICY.minReputation),
      allowedCapabilities: Array.isArray(body.allowedCapabilities) ? body.allowedCapabilities : DEFAULT_ALLOWANCE_POLICY.allowedCapabilities,
      maxTools: Number(body.maxTools ?? DEFAULT_ALLOWANCE_POLICY.maxTools)
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AllowancePolicyError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    return NextResponse.json(apiErrorBody(e, 'Agent run failed'), { status: 500 });
  }
}
