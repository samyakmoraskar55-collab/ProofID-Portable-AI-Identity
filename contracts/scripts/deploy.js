const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ProofIDRegistry with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const ProofIDRegistry = await ethers.getContractFactory("ProofIDRegistry");
  const registry = await ProofIDRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("\n✅ ProofIDRegistry deployed to:", address);
  console.log("   Network:", (await ethers.provider.getNetwork()).name);
  console.log("   Transaction:", registry.deploymentTransaction()?.hash);

  // Write deployment info to file for the Django backend
  const deploymentInfo = {
    contractAddress: address,
    deployer: deployer.address,
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    txHash: registry.deploymentTransaction()?.hash,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "../deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📝 Deployment info saved to contracts/deployment.json");
  console.log("   Add CONTRACT_ADDRESS=" + address + " to your .env file");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
