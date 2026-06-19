import hre from 'hardhat';

const { ethers } = hre as any;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with', deployer.address);

  const Identity = await ethers.getContractFactory('AgentIdentityRegistry');
  const identity = await Identity.deploy();
  await identity.waitForDeployment();

  const Reputation = await ethers.getContractFactory('AgentReputationRegistry');
  const reputation = await Reputation.deploy();
  await reputation.waitForDeployment();

  console.log('IDENTITY_REGISTRY_ADDRESS=', await identity.getAddress());
  console.log('REPUTATION_REGISTRY_ADDRESS=', await reputation.getAddress());

  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  for (const id of [1, 2, 3]) {
    const tx = await identity.register(`${base}/api/agents/${id}`);
    await tx.wait();
    console.log('Registered tool', id, `${base}/api/agents/${id}`);
  }

  const bootstrapRatings = [
    { id: 1, rating: 2, tag: 'bootstrap-low-trust' },
    { id: 2, rating: 5, tag: 'bootstrap-yield-specialist' },
    { id: 3, rating: 5, tag: 'bootstrap-risk-specialist' }
  ];
  for (const item of bootstrapRatings) {
    const feedbackHash = ethers.id(`agentpay:${base}:bootstrap:${item.id}:${item.rating}:${item.tag}`);
    const tx = await reputation.giveFeedback(item.id, item.rating, 0, 'bootstrap-reputation', item.tag, `${base}/api/agents/${item.id}`, '', feedbackHash);
    await tx.wait();
    console.log('Seeded reputation', item.id, `${item.rating}/5`, item.tag);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
