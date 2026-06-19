import { NextResponse } from 'next/server';
import { getAgentCatalog } from '@/lib/agent-catalog';
import { apiErrorBody } from '@/lib/real-config';

export async function GET() {
  try {
    return NextResponse.json({ agents: await getAgentCatalog() });
  } catch (e) {
    return NextResponse.json(apiErrorBody(e, 'Configuration error'), { status: 500 });
  }
}
