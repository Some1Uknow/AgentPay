import hre from 'hardhat';

const { ethers } = hre as any;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with', deployer.address);

  const Identity = await ethers.getContractFactory('AgentIdentityRegistry');
  const identity = await Identity.deploy();
  await identity.waitForDeployment();
  const identityAddress = await identity.getAddress();

  const Reputation = await ethers.getContractFactory('AgentReputationRegistry');
  const reputation = await Reputation.deploy(identityAddress);
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();

  const Validation = await ethers.getContractFactory('AgentValidationRegistry');
  const validation = await Validation.deploy(identityAddress);
  await validation.waitForDeployment();
  const validationAddress = await validation.getAddress();

  console.log('IDENTITY_REGISTRY_ADDRESS=', identityAddress);
  console.log('REPUTATION_REGISTRY_ADDRESS=', reputationAddress);
  console.log('VALIDATION_REGISTRY_ADDRESS=', validationAddress);

  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  for (const id of [1, 2, 3]) {
    const tx = await identity['register(string)'](`${base}/api/agents/${id}`);
    await tx.wait();
    console.log('Registered tool', id, `${base}/api/agents/${id}`);
  }

  const bootstrapRatings = [
    { id: 1, rating: 2, tag: 'bootstrap-low-trust' },
    { id: 2, rating: 5, tag: 'bootstrap-yield-specialist' },
    { id: 3, rating: 5, tag: 'bootstrap-risk-specialist' }
  ];
  const feedbackKey = process.env.FEEDBACK_PRIVATE_KEY;
  if (!feedbackKey) throw new Error('FEEDBACK_PRIVATE_KEY is required to seed ERC-8004 reputation without self-review.');
  const feedbackWallet = new ethers.Wallet(feedbackKey, ethers.provider);
  const reputationFromFeedback = reputation.connect(feedbackWallet);
  for (const item of bootstrapRatings) {
    const feedbackHash = ethers.id(`agentpay:${base}:bootstrap:${item.id}:${item.rating}:${item.tag}`);
    const tx = await reputationFromFeedback.giveFeedback(item.id, item.rating, 0, 'bootstrap-reputation', item.tag, `${base}/api/agents/${item.id}`, '', feedbackHash);
    await tx.wait();
    console.log('Seeded reputation', item.id, `${item.rating}/5`, item.tag);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
