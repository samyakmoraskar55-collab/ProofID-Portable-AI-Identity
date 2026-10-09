const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProofIDRegistry Smart Contract", function () {
  let registry;
  let owner, issuer, user1, user2;
  const proofId1 = ethers.keccak256(ethers.toUtf8Bytes("PID-8F3A29B1"));
  const proofId2 = ethers.keccak256(ethers.toUtf8Bytes("PID-4E90B12D"));
  const agentId1 = ethers.keccak256(ethers.toUtf8Bytes("AGT-7C91B420"));

  beforeEach(async function () {
    [owner, issuer, user1, user2] = await ethers.getSigners();

    const ProofIDRegistry = await ethers.getContractFactory("ProofIDRegistry");
    registry = await ProofIDRegistry.deploy();
    await registry.waitForDeployment();

    // Add issuer as trusted issuer
    await registry.addTrustedIssuer(issuer.address);
  });

  describe("Deployment & Admin", function () {
    it("Should set the deployer as owner and trusted issuer", async function () {
      expect(await registry.owner()).to.equal(owner.address);
      expect(await registry.trustedIssuers(owner.address)).to.equal(true);
      expect(await registry.trustedIssuers(issuer.address)).to.equal(true);
    });

    it("Should allow owner to add and remove trusted issuers", async function () {
      await registry.removeTrustedIssuer(issuer.address);
      expect(await registry.trustedIssuers(issuer.address)).to.equal(false);

      await registry.addTrustedIssuer(issuer.address);
      expect(await registry.trustedIssuers(issuer.address)).to.equal(true);
    });
  });

  describe("Identity Lifecycle", function () {
    it("Should register a new human identity", async function () {
      const tx = await registry.connect(user1).registerIdentity(proofId1, "ipfs://QmAlexRiveraMetadata");
      await expect(tx).to.emit(registry, "IdentityRegistered");

      const id = await registry.getIdentity(proofId1);
      expect(id.owner).to.equal(user1.address);
      expect(id.reputationScore).to.equal(100);
      expect(id.isVerified).to.equal(false);
      expect(id.isActive).to.equal(true);
      expect(id.metadataURI).to.equal("ipfs://QmAlexRiveraMetadata");
    });

    it("Should prevent duplicate identity registration with same hash", async function () {
      await registry.connect(user1).registerIdentity(proofId1, "ipfs://Qm1");
      await expect(
        registry.connect(user2).registerIdentity(proofId1, "ipfs://Qm2")
      ).to.be.revertedWith("ProofID: proofIdHash already registered");
    });

    it("Should allow trusted issuer to verify identity", async function () {
      await registry.connect(user1).registerIdentity(proofId1, "ipfs://Qm1");
      await registry.connect(issuer).verifyIdentity(proofId1);

      const id = await registry.getIdentity(proofId1);
      expect(id.isVerified).to.equal(true);
    });

    it("Should allow trusted issuer to update reputation score up to 1000", async function () {
      await registry.connect(user1).registerIdentity(proofId1, "ipfs://Qm1");
      await registry.connect(issuer).updateReputation(proofId1, 780);

      const id = await registry.getIdentity(proofId1);
      expect(id.reputationScore).to.equal(780);
    });

    it("Should reject score update above 1000", async function () {
      await registry.connect(user1).registerIdentity(proofId1, "ipfs://Qm1");
      await expect(
        registry.connect(issuer).updateReputation(proofId1, 1001)
      ).to.be.revertedWith("ProofID: score out of range");
    });
  });

  describe("Verifiable Credentials", function () {
    beforeEach(async function () {
      await registry.connect(user1).registerIdentity(proofId1, "ipfs://Qm1");
    });

    it("Should issue verifiable credentials", async function () {
      const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 365;
      await registry.connect(issuer).issueCredential(proofId1, "DEVELOPER", expiresAt);

      const count = await registry.getCredentialCount(proofId1);
      expect(count).to.equal(1);

      const cred = await registry.getCredential(proofId1, 0);
      expect(cred.credentialType).to.equal("DEVELOPER");
      expect(cred.revoked).to.equal(false);
      expect(cred.issuer).to.equal(issuer.address);
    });

    it("Should allow credential revocation", async function () {
      await registry.connect(issuer).issueCredential(proofId1, "AI_RESEARCHER", 0);
      await registry.connect(issuer).revokeCredential(proofId1, 0);

      const cred = await registry.getCredential(proofId1, 0);
      expect(cred.revoked).to.equal(true);
    });
  });

  describe("Autonomous AI Agent Delegation", function () {
    beforeEach(async function () {
      await registry.connect(user1).registerIdentity(proofId1, "ipfs://Qm1");
    });

    it("Should allow identity owner to register autonomous AI subagent", async function () {
      const tx = await registry.connect(user1).registerAgent(
        agentId1,
        proofId1,
        "ipfs://QmSentinelAgentMetadata"
      );
      await expect(tx).to.emit(registry, "AgentRegistered");

      const agent = await registry.getAgent(agentId1);
      expect(agent.ownerProofIdHash).to.equal(proofId1);
      expect(agent.reputationScore).to.equal(100);
      expect(agent.isActive).to.equal(true);
      expect(agent.isVerified).to.equal(false);

      const ownerAgents = await registry.getOwnerAgents(proofId1);
      expect(ownerAgents.length).to.equal(1);
      expect(ownerAgents[0]).to.equal(agentId1);
    });

    it("Should allow trusted issuer to verify agent and update agent reputation", async function () {
      await registry.connect(user1).registerAgent(agentId1, proofId1, "ipfs://QmAgent");
      await registry.connect(issuer).verifyAgent(agentId1);
      await registry.connect(issuer).updateAgentReputation(agentId1, 920);

      const agent = await registry.getAgent(agentId1);
      expect(agent.isVerified).to.equal(true);
      expect(agent.reputationScore).to.equal(920);
    });

    it("Should reject agent registration by non-owner", async function () {
      await expect(
        registry.connect(user2).registerAgent(agentId1, proofId1, "ipfs://QmAgent")
      ).to.be.revertedWith("ProofID: not identity owner");
    });
  });
});
