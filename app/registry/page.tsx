import { getAgentCatalog } from '@/lib/agent-catalog';
import { apiErrorBody } from '@/lib/real-config';
import RegistryClient from './RegistryClient';

export const dynamic = 'force-dynamic';

export default async function RegistryPage() {
  try {
    return <RegistryClient initialAgents={await getAgentCatalog()} />;
  } catch (e) {
    return <RegistryClient initialAgents={[]} initialError={apiErrorBody(e, 'Failed to load registry').error} />;
  }
}
