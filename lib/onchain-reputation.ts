import { ethers } from 'ethers';
import { getOnchainReputationConfig } from './real-config';
import { AgentTool } from './types';

const abi = [
  'function getClients(uint256 agentId) view returns (address[])',
  'function getSummary(uint256 agentId,address[] clientAddresses,string tag1,string tag2) view returns (uint64 count,int128 summaryValue,uint8 summaryValueDecimals)',
  'function getReputation(uint256 agentId) view returns (uint256 successfulCalls,uint256 failedCalls,int256 totalRating,uint256 ratingCount)'
];

export async function attachOnchainReputation(tools: AgentTool[]): Promise<AgentTool[]> {
  const config = getOnchainReputationConfig();
  if (!config) return tools;
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const contract = new ethers.Contract(config.reputationRegistryAddress, abi, provider);
  return Promise.all(tools.map(async tool => {
    const clients = await contract.getClients(tool.agentId);
    const [count, summaryValue] = clients.length ? await contract.getSummary(tool.agentId, clients, '', '') : [0n, 0n];
    const [successfulCalls, failedCalls] = await contract.getReputation(tool.agentId);
    const reputation = count > 0n ? Number(summaryValue) : 0;
    return { ...tool, successfulCalls: Number(successfulCalls), failedCalls: Number(failedCalls), reputation };
  }));
}
