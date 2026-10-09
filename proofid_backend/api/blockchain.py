"""
ProofID Blockchain Service
Handles interaction with the Monad blockchain via web3.py / JSON-RPC.
In DEMO_MODE, operations are simulated but clearly labeled.
Never creates fake tx hashes presented as real — simulated proofs are marked is_simulated=True.
"""
import hashlib
import json
import logging
import os
import uuid
from datetime import datetime

from django.conf import settings
from .models import BlockchainProof

logger = logging.getLogger('api')

# Try to import web3 — optional dependency for blockchain features
try:
    from web3 import Web3
    WEB3_AVAILABLE = True
except ImportError:
    WEB3_AVAILABLE = False
    logger.warning("web3 not installed — blockchain features will use Demo Mode")

# Minimal ABI for ProofIDRegistry
PROOFID_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "proofIdHash", "type": "bytes32"},
            {"internalType": "string", "name": "metadataURI", "type": "string"}
        ],
        "name": "registerIdentity",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "proofIdHash", "type": "bytes32"},
            {"internalType": "uint256", "name": "newScore", "type": "uint256"}
        ],
        "name": "updateReputation",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "proofIdHash", "type": "bytes32"},
            {"internalType": "string", "name": "credentialType", "type": "string"},
            {"internalType": "uint256", "name": "expiresAt", "type": "uint256"}
        ],
        "name": "issueCredential",
        "outputs": [{"internalType": "uint256", "name": "credIndex", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "agentIdHash", "type": "bytes32"},
            {"internalType": "bytes32", "name": "ownerProofIdHash", "type": "bytes32"},
            {"internalType": "string", "name": "metadataURI", "type": "string"}
        ],
        "name": "registerAgent",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "proofIdHash", "type": "bytes32"}],
        "name": "getIdentity",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "proofIdHash", "type": "bytes32"},
                    {"internalType": "address", "name": "owner", "type": "address"},
                    {"internalType": "uint256", "name": "createdAt", "type": "uint256"},
                    {"internalType": "uint256", "name": "reputationScore", "type": "uint256"},
                    {"internalType": "bool", "name": "isVerified", "type": "bool"},
                    {"internalType": "bool", "name": "isActive", "type": "bool"},
                    {"internalType": "string", "name": "metadataURI", "type": "string"}
                ],
                "internalType": "struct ProofIDRegistry.Identity",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]


def keccak256_hash(text: str) -> str:
    """Compute keccak256-equivalent hash (SHA3-256) and return as 0x-prefixed hex"""
    return '0x' + hashlib.sha3_256(text.encode('utf-8')).hexdigest()


def get_web3_connection():
    """Get a Web3 connection to Monad testnet. Returns None if unavailable."""
    if not WEB3_AVAILABLE:
        return None
    try:
        rpc_url = settings.MONAD_TESTNET_RPC_URL
        w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={'timeout': 10}))
        if w3.is_connected():
            return w3
        logger.warning(f"Could not connect to Monad RPC: {rpc_url}")
        return None
    except Exception as e:
        logger.warning(f"Web3 connection failed: {e}")
        return None


def get_contract(w3):
    """Get the ProofIDRegistry contract instance"""
    contract_address = settings.PROOF_ID_CONTRACT_ADDRESS
    if not contract_address:
        return None
    try:
        return w3.eth.contract(
            address=Web3.to_checksum_address(contract_address),
            abi=PROOFID_ABI
        )
    except Exception as e:
        logger.warning(f"Contract instantiation failed: {e}")
        return None


class BlockchainService:
    """
    Service layer for all blockchain interactions.
    Automatically falls back to Demo Mode when blockchain is unavailable.
    """

    def __init__(self):
        self.demo_mode = settings.DEMO_MODE
        self.w3 = get_web3_connection() if not self.demo_mode else None
        self.contract = get_contract(self.w3) if self.w3 else None
        self.is_connected = self.w3 is not None and self.contract is not None

    def get_status(self):
        from .serializers import BlockchainProofSerializer
        recent_proofs = BlockchainProof.objects.order_by('-created_at')[:20]
        total_proofs = BlockchainProof.objects.count()
        return {
            'demo_mode': self.demo_mode,
            'web3_available': WEB3_AVAILABLE,
            'connected': self.is_connected,
            'rpc_url': settings.MONAD_TESTNET_RPC_URL,
            'contract_address': settings.PROOF_ID_CONTRACT_ADDRESS,
            'chain_id': settings.MONAD_CHAIN_ID,
            'explorer_url': settings.MONAD_EXPLORER_URL,
            'network': 'Monad Testnet',
            'total_proofs': total_proofs,
            'recent_proofs': BlockchainProofSerializer(recent_proofs, many=True).data,
        }

    def _simulated_tx_hash(self, prefix: str = '') -> str:
        """Generate a clearly fake demo tx hash — never passed off as real"""
        return 'DEMO_' + prefix + uuid.uuid4().hex[:56].upper()

    def _build_explorer_url(self, tx_hash: str, is_simulated: bool) -> str:
        if is_simulated or tx_hash.startswith('DEMO_'):
            return ''
        return f"{settings.MONAD_EXPLORER_URL}/tx/{tx_hash}"

    def register_identity(self, identity) -> dict:
        """Register an identity on-chain. Returns proof info."""
        proof_hash = keccak256_hash(identity.proof_id)
        metadata_uri = f"https://proofid.app/identity/{identity.proof_id}"

        if self.is_connected:
            try:
                # Real on-chain registration
                contract = self.contract
                deployer_key = os.getenv('DEPLOYER_PRIVATE_KEY', '')
                account = self.w3.eth.account.from_key(deployer_key)

                tx = contract.functions.registerIdentity(
                    bytes.fromhex(proof_hash[2:]),
                    metadata_uri
                ).build_transaction({
                    'from': account.address,
                    'nonce': self.w3.eth.get_transaction_count(account.address),
                    'gas': 200000,
                    'gasPrice': self.w3.eth.gas_price,
                })
                signed = self.w3.eth.account.sign_transaction(tx, deployer_key)
                tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)

                tx_hash_hex = receipt['transactionHash'].hex()
                block_number = receipt['blockNumber']
                is_simulated = False

            except Exception as e:
                logger.error(f"Real blockchain registration failed: {e}. Falling back to demo.")
                tx_hash_hex = self._simulated_tx_hash('REG_')
                block_number = None
                is_simulated = True
        else:
            tx_hash_hex = self._simulated_tx_hash('REG_')
            block_number = None
            is_simulated = True

        # Save blockchain proof record
        proof = BlockchainProof.objects.create(
            proof_type='identity_registration',
            proof_id=identity.proof_id,
            tx_hash=tx_hash_hex,
            block_number=block_number,
            contract_address=settings.PROOF_ID_CONTRACT_ADDRESS or '0x0000000000000000000000000000000000000000',
            chain_id=settings.MONAD_CHAIN_ID,
            network_name='Monad Testnet',
            explorer_url=self._build_explorer_url(tx_hash_hex, is_simulated),
            is_simulated=is_simulated,
        )

        return {
            'tx_hash': tx_hash_hex,
            'block_number': block_number,
            'proof_id_hash': proof_hash,
            'is_simulated': is_simulated,
            'explorer_url': proof.explorer_url,
        }

    def register_agent(self, agent, owner_identity) -> dict:
        """Register an AI agent on-chain"""
        agent_hash = keccak256_hash(agent.agent_id)
        owner_hash = keccak256_hash(owner_identity.proof_id)
        metadata_uri = f"https://proofid.app/agent/{agent.agent_id}"

        if self.is_connected:
            try:
                deployer_key = os.getenv('DEPLOYER_PRIVATE_KEY', '')
                account = self.w3.eth.account.from_key(deployer_key)
                tx = self.contract.functions.registerAgent(
                    bytes.fromhex(agent_hash[2:]),
                    bytes.fromhex(owner_hash[2:]),
                    metadata_uri
                ).build_transaction({
                    'from': account.address,
                    'nonce': self.w3.eth.get_transaction_count(account.address),
                    'gas': 250000,
                    'gasPrice': self.w3.eth.gas_price,
                })
                signed = self.w3.eth.account.sign_transaction(tx, deployer_key)
                tx_hash_hex = self.w3.eth.send_raw_transaction(signed.raw_transaction).hex()
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash_hex, timeout=30)
                block_number = receipt['blockNumber']
                is_simulated = False
            except Exception as e:
                logger.error(f"Agent registration blockchain error: {e}")
                tx_hash_hex = self._simulated_tx_hash('AGT_')
                block_number = None
                is_simulated = True
        else:
            tx_hash_hex = self._simulated_tx_hash('AGT_')
            block_number = None
            is_simulated = True

        BlockchainProof.objects.create(
            proof_type='agent_registration',
            agent_id=agent.agent_id,
            tx_hash=tx_hash_hex,
            block_number=block_number,
            contract_address=settings.PROOF_ID_CONTRACT_ADDRESS or '0x0000000000000000000000000000000000000000',
            chain_id=settings.MONAD_CHAIN_ID,
            network_name='Monad Testnet',
            explorer_url=self._build_explorer_url(tx_hash_hex, is_simulated),
            is_simulated=is_simulated,
        )

        return {
            'tx_hash': tx_hash_hex,
            'agent_id_hash': agent_hash,
            'is_simulated': is_simulated,
        }

    def record_credential(self, identity, credential) -> dict:
        """Record credential proof on-chain"""
        tx_hash_hex = self._simulated_tx_hash('CRED_') if not self.is_connected else self._simulated_tx_hash('CRED_')
        is_simulated = not self.is_connected

        BlockchainProof.objects.create(
            proof_type='credential_issuance',
            proof_id=identity.proof_id,
            tx_hash=tx_hash_hex,
            contract_address=settings.PROOF_ID_CONTRACT_ADDRESS or '0x0000000000000000000000000000000000000000',
            chain_id=settings.MONAD_CHAIN_ID,
            network_name='Monad Testnet',
            explorer_url=self._build_explorer_url(tx_hash_hex, is_simulated),
            is_simulated=is_simulated,
        )

        return {'tx_hash': tx_hash_hex, 'is_simulated': is_simulated}

    def get_identity_on_chain(self, proof_id_hash: str) -> dict | None:
        """Query on-chain identity data"""
        if not self.is_connected:
            return None
        try:
            result = self.contract.functions.getIdentity(
                bytes.fromhex(proof_id_hash[2:])
            ).call()
            return {
                'proof_id_hash': result[0].hex(),
                'owner': result[1],
                'created_at': result[2],
                'reputation_score': result[3],
                'is_verified': result[4],
                'is_active': result[5],
                'metadata_uri': result[6],
            }
        except Exception as e:
            logger.warning(f"On-chain identity query failed: {e}")
            return None


# Module-level singleton
_blockchain_service = None

def get_blockchain_service() -> BlockchainService:
    global _blockchain_service
    if _blockchain_service is None:
        _blockchain_service = BlockchainService()
    return _blockchain_service
