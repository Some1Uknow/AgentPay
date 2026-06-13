import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { apiErrorBody, getFeedbackConfig } from '@/lib/real-config';

const abi = [
  'function giveFeedback(uint256 agentId,int128 value,uint8 valueDecimals,string tag1,string tag2,string endpoint,string feedbackURI,bytes32 feedbackHash) external',
  'function recordSuccessfulCall(uint256 agentId,bytes32 paymentRef) external'
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config = getFeedbackConfig();
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(config.feedbackPrivateKey, provider);
    const rep = new ethers.Contract(config.reputationRegistryAddress, abi, wallet);
    const paymentRef = body.paymentRef as string;
    if (paymentRef) await (await rep.recordSuccessfulCall(BigInt(body.agentId), paymentRef)).wait();
    const feedbackHash = body.feedbackHash || ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(body)));
    const tx = await rep.giveFeedback(BigInt(body.agentId), BigInt(body.ratingValue ?? 5), 0, body.tag1 || 'paid-call', body.tag2 || 'x402', body.endpoint || '', body.feedbackURI || '', feedbackHash);
    const receipt = await tx.wait();
    return NextResponse.json({ ok: true, txHash: receipt.hash, blockNumber: receipt.blockNumber });
  } catch (e) {
    return NextResponse.json(apiErrorBody(e, 'Feedback failed'), { status: 500 });
  }
}
