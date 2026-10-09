"""
ProofID Django Models
All sensitive data stays off-chain. Only hashes, public IDs, and proofs touch the blockchain.
"""
import uuid
import hashlib
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


def generate_proof_id():
    """Generate a unique human-readable ProofID like PID-A3F9B2C1"""
    uid = uuid.uuid4().hex[:8].upper()
    return f"PID-{uid}"


class Identity(models.Model):
    """Core off-chain identity record"""
    VERIFICATION_STATUS = [
        ('unverified', 'Unverified'),
        ('pending', 'Pending'),
        ('verified', 'Verified'),
        ('revoked', 'Revoked'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='identity')
    proof_id = models.CharField(max_length=20, unique=True, default=generate_proof_id)
    display_name = models.CharField(max_length=100)
    bio = models.TextField(blank=True)
    avatar_url = models.URLField(blank=True)
    website = models.URLField(blank=True)
    twitter_handle = models.CharField(max_length=50, blank=True)
    github_handle = models.CharField(max_length=50, blank=True)
    # Verification
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_STATUS, default='unverified')
    verified_at = models.DateTimeField(null=True, blank=True)
    # Wallet
    wallet_address = models.CharField(max_length=42, blank=True)  # Ethereum/Monad address
    wallet_connected_at = models.DateTimeField(null=True, blank=True)
    # Blockchain proof
    blockchain_tx_hash = models.CharField(max_length=66, blank=True)
    blockchain_registered = models.BooleanField(default=False)
    blockchain_registered_at = models.DateTimeField(null=True, blank=True)
    # Proof hash (keccak256 of proof_id — stored on-chain)
    proof_id_hash = models.CharField(max_length=66, blank=True)
    # Metadata
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Identities'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.proof_id} ({self.display_name})"

    def get_proof_id_hash(self):
        """Compute keccak256-like hash using SHA3-256 for on-chain registration"""
        return '0x' + hashlib.sha3_256(self.proof_id.encode()).hexdigest()

    @property
    def reputation_score(self):
        """Computed from reputation events"""
        events = self.reputation_events.all()
        if not events.exists():
            return 100
        total = sum(e.score_delta for e in events)
        base = 100
        score = max(0, min(1000, base + total))
        return score

    @property
    def credential_count(self):
        return self.credentials.filter(is_revoked=False).count()


class WebAuthnCredential(models.Model):
    """WebAuthn / Passkey credential storage"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='webauthn_credentials')
    # WebAuthn fields (no private keys stored)
    credential_id = models.TextField(unique=True)  # base64url encoded credential ID
    public_key = models.TextField()  # CBOR-encoded public key (safe to store)
    sign_count = models.BigIntegerField(default=0)
    aaguid = models.CharField(max_length=36, blank=True)
    device_name = models.CharField(max_length=100, default='Passkey')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'WebAuthn Credential'

    def __str__(self):
        return f"{self.user.username} - {self.device_name}"


class Credential(models.Model):
    """Verifiable Credential issued to an identity"""
    CREDENTIAL_TYPES = [
        # Government & Identity Proofs
        ('DRIVING_LICENSE', "Driver's License"),
        ('PASSPORT', 'Passport Verification'),
        ('NATIONAL_ID', 'National ID / Aadhaar / SSN'),
        ('VOTER_ID', 'Voter Registration / Voter ID Card'),
        ('TAX_ID', 'Tax Identification (SSN / PAN / TIN)'),
        ('WORK_PERMIT', 'Work Permit / Residency Visa'),
        ('PROOF_OF_ADDRESS', 'Proof of Residence / Address'),
        ('BIOMETRIC_ID', 'Biometric / FaceMatch Liveness'),
        ('HUMAN_VERIFIED', 'Human Verified (Proof of Humanity)'),
        # Professional & Academic
        ('EMPLOYMENT_VERIFIED', 'Employment & Company ID'),
        ('UNIVERSITY_DEGREE', 'University Degree / Diploma'),
        ('FINANCIAL_KYC', 'Financial KYC / Accredited Investor'),
        ('LEGAL_LICENSE', 'Legal / Bar License'),
        ('MEDICAL_LICENSE', 'Medical Practitioner License'),
        # Developer & Web3 Badges
        ('DEVELOPER', 'Developer (GitHub / GitLab Oracle)'),
        ('AI_RESEARCHER', 'AI Researcher (ArXiv / Benchmark)'),
        ('WEB3_BUILDER', 'Web3 & Monad Builder'),
        ('HACKATHON_BUILDER', 'Hackathon Builder / Winner'),
        ('SECURITY_RESEARCHER', 'Security Auditor / Bug Bounty'),
        ('OPEN_SOURCE', 'Open Source Contributor'),
        ('STUDENT', 'Student / Academic Fellow'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    identity = models.ForeignKey(Identity, on_delete=models.CASCADE, related_name='credentials')
    credential_type = models.CharField(max_length=50, choices=CREDENTIAL_TYPES)
    issuer_name = models.CharField(max_length=100, default='ProofID Authority')
    issuer_wallet = models.CharField(max_length=42, blank=True)
    evidence_url = models.CharField(max_length=500, blank=True)
    notes = models.TextField(blank=True)
    # Blockchain proof
    credential_hash = models.CharField(max_length=66, blank=True)
    blockchain_tx_hash = models.CharField(max_length=66, blank=True)
    blockchain_index = models.IntegerField(null=True, blank=True)
    # Status
    is_revoked = models.BooleanField(default=False)
    revoked_at = models.DateTimeField(null=True, blank=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-issued_at']
        unique_together = ['identity', 'credential_type']

    def __str__(self):
        return f"{self.identity.proof_id} - {self.credential_type}"

    @property
    def is_active(self):
        if self.is_revoked:
            return False
        if self.expires_at and timezone.now() > self.expires_at:
            return False
        return True


class ReputationEvent(models.Model):
    """Transparent audit trail of reputation changes"""
    EVENT_TYPES = [
        ('credential_issued', 'Credential Issued'),
        ('credential_revoked', 'Credential Revoked'),
        ('identity_verified', 'Identity Verified'),
        ('ai_task_completed', 'AI Task Completed'),
        ('ai_task_failed', 'AI Task Failed'),
        ('report_submitted', 'Report Submitted'),
        ('report_received', 'Report Received'),
        ('wallet_connected', 'Wallet Connected'),
        ('blockchain_registered', 'Blockchain Registered'),
        ('verification_request', 'Verification Request'),
        ('trust_report_generated', 'Trust Report Generated'),
        ('activity_completed', 'Activity Completed'),
        ('peer_endorsement', 'Peer Endorsement'),
        ('violation', 'Policy Violation'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    identity = models.ForeignKey(Identity, on_delete=models.CASCADE, related_name='reputation_events')
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES)
    score_delta = models.IntegerField()  # positive or negative
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    triggered_by = models.CharField(max_length=100, blank=True)  # system, user ID, agent ID
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        sign = '+' if self.score_delta >= 0 else ''
        return f"{self.identity.proof_id} | {self.event_type} ({sign}{self.score_delta})"


class AIAgent(models.Model):
    """Autonomous AI Agent registered under a human identity"""
    AGENT_STATUS = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('suspended', 'Suspended'),
        ('pending_verification', 'Pending Verification'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent_id = models.CharField(max_length=20, unique=True)  # AGT-XXXXXXXX
    owner = models.ForeignKey(Identity, on_delete=models.CASCADE, related_name='ai_agents')
    name = models.CharField(max_length=100)
    description = models.TextField()
    capabilities = models.JSONField(default=list)  # list of capability strings
    model_name = models.CharField(max_length=100, blank=True)  # e.g. "claude-3-5-sonnet"
    version = models.CharField(max_length=20, default='1.0.0')
    endpoint_url = models.URLField(blank=True)
    # Verification
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=AGENT_STATUS, default='active')
    # Blockchain
    agent_id_hash = models.CharField(max_length=66, blank=True)
    blockchain_tx_hash = models.CharField(max_length=66, blank=True)
    blockchain_registered = models.BooleanField(default=False)
    # Stats
    total_tasks = models.IntegerField(default=0)
    successful_tasks = models.IntegerField(default=0)
    failed_tasks = models.IntegerField(default=0)
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.agent_id} ({self.name})"

    def generate_agent_id(self):
        uid = uuid.uuid4().hex[:8].upper()
        return f"AGT-{uid}"

    @property
    def success_rate(self):
        if self.total_tasks == 0:
            return 0.0
        return round((self.successful_tasks / self.total_tasks) * 100, 1)

    @property
    def reputation_score(self):
        events = self.activity_logs.all()
        base = 100
        delta = sum(e.score_impact for e in events)
        return max(0, min(1000, base + delta))


class AgentActivity(models.Model):
    """Activity log for AI agents"""
    ACTIVITY_TYPES = [
        ('task_completed', 'Task Completed'),
        ('task_failed', 'Task Failed'),
        ('api_call', 'API Call'),
        ('data_access', 'Data Access'),
        ('report_generated', 'Report Generated'),
        ('verification_check', 'Verification Check'),
        ('credential_lookup', 'Credential Lookup'),
        ('identity_query', 'Identity Query'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent = models.ForeignKey(AIAgent, on_delete=models.CASCADE, related_name='activity_logs')
    activity_type = models.CharField(max_length=50, choices=ACTIVITY_TYPES)
    description = models.TextField()
    input_data = models.JSONField(default=dict, blank=True)  # sanitized, no PII
    output_summary = models.TextField(blank=True)
    score_impact = models.IntegerField(default=0)
    duration_ms = models.IntegerField(null=True, blank=True)
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.agent.agent_id} - {self.activity_type}"


class VerificationRequest(models.Model):
    """Public verification lookup record"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('not_found', 'Not Found'),
        ('error', 'Error'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    query = models.CharField(max_length=100)  # ProofID, agent ID, or wallet
    query_type = models.CharField(max_length=20, default='proof_id')  # proof_id, agent_id, wallet
    requester_ip = models.GenericIPAddressField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    result_summary = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class BlockchainProof(models.Model):
    """On-chain proof records linked to off-chain entities"""
    PROOF_TYPES = [
        ('identity_registration', 'Identity Registration'),
        ('credential_issuance', 'Credential Issuance'),
        ('agent_registration', 'Agent Registration'),
        ('reputation_update', 'Reputation Update'),
        ('verification', 'Verification'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proof_type = models.CharField(max_length=30, choices=PROOF_TYPES)
    # Reference to off-chain entity
    proof_id = models.CharField(max_length=20, blank=True)
    agent_id = models.CharField(max_length=20, blank=True)
    # On-chain data
    tx_hash = models.CharField(max_length=66)
    block_number = models.BigIntegerField(null=True, blank=True)
    contract_address = models.CharField(max_length=42)
    chain_id = models.IntegerField(default=10143)
    network_name = models.CharField(max_length=50, default='Monad Testnet')
    explorer_url = models.URLField(blank=True)
    # Demo mode flag
    is_simulated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.proof_type} - {self.tx_hash[:10]}..."


class TrustReport(models.Model):
    """AI-generated trust analysis report"""
    SUBJECT_TYPES = [('identity', 'Identity'), ('agent', 'Agent')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject_type = models.CharField(max_length=20, choices=SUBJECT_TYPES)
    subject_id = models.CharField(max_length=30)  # proof_id or agent_id
    # Report content
    trust_score = models.IntegerField()  # 0-100
    strengths = models.JSONField(default=list)
    risks = models.JSONField(default=list)
    confidence = models.CharField(max_length=20)  # LOW, MEDIUM, HIGH
    recommendation = models.TextField()
    full_analysis = models.TextField()
    # Signals used (no PII)
    signals_used = models.JSONField(default=dict)
    # AI model info (transparency)
    ai_model = models.CharField(max_length=50, default='claude-3-5-sonnet')
    is_simulated = models.BooleanField(default=False)
    generated_at = models.DateTimeField(auto_now_add=True)
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return f"TrustReport({self.subject_id}) score={self.trust_score}"


class AuditLog(models.Model):
    """System audit log for all significant actions"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=100)
    resource_type = models.CharField(max_length=50)
    resource_id = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    success = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} by {self.user} at {self.created_at}"
