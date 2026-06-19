import { getAgentCatalog } from '@/lib/agent-catalog';
import { apiErrorBody } from '@/lib/real-config';
import AgentWorkspaceClient from './AgentWorkspaceClient';

export const dynamic = 'force-dynamic';

export default async function AgentPage() {
  try {
    return <AgentWorkspaceClient initialAgents={await getAgentCatalog()} />;
  } catch (e) {
    return <AgentWorkspaceClient initialAgents={[]} initialError={apiErrorBody(e, 'Unable to load tool market').error} />;
  }
}
