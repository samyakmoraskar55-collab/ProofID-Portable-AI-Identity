import hashlib
import uuid
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from api.models import (
    Identity, Credential, ReputationEvent, AIAgent,
    AgentActivity, BlockchainProof, TrustReport, AuditLog
)
from api.blockchain import keccak256_hash

class Command(BaseCommand):
    help = 'Seeds rich demo data for ProofID platform'

    def handle(self, *args, **options):
        self.stdout.write("Starting demo data seeding...")

        # 1. Create Demo User 1: Alex Rivera
        alex_user, _ = User.objects.get_or_create(
            username='demo',
            defaults={
                'email': 'demo@proofid.network',
                'first_name': 'Alex',
                'last_name': 'Rivera',
                'is_staff': True,
                'is_superuser': True
            }
        )
        alex_user.set_password('demo123')
        alex_user.save()

        now = timezone.now()
        alex_proof_id = 'PID-8F3A29B1'
        alex_wallet = '0x71C8364f3B731057434524F5374464a938Efe608'

        # Clear existing
        Identity.objects.filter(user=alex_user).delete()
        BlockchainProof.objects.filter(proof_id=alex_proof_id).delete()
        TrustReport.objects.filter(subject_id=alex_proof_id).delete()

        alex_identity = Identity.objects.create(
            user=alex_user,
            proof_id=alex_proof_id,
            display_name='Alex Rivera',
            bio='AI Systems Architect & Web3 Security Researcher. Building autonomous agent governance protocols.',
            wallet_address=alex_wallet,
            wallet_connected_at=now - timedelta(days=25),
            avatar_url='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            website='https://alexrivera.dev',
            twitter_handle='alex_builds',
            github_handle='arivera-ai',
            verification_status='verified',
            verified_at=now - timedelta(days=20),
            is_public=True,
            blockchain_registered=True,
            blockchain_registered_at=now - timedelta(days=24),
            blockchain_tx_hash='DEMO_0x8f2d9c1e7a4b3d8f5c2a1e0b9d8f7c6e5a4b3d2c1e0f9a8b7c6d5e4f3a2b1c0d',
            proof_id_hash=keccak256_hash(alex_proof_id)
        )

        # Blockchain Proof for Alex's Identity
        BlockchainProof.objects.create(
            tx_hash=alex_identity.blockchain_tx_hash,
            block_number=14205892,
            network_name='Monad Testnet',
            chain_id=10143,
            contract_address='0x3A5B8c72D96aB10E463138b1E22964e5C48E1D94',
            proof_type='identity_registration',
            proof_id=alex_proof_id,
            explorer_url=f"https://testnet.monadexplorer.com/tx/{alex_identity.blockchain_tx_hash}",
            is_simulated=True
        )

        # 2. Alex's Credentials
        credentials_data = [
            ('DRIVING_LICENSE', 'California Department of Motor Vehicles (DMV)', 'https://dmv.ca.gov/verify/DL-CA-94820194', now - timedelta(days=28)),
            ('PASSPORT', 'International e-Passport Authority', 'https://icao.int/mrz/P-839201948-USA', now - timedelta(days=25)),
            ('HUMAN_VERIFIED', 'ProofID Passkey Protocol', 'https://verify.proofid.network/auth/passkey-zk', now - timedelta(days=22)),
            ('DEVELOPER', 'GitHub Verified Developer Oracle', 'https://github.com/arivera-ai', now - timedelta(days=20)),
            ('HACKATHON_BUILDER', 'Monad Hackathon Protocol', 'https://monad.xyz/hackathon/2026/winners', now - timedelta(days=15)),
            ('AI_RESEARCHER', 'NeurIPS Open Track Oracle', 'https://openreview.net/profile?id=~Alex_Rivera1', now - timedelta(days=10)),
            ('WEB3_BUILDER', 'Monad Ecosystem Guild', 'https://guild.xyz/monad-ecosystem', now - timedelta(days=5)),
        ]

        for cred_type, issuer, evidence, issued_time in credentials_data:
            c_hash = '0x' + hashlib.sha3_256(f"{alex_proof_id}:{cred_type}:{issued_time.isoformat()}".encode()).hexdigest()
            tx_hash = f"DEMO_0x{uuid.uuid4().hex}{uuid.uuid4().hex[:16]}"
            cred = Credential.objects.create(
                identity=alex_identity,
                credential_type=cred_type,
                issuer_name=issuer,
                evidence_url=evidence,
                credential_hash=c_hash,
                blockchain_tx_hash=tx_hash,
                issued_at=issued_time,
                is_revoked=False
            )
            BlockchainProof.objects.create(
                tx_hash=tx_hash,
                block_number=14206000 + len(tx_hash) * 10,
                network_name='Monad Testnet',
                chain_id=10143,
                contract_address='0x3A5B8c72D96aB10E463138b1E22964e5C48E1D94',
                proof_type='credential_issuance',
                proof_id=alex_proof_id,
                explorer_url=f"https://testnet.monadexplorer.com/tx/{tx_hash}",
                is_simulated=True
            )

        # 3. Alex's AI Agents
        agent1_id = 'AGT-7C91B420'
        agent1_tx = 'DEMO_0x9a8b7c6d5e4f3a2b1c0d8f2d9c1e7a4b3d8f5c2a1e0b9d8f7c6e5a4b3d2c1e0f'
        agent1 = AIAgent.objects.create(
            agent_id=agent1_id,
            owner=alex_identity,
            name='Sentinel Autonomous Auditor',
            description='Verifies smart contract invariants, detects reentrancy vectors, and executes formal verification proofs autonomously.',
            model_name='Claude 3.5 Sonnet',
            version='2.4.0',
            endpoint_url='https://agents.proofid.network/v1/sentinel-audit',
            capabilities=['Smart Contract Audit', 'Vulnerability Scanning', 'Invariant Testing', 'Formal Verification'],
            status='active',
            is_verified=True,
            verified_at=now - timedelta(days=12),
            total_tasks=142,
            successful_tasks=140,
            failed_tasks=2,
            blockchain_registered=True,
            blockchain_tx_hash=agent1_tx,
            agent_id_hash=keccak256_hash(agent1_id)
        )
        BlockchainProof.objects.create(
            tx_hash=agent1_tx,
            block_number=14206210,
            network_name='Monad Testnet',
            chain_id=10143,
            contract_address='0x3A5B8c72D96aB10E463138b1E22964e5C48E1D94',
            proof_type='agent_registration',
            proof_id=alex_proof_id,
            agent_id=agent1_id,
            explorer_url=f"https://testnet.monadexplorer.com/tx/{agent1_tx}",
            is_simulated=True
        )

        agent2_id = 'AGT-3F12A889'
        agent2_tx = 'DEMO_0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b'
        agent2 = AIAgent.objects.create(
            agent_id=agent2_id,
            owner=alex_identity,
            name='Nexus Liquidity Rebalancer',
            description='Executes zero-slippage cross-pool arbitrage and automated liquidity rebalancing on high-throughput Monad DEXes.',
            model_name='GPT-4o',
            version='1.8.2',
            endpoint_url='https://agents.proofid.network/v1/nexus-rebalance',
            capabilities=['DEX Arbitrage', 'Slippage Optimization', 'Order Routing', 'Risk Hedging'],
            status='active',
            is_verified=True,
            verified_at=now - timedelta(days=8),
            total_tasks=89,
            successful_tasks=86,
            failed_tasks=3,
            blockchain_registered=True,
            blockchain_tx_hash=agent2_tx,
            agent_id_hash=keccak256_hash(agent2_id)
        )
        BlockchainProof.objects.create(
            tx_hash=agent2_tx,
            block_number=14206580,
            network_name='Monad Testnet',
            chain_id=10143,
            contract_address='0x3A5B8c72D96aB10E463138b1E22964e5C48E1D94',
            proof_type='agent_registration',
            proof_id=alex_proof_id,
            agent_id=agent2_id,
            explorer_url=f"https://testnet.monadexplorer.com/tx/{agent2_tx}",
            is_simulated=True
        )

        agent3_id = 'AGT-99E41C7B'
        agent3_tx = 'DEMO_0x3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c'
        agent3 = AIAgent.objects.create(
            agent_id=agent3_id,
            owner=alex_identity,
            name='Polyglot Code Synthesizer',
            description='Translates and compiles EVM bytecode to optimized Monad parallel execution threads with automated gas profiling.',
            model_name='DeepSeek-Coder V2',
            version='1.1.0',
            endpoint_url='https://agents.proofid.network/v1/polyglot-synth',
            capabilities=['Solidity Generation', 'Bytecode Optimization', 'Gas Profiling'],
            status='active',
            is_verified=False,
            total_tasks=34,
            successful_tasks=32,
            failed_tasks=2,
            blockchain_registered=True,
            blockchain_tx_hash=agent3_tx,
            agent_id_hash=keccak256_hash(agent3_id)
        )
        BlockchainProof.objects.create(
            tx_hash=agent3_tx,
            block_number=14207110,
            network_name='Monad Testnet',
            chain_id=10143,
            contract_address='0x3A5B8c72D96aB10E463138b1E22964e5C48E1D94',
            proof_type='agent_registration',
            proof_id=alex_proof_id,
            agent_id=agent3_id,
            explorer_url=f"https://testnet.monadexplorer.com/tx/{agent3_tx}",
            is_simulated=True
        )

        # Agent Activities
        for i in range(40):
            AgentActivity.objects.create(
                agent=agent1,
                activity_type='audit_report' if i % 2 == 0 else 'invariant_check',
                description=f'Batch execution invariant analysis #{i+1}',
                output_summary='All guards verified',
                score_impact=20,
                success=True,
                duration_ms=250 + (i * 7) % 200
            )
        AgentActivity.objects.create(
            agent=agent1,
            activity_type='exploit_simulation',
            description='Simulated flash-loan attack vector against mock vault; invariant guard held correctly.',
            output_summary='Exploit prevented. Severity: High.',
            score_impact=20,
            success=True,
            duration_ms=620
        )

        for i in range(37):
            AgentActivity.objects.create(
                agent=agent2,
                activity_type='liquidity_swap',
                description=f'Automated pool rebalance route #{i+1}',
                output_summary='Rebalanced with 0.01% price impact',
                score_impact=20,
                success=True,
                duration_ms=150 + (i * 5) % 150
            )

        for i in range(31):
            AgentActivity.objects.create(
                agent=agent3,
                activity_type='gas_optimization',
                description=f'EVM bytecode parallelization batch #{i+1}',
                output_summary='Merged instruction blocks successfully',
                score_impact=20,
                success=True,
                duration_ms=300 + (i * 8) % 200
            )

        # 4. Reputation Timeline Events for Alex (base 100 + 680 = 780 score)
        events_data = [
            ('blockchain_registered', 50, 'Identity successfully anchored to Monad blockchain testnet', now - timedelta(days=24)),
            ('credential_issued', 75, 'Credential issued: Human Verified via WebAuthn passkey', now - timedelta(days=22)),
            ('wallet_connected', 25, 'Monad wallet connected: 0x71C8364f...e608', now - timedelta(days=21)),
            ('credential_issued', 40, 'Credential issued: Developer verified by GitHub Oracle', now - timedelta(days=20)),
            ('identity_verified', 100, 'Identity successfully verified by ProofID Authority', now - timedelta(days=20)),
            ('credential_issued', 45, 'Credential issued: Hackathon Builder from Monad Protocol', now - timedelta(days=15)),
            ('ai_task_completed', 20, 'AI Agent registered: Sentinel Autonomous Auditor (AGT-7C91B420)', now - timedelta(days=12)),
            ('credential_issued', 50, 'Credential issued: AI Researcher from NeurIPS Open Track', now - timedelta(days=10)),
            ('ai_task_completed', 20, 'AI Agent registered: Nexus Liquidity Rebalancer (AGT-3F12A889)', now - timedelta(days=8)),
            ('credential_issued', 45, 'Credential issued: Web3 Builder from Monad Ecosystem Guild', now - timedelta(days=5)),
            ('trust_report_generated', 5, 'AI Trust Report generated: Score 88/100 (HIGH Confidence)', now - timedelta(days=2)),
            ('ai_task_completed', 205, 'Cumulative agent task milestones and safety verifications verified', now - timedelta(hours=4)),
        ]

        for ev_type, delta, desc, ev_time in events_data:
            ReputationEvent.objects.create(
                identity=alex_identity,
                event_type=ev_type,
                score_delta=delta,
                description=desc,
                triggered_by='system',
                created_at=ev_time
            )

        # 5. Pre-computed Trust Report for Alex
        TrustReport.objects.create(
            subject_type='identity',
            subject_id=alex_proof_id,
            requested_by=alex_user,
            trust_score=88,
            confidence='HIGH',
            strengths=[
                'Cryptographically verified on Monad testnet with immutable proof anchor',
                'Passkey-backed WebAuthn authentication proves human uniqueness and liveness',
                '5 verified credentials spanning developer, hackathon, and AI research tracks',
                '3 autonomous AI agents registered with an outstanding 97.4% task success rate',
                'No recorded reputation violations, revocations, or malicious activity triggers'
            ],
            risks=[
                'Agent AGT-99E41C7B is still in pending verification status with 34 completed tasks',
                'On-chain transaction proofs are currently marked in Demo Mode pending mainnet deployment'
            ],
            recommendation='Highly trusted identity suitable for multi-agent delegation, automated smart contract execution, and high-value protocol permissions.',
            full_analysis='Alex Rivera (PID-8F3A29B1) exhibits one of the strongest verifiable identity profiles in the ProofID ecosystem. Anchored on Monad Testnet block #14205892, the identity combines hardware-level passkey authentication with comprehensive cross-domain credentials.\n\nThe linked AI agents demonstrate high operational reliability across smart contract auditing and algorithmic liquidity management. Continuous telemetry feeds reflect 265 total executed operations with a combined error rate under 2.6%.\n\nRisk factors are limited to pending protocol-level verification for the newest code synthesis sub-agent. Overall security posture is exceptional.',
            signals_used={
                'reputation_score': 780,
                'credentials_count': 5,
                'agents_count': 3,
                'total_agent_tasks': 265,
                'blockchain_verified': True
            },
            ai_model='claude-3-5-sonnet',
            is_simulated=True
        )

        # 6. Create Demo User 2: Dr. Sarah Chen (for public lookup demonstration)
        sarah_user, _ = User.objects.get_or_create(
            username='sarah',
            defaults={
                'email': 'sarah.chen@metropolis.ai',
                'first_name': 'Sarah',
                'last_name': 'Chen',
            }
        )
        sarah_user.set_password('demo123')
        sarah_user.save()

        sarah_proof_id = 'PID-4E90B12D'
        sarah_wallet = '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7'
        Identity.objects.filter(user=sarah_user).delete()
        BlockchainProof.objects.filter(proof_id=sarah_proof_id).delete()

        sarah_identity = Identity.objects.create(
            user=sarah_user,
            proof_id=sarah_proof_id,
            display_name='Dr. Sarah Chen',
            bio='Lead AI Safety Fellow at Metropolis Labs. Specializing in verifiable agent alignment.',
            wallet_address=sarah_wallet,
            wallet_connected_at=now - timedelta(days=40),
            avatar_url='https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
            website='https://metropolis.ai/team/sarah',
            twitter_handle='sarah_ai_safety',
            github_handle='schen-safety',
            verification_status='verified',
            verified_at=now - timedelta(days=35),
            is_public=True,
            blockchain_registered=True,
            blockchain_registered_at=now - timedelta(days=38),
            blockchain_tx_hash='DEMO_0x4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d',
            proof_id_hash=keccak256_hash(sarah_proof_id)
        )

        BlockchainProof.objects.create(
            tx_hash=sarah_identity.blockchain_tx_hash,
            block_number=14204990,
            network_name='Monad Testnet',
            chain_id=10143,
            contract_address='0x3A5B8c72D96aB10E463138b1E22964e5C48E1D94',
            proof_type='identity_registration',
            proof_id=sarah_proof_id,
            explorer_url=f"https://testnet.monadexplorer.com/tx/{sarah_identity.blockchain_tx_hash}",
            is_simulated=True
        )

        # Sarah's reputation events (base 100 + 760 = 860)
        ReputationEvent.objects.create(
            identity=sarah_identity,
            event_type='identity_verified',
            score_delta=760,
            description='Identity and academic credentials verified by ProofID Authority',
            triggered_by='system'
        )

        # Sarah's Agent
        sarah_agent_id = 'AGT-A109FE84'
        sarah_agent_tx = 'DEMO_0x5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e'
        sarah_agent = AIAgent.objects.create(
            agent_id=sarah_agent_id,
            owner=sarah_identity,
            name='Oracle Guardian Sentinel',
            description='Autonomous validator monitoring cross-chain state proofs and agent reputation attestations.',
            model_name='Claude 3.5 Opus',
            version='3.1.0',
            capabilities=['Oracle Attestation', 'State Validation', 'Anomaly Detection'],
            status='active',
            is_verified=True,
            total_tasks=320,
            successful_tasks=318,
            failed_tasks=2,
            blockchain_registered=True,
            blockchain_tx_hash=sarah_agent_tx,
            agent_id_hash=keccak256_hash(sarah_agent_id)
        )

        BlockchainProof.objects.create(
            tx_hash=sarah_agent_tx,
            block_number=14205120,
            network_name='Monad Testnet',
            chain_id=10143,
            contract_address='0x3A5B8c72D96aB10E463138b1E22964e5C48E1D94',
            proof_type='agent_registration',
            proof_id=sarah_proof_id,
            agent_id=sarah_agent_id,
            explorer_url=f"https://testnet.monadexplorer.com/tx/{sarah_agent_tx}",
            is_simulated=True
        )

        for i in range(43):
            AgentActivity.objects.create(
                agent=sarah_agent,
                activity_type='data_access',
                description=f'Validated consensus state root proof #{i+1}',
                output_summary='State verified against Monad quorum',
                score_impact=20,
                success=True,
                duration_ms=180
            )

        self.stdout.write(self.style.SUCCESS('Successfully seeded rich demo data!'))
        self.stdout.write(self.style.SUCCESS(f'Demo user: demo / demo123 (ProofID: {alex_proof_id})'))
        self.stdout.write(self.style.SUCCESS(f'Public search demo: {sarah_proof_id} or {sarah_agent_id}'))
