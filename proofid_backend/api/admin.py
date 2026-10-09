"""ProofID Django Admin"""
from django.contrib import admin
from .models import (
    Identity, WebAuthnCredential, Credential, ReputationEvent,
    AIAgent, AgentActivity, VerificationRequest, BlockchainProof, TrustReport, AuditLog
)

@admin.register(Identity)
class IdentityAdmin(admin.ModelAdmin):
    list_display = ['proof_id', 'display_name', 'verification_status', 'blockchain_registered', 'created_at']
    list_filter = ['verification_status', 'blockchain_registered']
    search_fields = ['proof_id', 'display_name', 'wallet_address']
    readonly_fields = ['proof_id', 'proof_id_hash', 'created_at', 'updated_at']

@admin.register(Credential)
class CredentialAdmin(admin.ModelAdmin):
    list_display = ['identity', 'credential_type', 'is_revoked', 'issued_at']
    list_filter = ['credential_type', 'is_revoked']

@admin.register(ReputationEvent)
class ReputationEventAdmin(admin.ModelAdmin):
    list_display = ['identity', 'event_type', 'score_delta', 'created_at']
    list_filter = ['event_type']

@admin.register(AIAgent)
class AIAgentAdmin(admin.ModelAdmin):
    list_display = ['agent_id', 'name', 'owner', 'is_verified', 'total_tasks', 'created_at']
    list_filter = ['is_verified', 'status']

@admin.register(AgentActivity)
class AgentActivityAdmin(admin.ModelAdmin):
    list_display = ['agent', 'activity_type', 'success', 'score_impact', 'created_at']

@admin.register(BlockchainProof)
class BlockchainProofAdmin(admin.ModelAdmin):
    list_display = ['proof_type', 'proof_id', 'tx_hash', 'is_simulated', 'created_at']

@admin.register(TrustReport)
class TrustReportAdmin(admin.ModelAdmin):
    list_display = ['subject_id', 'subject_type', 'trust_score', 'confidence', 'is_simulated', 'generated_at']

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'user', 'resource_type', 'success', 'created_at']
    list_filter = ['action', 'success']

admin.site.register(WebAuthnCredential)
admin.site.register(VerificationRequest)
