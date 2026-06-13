import { NextResponse } from 'next/server';
import { attachOnchainReputation } from '@/lib/onchain-reputation';
import { apiErrorBody } from '@/lib/real-config';
import { toApiTool, tools } from '@/lib/tools';

export async function GET() {
  try {
    return NextResponse.json({ agents: (await attachOnchainReputation(tools())).map(toApiTool) });
  } catch (e) {
    return NextResponse.json(apiErrorBody(e, 'Configuration error'), { status: 500 });
  }
}
