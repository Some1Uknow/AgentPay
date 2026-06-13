import { NextResponse } from 'next/server';
import { attachOnchainReputation } from '@/lib/onchain-reputation';
import { apiErrorBody } from '@/lib/real-config';
import { metadataFor, tools, toApiTool } from '@/lib/tools';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tool = (await attachOnchainReputation(tools())).find(t => t.agentId === Number(id));
    if (!tool) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    return NextResponse.json({ agent: toApiTool(tool), metadata: metadataFor(tool) });
  } catch (e) {
    return NextResponse.json(apiErrorBody(e, 'Configuration error'), { status: 500 });
  }
}
