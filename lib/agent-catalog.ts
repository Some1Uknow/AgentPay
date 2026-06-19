import { attachOnchainReputation } from './onchain-reputation';
import { toApiTool, tools } from './tools';

export async function getAgentCatalog() {
  const baseTools = tools();
  try {
    return (await attachOnchainReputation(baseTools)).map(toApiTool);
  } catch {
    return baseTools.map(toApiTool);
  }
}
