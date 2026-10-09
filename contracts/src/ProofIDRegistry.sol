// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ProofIDRegistry
 * @notice On-chain identity registry for ProofID — Portable AI Identity
 * @dev Stores only public identifiers, hashes and proofs. No PII, passwords or private keys ever stored on-chain.
 *      Designed for Monad blockchain (EVM-compatible, high-throughput).
 */
contract ProofIDRegistry {
    // ─────────────────────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────────────────────

    struct Identity {
        bytes32 proofIdHash;      // keccak256 of off-chain ProofID string
        address owner;            // wallet that registered this identity
        uint256 createdAt;        // block timestamp
        uint256 reputationScore;  // on-chain mirror of off-chain reputation (0-1000)
        bool    isVerified;       // human-verified flag
        bool    isActive;
        string  metadataURI;      // IPFS/HTTPS URI pointing to public metadata (no PII)
    }

    struct Credential {
        bytes32 credentialHash;   // keccak256(credentialType ++ issuedAt ++ proofIdHash)
        string  credentialType;   // e.g. "HUMAN_VERIFIED", "DEVELOPER", "STUDENT"
        address issuer;           // trusted issuer address
        uint256 issuedAt;
        uint256 expiresAt;        // 0 = never expires
        bool    revoked;
    }

    struct AIAgent {
        bytes32 agentIdHash;      // keccak256 of off-chain agent ID
        bytes32 ownerProofIdHash; // identity that owns this agent
        address ownerWallet;
        uint256 registeredAt;
        uint256 reputationScore;
        bool    isVerified;
        bool    isActive;
        string  metadataURI;
    }

    // ─────────────────────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────────────────────

    address public owner;
    uint256 public totalIdentities;
    uint256 public totalAgents;

    // proofIdHash → Identity
    mapping(bytes32 => Identity) public identities;
    // wallet → proofIdHash (each wallet can have one active identity)
    mapping(address => bytes32) public walletToIdentity;
    // proofIdHash → credential index → Credential
    mapping(bytes32 => mapping(uint256 => Credential)) public credentials;
    mapping(bytes32 => uint256) public credentialCount;
    // agentIdHash → AIAgent
    mapping(bytes32 => AIAgent) public agents;
    // proofIdHash → list of agentIdHashes
    mapping(bytes32 => bytes32[]) public ownerAgents;
    // trusted issuers allowed to add credentials
    mapping(address => bool) public trustedIssuers;

    // ─────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────

    event IdentityRegistered(bytes32 indexed proofIdHash, address indexed wallet, uint256 timestamp);
    event IdentityVerified(bytes32 indexed proofIdHash, address indexed verifier, uint256 timestamp);
    event IdentityUpdated(bytes32 indexed proofIdHash, uint256 timestamp);
    event CredentialIssued(bytes32 indexed proofIdHash, bytes32 credentialHash, string credentialType, uint256 timestamp);
    event CredentialRevoked(bytes32 indexed proofIdHash, uint256 credentialIndex, uint256 timestamp);
    event ReputationUpdated(bytes32 indexed proofIdHash, uint256 newScore, uint256 timestamp);
    event AgentRegistered(bytes32 indexed agentIdHash, bytes32 indexed ownerProofIdHash, uint256 timestamp);
    event AgentReputationUpdated(bytes32 indexed agentIdHash, uint256 newScore, uint256 timestamp);
    event AgentVerified(bytes32 indexed agentIdHash, uint256 timestamp);
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    // ─────────────────────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "ProofID: not owner");
        _;
    }

    modifier onlyTrustedIssuer() {
        require(trustedIssuers[msg.sender] || msg.sender == owner, "ProofID: not trusted issuer");
        _;
    }

    modifier identityExists(bytes32 proofIdHash) {
        require(identities[proofIdHash].createdAt != 0, "ProofID: identity not found");
        _;
    }

    modifier onlyIdentityOwner(bytes32 proofIdHash) {
        require(identities[proofIdHash].owner == msg.sender, "ProofID: not identity owner");
        _;
    }

    // ─────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        trustedIssuers[msg.sender] = true;
    }

    // ─────────────────────────────────────────────────────────────
    //  Identity Functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Register a new identity. Each wallet can only register once.
     * @param proofIdHash keccak256 hash of the off-chain ProofID string
     * @param metadataURI Public metadata URI (IPFS or HTTPS). Must NOT contain PII.
     */
    function registerIdentity(bytes32 proofIdHash, string calldata metadataURI) external {
        require(walletToIdentity[msg.sender] == bytes32(0), "ProofID: wallet already has identity");
        require(identities[proofIdHash].createdAt == 0, "ProofID: proofIdHash already registered");
        require(proofIdHash != bytes32(0), "ProofID: invalid hash");

        identities[proofIdHash] = Identity({
            proofIdHash:    proofIdHash,
            owner:          msg.sender,
            createdAt:      block.timestamp,
            reputationScore: 100,  // starting score
            isVerified:     false,
            isActive:       true,
            metadataURI:    metadataURI
        });

        walletToIdentity[msg.sender] = proofIdHash;
        totalIdentities++;

        emit IdentityRegistered(proofIdHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Mark an identity as human-verified (only trusted issuers can call)
     */
    function verifyIdentity(bytes32 proofIdHash) external onlyTrustedIssuer identityExists(proofIdHash) {
        identities[proofIdHash].isVerified = true;
        emit IdentityVerified(proofIdHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Update metadata URI
     */
    function updateMetadataURI(bytes32 proofIdHash, string calldata newURI)
        external
        identityExists(proofIdHash)
        onlyIdentityOwner(proofIdHash)
    {
        identities[proofIdHash].metadataURI = newURI;
        emit IdentityUpdated(proofIdHash, block.timestamp);
    }

    /**
     * @notice Update reputation score (only trusted issuers)
     */
    function updateReputation(bytes32 proofIdHash, uint256 newScore)
        external
        onlyTrustedIssuer
        identityExists(proofIdHash)
    {
        require(newScore <= 1000, "ProofID: score out of range");
        identities[proofIdHash].reputationScore = newScore;
        emit ReputationUpdated(proofIdHash, newScore, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    //  Credential Functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Issue a verifiable credential to an identity
     */
    function issueCredential(
        bytes32 proofIdHash,
        string  calldata credentialType,
        uint256 expiresAt
    ) external onlyTrustedIssuer identityExists(proofIdHash) returns (uint256 credIndex) {
        bytes32 credentialHash = keccak256(
            abi.encodePacked(proofIdHash, credentialType, block.timestamp, msg.sender)
        );

        credIndex = credentialCount[proofIdHash];
        credentials[proofIdHash][credIndex] = Credential({
            credentialHash:  credentialHash,
            credentialType:  credentialType,
            issuer:          msg.sender,
            issuedAt:        block.timestamp,
            expiresAt:       expiresAt,
            revoked:         false
        });
        credentialCount[proofIdHash]++;

        emit CredentialIssued(proofIdHash, credentialHash, credentialType, block.timestamp);
    }

    /**
     * @notice Revoke a credential
     */
    function revokeCredential(bytes32 proofIdHash, uint256 credentialIndex)
        external
        onlyTrustedIssuer
        identityExists(proofIdHash)
    {
        require(credentialIndex < credentialCount[proofIdHash], "ProofID: invalid credential index");
        credentials[proofIdHash][credentialIndex].revoked = true;
        emit CredentialRevoked(proofIdHash, credentialIndex, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    //  AI Agent Functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Register an AI agent owned by an identity
     */
    function registerAgent(
        bytes32 agentIdHash,
        bytes32 ownerProofIdHash,
        string  calldata metadataURI
    ) external identityExists(ownerProofIdHash) {
        require(identities[ownerProofIdHash].owner == msg.sender, "ProofID: not identity owner");
        require(agents[agentIdHash].registeredAt == 0, "ProofID: agent already registered");
        require(agentIdHash != bytes32(0), "ProofID: invalid agent hash");

        agents[agentIdHash] = AIAgent({
            agentIdHash:       agentIdHash,
            ownerProofIdHash:  ownerProofIdHash,
            ownerWallet:       msg.sender,
            registeredAt:      block.timestamp,
            reputationScore:   100,
            isVerified:        false,
            isActive:          true,
            metadataURI:       metadataURI
        });

        ownerAgents[ownerProofIdHash].push(agentIdHash);
        totalAgents++;

        emit AgentRegistered(agentIdHash, ownerProofIdHash, block.timestamp);
    }

    /**
     * @notice Update agent reputation
     */
    function updateAgentReputation(bytes32 agentIdHash, uint256 newScore) external onlyTrustedIssuer {
        require(agents[agentIdHash].registeredAt != 0, "ProofID: agent not found");
        require(newScore <= 1000, "ProofID: score out of range");
        agents[agentIdHash].reputationScore = newScore;
        emit AgentReputationUpdated(agentIdHash, newScore, block.timestamp);
    }

    /**
     * @notice Verify an AI agent
     */
    function verifyAgent(bytes32 agentIdHash) external onlyTrustedIssuer {
        require(agents[agentIdHash].registeredAt != 0, "ProofID: agent not found");
        agents[agentIdHash].isVerified = true;
        emit AgentVerified(agentIdHash, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    //  View Functions
    // ─────────────────────────────────────────────────────────────

    function getIdentity(bytes32 proofIdHash) external view returns (Identity memory) {
        return identities[proofIdHash];
    }

    function getCredential(bytes32 proofIdHash, uint256 index) external view returns (Credential memory) {
        return credentials[proofIdHash][index];
    }

    function getCredentialCount(bytes32 proofIdHash) external view returns (uint256) {
        return credentialCount[proofIdHash];
    }

    function getAgent(bytes32 agentIdHash) external view returns (AIAgent memory) {
        return agents[agentIdHash];
    }

    function getOwnerAgents(bytes32 ownerProofIdHash) external view returns (bytes32[] memory) {
        return ownerAgents[ownerProofIdHash];
    }

    function isIdentityVerified(bytes32 proofIdHash) external view returns (bool) {
        return identities[proofIdHash].isVerified;
    }

    function getIdentityByWallet(address wallet) external view returns (Identity memory) {
        bytes32 hash = walletToIdentity[wallet];
        return identities[hash];
    }

    // ─────────────────────────────────────────────────────────────
    //  Admin Functions
    // ─────────────────────────────────────────────────────────────

    function addTrustedIssuer(address issuer) external onlyOwner {
        trustedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    function removeTrustedIssuer(address issuer) external onlyOwner {
        trustedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ProofID: zero address");
        owner = newOwner;
    }
}
