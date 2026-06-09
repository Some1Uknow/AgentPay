import hre from 'hardhat';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with', deployer.address);

  const Identity = await hre.ethers.getContractFactory('AgentIdentityRegistry');
  const identity = await Identity.deploy();
  await identity.waitForDeployment();

  const Reputation = await hre.ethers.getContractFactory('AgentReputationRegistry');
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
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
