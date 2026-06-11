import { ethers } from 'ethers';
import { getOnchainReputationConfig } from './real-config';
import { AgentTool } from './types';

const abi = ['function getReputation(uint256 agentId) view returns (uint256 successfulCalls,uint256 failedCalls,int256 totalRating,uint256 ratingCount)'];

export async function attachOnchainReputation(tools: AgentTool[]): Promise<AgentTool[]> {
  const config = getOnchainReputationConfig();
  if (!config) return tools;
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const contract = new ethers.Contract(config.reputationRegistryAddress, abi, provider);
  return Promise.all(tools.map(async tool => {
    const [successfulCalls, failedCalls, totalRating, ratingCount] = await contract.getReputation(tool.agentId);
    const reputation = ratingCount > 0n ? Number(totalRating) / Number(ratingCount) : 0;
    return { ...tool, successfulCalls: Number(successfulCalls), failedCalls: Number(failedCalls), reputation };
  }));
}
