"""
ProofID REST API Serializers
"""
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import (
    Identity, WebAuthnCredential, Credential, ReputationEvent,
    AIAgent, AgentActivity, VerificationRequest, BlockchainProof,
    TrustReport, AuditLog
)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'date_joined']
        read_only_fields = ['id', 'date_joined']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name']

    def validate(self, data):
        pwd = data.get('password')
        pwd_confirm = data.get('password_confirm')
        if pwd_confirm and pwd != pwd_confirm:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        email = data.get('email')
        if email and User.objects.filter(email=email).exists():
            raise serializers.ValidationError({'email': 'An account with this email already exists.'})
        username = data.get('username')
        if username and User.objects.filter(username=username).exists():
            raise serializers.ValidationError({'username': 'This username is already taken.'})
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm', None)
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # Auto-create initial Identity so credentials & dashboard work immediately
        if not hasattr(user, 'identity'):
            display_name = (f"{user.first_name} {user.last_name}").strip() or user.username
            identity = Identity.objects.create(
                user=user,
                display_name=display_name,
                bio=f"Decentralized AI and human trust profile for {display_name}."
            )
            identity.proof_id_hash = identity.get_proof_id_hash()
            identity.save()

            ReputationEvent.objects.create(
                identity=identity,
                event_type='verification_request',
                score_delta=100,
                description='Initial ProofID identity registered',
                triggered_by='system',
            )

        return user


class CredentialSerializer(serializers.ModelSerializer):
    credential_type_display = serializers.CharField(source='get_credential_type_display', read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Credential
        fields = [
            'id', 'credential_type', 'credential_type_display', 'issuer_name',
            'issuer_wallet', 'evidence_url', 'notes', 'credential_hash',
            'blockchain_tx_hash', 'blockchain_index', 'is_revoked', 'is_active',
            'issued_at', 'expires_at', 'revoked_at'
        ]
        read_only_fields = ['id', 'credential_hash', 'blockchain_tx_hash', 'blockchain_index', 'issued_at']


class ReputationEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)

    class Meta:
        model = ReputationEvent
        fields = [
            'id', 'event_type', 'event_type_display', 'score_delta',
            'description', 'metadata', 'triggered_by', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class IdentitySerializer(serializers.ModelSerializer):
    credentials = CredentialSerializer(many=True, read_only=True)
    reputation_events = ReputationEventSerializer(many=True, read_only=True)
    reputation_score = serializers.IntegerField(read_only=True)
    credential_count = serializers.IntegerField(read_only=True)
    verification_status_display = serializers.CharField(source='get_verification_status_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = Identity
        fields = [
            'id', 'proof_id', 'username', 'email', 'display_name', 'bio',
            'avatar_url', 'website', 'twitter_handle', 'github_handle',
            'verification_status', 'verification_status_display', 'verified_at',
            'wallet_address', 'wallet_connected_at',
            'blockchain_tx_hash', 'blockchain_registered', 'blockchain_registered_at',
            'proof_id_hash', 'is_public', 'reputation_score', 'credential_count',
            'credentials', 'reputation_events', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'proof_id', 'proof_id_hash', 'blockchain_tx_hash',
            'blockchain_registered', 'blockchain_registered_at',
            'verified_at', 'wallet_connected_at', 'created_at', 'updated_at'
        ]


class IdentityPublicSerializer(serializers.ModelSerializer):
    """Public-safe serializer — strips private fields"""
    credentials = CredentialSerializer(many=True, read_only=True)
    reputation_score = serializers.IntegerField(read_only=True)
    credential_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Identity
        fields = [
            'proof_id', 'display_name', 'bio', 'avatar_url', 'website',
            'twitter_handle', 'github_handle', 'verification_status',
            'wallet_address', 'blockchain_tx_hash', 'blockchain_registered',
            'proof_id_hash', 'reputation_score', 'credential_count', 'credentials',
            'created_at'
        ]


class AgentActivitySerializer(serializers.ModelSerializer):
    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)

    class Meta:
        model = AgentActivity
        fields = [
            'id', 'activity_type', 'activity_type_display', 'description',
            'output_summary', 'score_impact', 'duration_ms', 'success',
            'error_message', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class AIAgentSerializer(serializers.ModelSerializer):
    success_rate = serializers.FloatField(read_only=True)
    reputation_score = serializers.IntegerField(read_only=True)
    recent_activities = serializers.SerializerMethodField()
    owner_proof_id = serializers.CharField(source='owner.proof_id', read_only=True)

    class Meta:
        model = AIAgent
        fields = [
            'id', 'agent_id', 'owner_proof_id', 'name', 'description',
            'capabilities', 'model_name', 'version', 'endpoint_url',
            'is_verified', 'verified_at', 'status',
            'agent_id_hash', 'blockchain_tx_hash', 'blockchain_registered',
            'total_tasks', 'successful_tasks', 'failed_tasks',
            'success_rate', 'reputation_score', 'recent_activities',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'agent_id', 'agent_id_hash', 'blockchain_tx_hash',
            'blockchain_registered', 'is_verified', 'verified_at',
            'total_tasks', 'successful_tasks', 'failed_tasks', 'created_at', 'updated_at'
        ]

    def get_recent_activities(self, obj):
        activities = obj.activity_logs.order_by('-created_at')[:5]
        return AgentActivitySerializer(activities, many=True).data


class AIAgentPublicSerializer(serializers.ModelSerializer):
    success_rate = serializers.FloatField(read_only=True)
    reputation_score = serializers.IntegerField(read_only=True)
    owner_proof_id = serializers.CharField(source='owner.proof_id', read_only=True)

    class Meta:
        model = AIAgent
        fields = [
            'agent_id', 'owner_proof_id', 'name', 'description', 'capabilities',
            'model_name', 'version', 'is_verified', 'status',
            'agent_id_hash', 'blockchain_tx_hash', 'blockchain_registered',
            'total_tasks', 'successful_tasks', 'failed_tasks',
            'success_rate', 'reputation_score', 'created_at'
        ]


class TrustReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrustReport
        fields = [
            'id', 'subject_type', 'subject_id', 'trust_score', 'strengths',
            'risks', 'confidence', 'recommendation', 'full_analysis',
            'signals_used', 'ai_model', 'is_simulated', 'generated_at'
        ]
        read_only_fields = ['id', 'generated_at']


class BlockchainProofSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlockchainProof
        fields = [
            'id', 'proof_type', 'proof_id', 'agent_id', 'tx_hash',
            'block_number', 'contract_address', 'chain_id', 'network_name',
            'explorer_url', 'is_simulated', 'created_at'
        ]


class VerificationResultSerializer(serializers.Serializer):
    """Combined verification result for the public verify endpoint"""
    found = serializers.BooleanField()
    query_type = serializers.CharField()
    identity = IdentityPublicSerializer(allow_null=True)
    agent = AIAgentPublicSerializer(allow_null=True)
    blockchain_proof = BlockchainProofSerializer(allow_null=True)
    trust_summary = serializers.DictField()
