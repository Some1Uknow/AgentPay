import { NextRequest, NextResponse } from 'next/server';
import { attachOnchainReputation } from '@/lib/onchain-reputation';
import { apiErrorBody } from '@/lib/real-config';
import { toApiTool, tools } from '@/lib/tools';

export async function GET(req: NextRequest) {
  try {
    const capability = req.nextUrl.searchParams.get('capability');
    const current = await attachOnchainReputation(tools());
    const agents = capability ? current.filter(t => t.capabilities.includes(capability)) : current;
    return NextResponse.json({ agents: agents.map(toApiTool) });
  } catch (e) {
    return NextResponse.json(apiErrorBody(e, 'Configuration error'), { status: 500 });
  }
}
