"""
ProofID REST API Views
"""
import hashlib
import logging
import uuid
from django.contrib.auth.models import User
from django.conf import settings
from django.utils import timezone
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    Identity, WebAuthnCredential, Credential, ReputationEvent,
    AIAgent, AgentActivity, VerificationRequest, BlockchainProof, TrustReport, AuditLog
)
from .serializers import (
    UserSerializer, RegisterSerializer, IdentitySerializer, IdentityPublicSerializer,
    CredentialSerializer, ReputationEventSerializer, AIAgentSerializer,
    AIAgentPublicSerializer, AgentActivitySerializer, TrustReportSerializer,
    BlockchainProofSerializer
)
from .blockchain import get_blockchain_service, keccak256_hash
from .trust_analyzer import generate_trust_report

logger = logging.getLogger('api')


def log_audit(user, action, resource_type, resource_id='', request=None, success=True, metadata=None):
    try:
        ip = None
        ua = ''
        if request:
            ip = request.META.get('REMOTE_ADDR')
            ua = request.META.get('HTTP_USER_AGENT', '')
        AuditLog.objects.create(
            user=user,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            ip_address=ip,
            user_agent=ua[:500],
            metadata=metadata or {},
            success=success,
        )
    except Exception as e:
        logger.warning(f"Audit log failed: {e}")


# ─────────────────────────────────────────────────────────────
#  Auth Views
# ─────────────────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            log_audit(user, 'register', 'user', user.id, request)
            return Response({
                'message': 'Account created successfully',
                'user': UserSerializer(user).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                },
                'has_identity': hasattr(user, 'identity'),
                'proof_id': user.identity.proof_id if hasattr(user, 'identity') else None
            }, status=status.HTTP_201_CREATED)
        
        # Flatten errors for front-end clarity
        err_messages = []
        for field, errs in serializer.errors.items():
            if isinstance(errs, list):
                err_messages.append(f"{field.capitalize()}: {errs[0]}")
            else:
                err_messages.append(f"{field}: {errs}")
        error_summary = " ".join(err_messages) if err_messages else "Registration validation failed."
        return Response({'error': error_summary, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        from django.contrib.auth import authenticate
        user = authenticate(username=username, password=password)
        if not user:
            # Try email login
            try:
                u = User.objects.get(email=username)
                user = authenticate(username=u.username, password=password)
            except (User.DoesNotExist, User.MultipleObjectsReturned):
                pass
        if user and user.is_active:
            refresh = RefreshToken.for_user(user)
            log_audit(user, 'login', 'user', user.id, request)
            return Response({
                'user': UserSerializer(user).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                },
                'has_identity': hasattr(user, 'identity'),
                'proof_id': user.identity.proof_id if hasattr(user, 'identity') else None
            })
        log_audit(None, 'login_failed', 'user', username, request, success=False)
        return Response({'error': 'Invalid username or password. Try demo / demo123'}, status=status.HTTP_401_UNAUTHORIZED)


class GoogleAuthView(APIView):
    """Google One-Click OAuth / Social Sign-In"""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        name = request.data.get('name', '').strip()
        avatar = request.data.get('avatar', '')

        if not email:
            # Default Google demo profile if not specified
            email = 'alex.rivera.dev@gmail.com'
            name = name or 'Alex Rivera (Google)'

        username = email.split('@')[0].replace('.', '_').replace('-', '_')[:30]

        # Find or create user
        user = User.objects.filter(email=email).first()
        if not user:
            # Ensure unique username
            base_username = username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}_{counter}"
                counter += 1

            first_name = name.split(' ')[0] if ' ' in name else name
            last_name = ' '.join(name.split(' ')[1:]) if ' ' in name else ''
            user = User.objects.create(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name
            )
            user.set_unusable_password()
            user.save()

        # Ensure Identity exists
        if not hasattr(user, 'identity'):
            display_name = name or user.username
            identity = Identity.objects.create(
                user=user,
                display_name=display_name,
                avatar_url=avatar,
                bio=f"Verified Google User · Monad Trust Layer Profile",
                is_public=True
            )
            identity.proof_id_hash = identity.get_proof_id_hash()
            identity.save()

            # Auto-issue Google & Human Verification credentials
            Credential.objects.create(
                identity=identity,
                credential_type='HUMAN_VERIFIED',
                issuer_name='Google Identity Services (OAuth2.0)',
                notes='OAuth2.0 OpenID Connect Verified Email & Biometrics'
            )
            ReputationEvent.objects.create(
                identity=identity,
                event_type='identity_verified',
                score_delta=150,
                description='Identity verified via Google OAuth2.0 OpenID Connect',
                triggered_by='google_oauth'
            )

        refresh = RefreshToken.for_user(user)
        log_audit(user, 'google_login', 'user', user.id, request)
        return Response({
            'message': 'Logged in with Google successfully',
            'user': UserSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            'has_identity': hasattr(user, 'identity'),
            'proof_id': user.identity.proof_id if hasattr(user, 'identity') else None
        })


class GitHubAuthView(APIView):
    """GitHub One-Click Developer Sign-In"""
    permission_classes = [AllowAny]

    def post(self, request):
        gh_username = request.data.get('username', '').strip() or 'alexrivera-monad'
        email = request.data.get('email', '').strip().lower() or f"{gh_username}@users.noreply.github.com"
        name = request.data.get('name', '').strip() or gh_username

        username = f"gh_{gh_username}"[:30]

        user = User.objects.filter(username=username).first()
        if not user:
            user = User.objects.filter(email=email).first()

        if not user:
            user = User.objects.create(
                username=username,
                email=email,
                first_name=name
            )
            user.set_unusable_password()
            user.save()

        # Ensure Identity exists
        if not hasattr(user, 'identity'):
            identity = Identity.objects.create(
                user=user,
                display_name=name,
                github_handle=gh_username,
                bio=f"GitHub Open Source Developer & Monad Builder (@{gh_username})",
                is_public=True
            )
            identity.proof_id_hash = identity.get_proof_id_hash()
            identity.save()

            # Auto-issue Developer credential
            Credential.objects.create(
                identity=identity,
                credential_type='DEVELOPER',
                issuer_name='GitHub Oracle Protocol',
                evidence_url=f"https://github.com/{gh_username}",
                notes=f"GitHub Verified Developer @{gh_username}"
            )
            ReputationEvent.objects.create(
                identity=identity,
                event_type='credential_issued',
                score_delta=140,
                description=f'Developer credential anchored from GitHub (@{gh_username})',
                triggered_by='github_oauth'
            )

        refresh = RefreshToken.for_user(user)
        log_audit(user, 'github_login', 'user', user.id, request)
        return Response({
            'message': 'Logged in with GitHub successfully',
            'user': UserSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            'has_identity': hasattr(user, 'identity'),
            'proof_id': user.identity.proof_id if hasattr(user, 'identity') else None
        })


class Web3AuthView(APIView):
    """Web3 Wallet / Monad EVM Sign-In"""
    permission_classes = [AllowAny]

    def post(self, request):
        wallet_address = request.data.get('address', '').strip()
        if not wallet_address or not wallet_address.startswith('0x') or len(wallet_address) != 42:
            wallet_address = '0x71C8364f3B731057434524F5374464a938Efe608'

        short_addr = f"{wallet_address[:6]}...{wallet_address[-4:]}"
        username = f"monad_{wallet_address[-8:].lower()}"

        user = User.objects.filter(username=username).first()
        if not user:
            user = User.objects.create(
                username=username,
                email=f"{wallet_address.lower()}@monad.proofid",
                first_name=short_addr
            )
            user.set_unusable_password()
            user.save()

        # Ensure Identity exists
        if not hasattr(user, 'identity'):
            identity = Identity.objects.create(
                user=user,
                display_name=f"Monad Builder ({short_addr})",
                wallet_address=wallet_address,
                wallet_connected_at=timezone.now(),
                bio=f"Monad Testnet Native Identity (Chain ID 10143)",
                blockchain_registered=True,
                blockchain_registered_at=timezone.now(),
                is_public=True
            )
            identity.proof_id_hash = identity.get_proof_id_hash()
            identity.save()

            # Auto-issue Web3 Builder credential
            Credential.objects.create(
                identity=identity,
                credential_type='WEB3_BUILDER',
                issuer_name='Monad Network EVM Oracle',
                issuer_wallet=wallet_address,
                notes=f"EVM Wallet {wallet_address} authenticated on Monad Testnet"
            )
            ReputationEvent.objects.create(
                identity=identity,
                event_type='wallet_connected',
                score_delta=125,
                description=f'Monad wallet connected and attested: {short_addr}',
                triggered_by='web3_auth'
            )

        refresh = RefreshToken.for_user(user)
        log_audit(user, 'web3_login', 'user', user.id, request)
        return Response({
            'message': 'Logged in with Web3 Wallet successfully',
            'user': UserSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            'has_identity': hasattr(user, 'identity'),
            'proof_id': user.identity.proof_id if hasattr(user, 'identity') else None
        })


class DemoProfileLoginView(APIView):
    """Switch instantly between test profiles (Alex Rivera, Dr. Sarah Chen, Marcus Vance)"""
    permission_classes = [AllowAny]

    def post(self, request):
        profile = request.data.get('profile', 'alex').lower()

        profiles = {
            'alex': {'username': 'demo', 'name': 'Alex Rivera', 'role': 'Lead AI Systems Architect'},
            'sarah': {'username': 'sarah_chen', 'name': 'Dr. Sarah Chen', 'role': 'AI Safety & Alignment Researcher'},
            'marcus': {'username': 'marcus_web3', 'name': 'Marcus Vance', 'role': 'Monad Parallel EVM Core Dev'}
        }

        cfg = profiles.get(profile, profiles['alex'])
        user = User.objects.filter(username=cfg['username']).first()

        if not user:
            # Create user & identity
            user = User.objects.create_user(
                username=cfg['username'],
                email=f"{cfg['username']}@proofid.network",
                password='demo123',
                first_name=cfg['name'].split(' ')[0],
                last_name=' '.join(cfg['name'].split(' ')[1:])
            )
            identity = Identity.objects.create(
                user=user,
                display_name=cfg['name'],
                bio=cfg['role'],
                is_public=True
            )
            identity.proof_id_hash = identity.get_proof_id_hash()
            identity.save()

            if profile == 'sarah':
                Credential.objects.create(
                    identity=identity,
                    credential_type='AI_RESEARCHER',
                    issuer_name='OpenAI / Anthropic Safety Fellow'
                )
                Credential.objects.create(
                    identity=identity,
                    credential_type='PASSPORT',
                    issuer_name='International e-Passport Authority'
                )
            elif profile == 'marcus':
                Credential.objects.create(
                    identity=identity,
                    credential_type='WEB3_BUILDER',
                    issuer_name='Monad Foundation Guild'
                )
                Credential.objects.create(
                    identity=identity,
                    credential_type='DRIVING_LICENSE',
                    issuer_name='California Department of Motor Vehicles'
                )

        refresh = RefreshToken.for_user(user)
        log_audit(user, f'demo_login_{profile}', 'user', user.id, request)
        return Response({
            'message': f'Logged in as {cfg["name"]}',
            'user': UserSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            'has_identity': hasattr(user, 'identity'),
            'proof_id': user.identity.proof_id if hasattr(user, 'identity') else None
        })


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        has_identity = hasattr(request.user, 'identity')
        data = UserSerializer(request.user).data
        data['has_identity'] = has_identity
        if has_identity:
            data['proof_id'] = request.user.identity.proof_id
            data['verification_status'] = request.user.identity.verification_status
            data['reputation_score'] = request.user.identity.reputation_score
        return Response(data)


# ─────────────────────────────────────────────────────────────
#  Identity Views
# ─────────────────────────────────────────────────────────────

class IdentityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            identity = request.user.identity
            return Response(IdentitySerializer(identity).data)
        except Identity.DoesNotExist:
            return Response({'error': 'No identity found. Please create your ProofID.'}, status=404)

    def post(self, request):
        """Create a new identity"""
        if hasattr(request.user, 'identity'):
            return Response({'error': 'You already have a ProofID identity.'}, status=400)

        display_name = request.data.get('display_name', '').strip()
        bio = request.data.get('bio', '').strip()
        if not display_name:
            return Response({'error': 'display_name is required'}, status=400)

        # Create identity
        identity = Identity.objects.create(
            user=request.user,
            display_name=display_name,
            bio=bio,
            avatar_url=request.data.get('avatar_url', ''),
            website=request.data.get('website', ''),
            twitter_handle=request.data.get('twitter_handle', ''),
            github_handle=request.data.get('github_handle', ''),
            is_public=request.data.get('is_public', True),
        )

        # Compute proof hash
        identity.proof_id_hash = identity.get_proof_id_hash()
        identity.save()

        # Register on blockchain
        blockchain = get_blockchain_service()
        try:
            blockchain_result = blockchain.register_identity(identity)
            identity.blockchain_tx_hash = blockchain_result['tx_hash']
            identity.blockchain_registered = True
            identity.blockchain_registered_at = timezone.now()
            identity.save()

            # Add reputation event for blockchain registration
            ReputationEvent.objects.create(
                identity=identity,
                event_type='blockchain_registered',
                score_delta=50,
                description='Identity successfully anchored to Monad blockchain',
                triggered_by='system',
                metadata={'tx_hash': blockchain_result['tx_hash'], 'is_simulated': blockchain_result['is_simulated']}
            )
        except Exception as e:
            logger.error(f"Blockchain registration failed: {e}")

        # Reputation event for creation
        ReputationEvent.objects.create(
            identity=identity,
            event_type='verification_request',
            score_delta=10,
            description='ProofID identity created',
            triggered_by='system',
        )

        log_audit(request.user, 'create_identity', 'identity', identity.proof_id, request)
        return Response(IdentitySerializer(identity).data, status=201)

    def patch(self, request):
        """Update identity profile"""
        try:
            identity = request.user.identity
        except Identity.DoesNotExist:
            return Response({'error': 'Identity not found'}, status=404)

        allowed_fields = ['display_name', 'bio', 'avatar_url', 'website', 'twitter_handle', 'github_handle', 'is_public']
        for field in allowed_fields:
            if field in request.data:
                setattr(identity, field, request.data[field])
        identity.save()
        log_audit(request.user, 'update_identity', 'identity', identity.proof_id, request)
        return Response(IdentitySerializer(identity).data)


class VerifyIdentityView(APIView):
    """Admin/issuer verification endpoint"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            identity = request.user.identity
        except Identity.DoesNotExist:
            return Response({'error': 'No identity found'}, status=404)

        if identity.verification_status == 'verified':
            return Response({'message': 'Already verified', 'identity': IdentitySerializer(identity).data})

        # In a real system, this would require proof — for demo, simulation with clear labeling
        identity.verification_status = 'verified'
        identity.verified_at = timezone.now()
        identity.save()

        ReputationEvent.objects.create(
            identity=identity,
            event_type='identity_verified',
            score_delta=100,
            description='Identity successfully verified by ProofID authority',
            triggered_by='system',
        )

        log_audit(request.user, 'verify_identity', 'identity', identity.proof_id, request)
        return Response({
            'message': 'Identity verified successfully',
            'identity': IdentitySerializer(identity).data
        })


class ConnectWalletView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        wallet_address = request.data.get('wallet_address', '').strip()
        if not wallet_address or not wallet_address.startswith('0x') or len(wallet_address) != 42:
            return Response({'error': 'Invalid wallet address. Must be a valid Ethereum/Monad address.'}, status=400)

        try:
            identity = request.user.identity
        except Identity.DoesNotExist:
            return Response({'error': 'Create your ProofID first'}, status=404)

        # Check uniqueness
        if Identity.objects.filter(wallet_address=wallet_address).exclude(pk=identity.pk).exists():
            return Response({'error': 'This wallet is already connected to another identity.'}, status=400)

        was_new = not identity.wallet_address
        identity.wallet_address = wallet_address
        identity.wallet_connected_at = timezone.now()
        identity.save()

        if was_new:
            ReputationEvent.objects.create(
                identity=identity,
                event_type='wallet_connected',
                score_delta=25,
                description=f'Monad wallet connected: {wallet_address[:10]}...{wallet_address[-4:]}',
                triggered_by='user',
            )

        return Response({'message': 'Wallet connected', 'wallet_address': wallet_address})


# ─────────────────────────────────────────────────────────────
#  Credentials Views
# ─────────────────────────────────────────────────────────────

class CredentialViewSet(viewsets.ModelViewSet):
    serializer_class = CredentialSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Credential.objects.filter(identity__user=self.request.user)

    def create(self, request, *args, **kwargs):
        # Ensure identity exists or create one automatically
        try:
            identity = request.user.identity
        except Identity.DoesNotExist:
            display_name = (f"{request.user.first_name} {request.user.last_name}").strip() or request.user.username
            identity = Identity.objects.create(
                user=request.user,
                display_name=display_name,
                bio="ProofID Verifiable Trust & Identity Profile",
                is_public=True
            )
            identity.proof_id_hash = identity.get_proof_id_hash()
            identity.save()

        credential_type = request.data.get('credential_type')
        if not credential_type:
            return Response({'error': 'credential_type is required'}, status=400)

        valid_types = [ct[0] for ct in Credential.CREDENTIAL_TYPES]
        if credential_type not in valid_types:
            return Response({'error': f'Invalid credential type: {credential_type}'}, status=400)

        delta_map = {
            'DRIVING_LICENSE': 75,
            'PASSPORT': 85,
            'NATIONAL_ID': 85,
            'VOTER_ID': 65,
            'TAX_ID': 70,
            'WORK_PERMIT': 60,
            'PROOF_OF_ADDRESS': 40,
            'BIOMETRIC_ID': 70,
            'HUMAN_VERIFIED': 75,
            'EMPLOYMENT_VERIFIED': 50,
            'UNIVERSITY_DEGREE': 60,
            'FINANCIAL_KYC': 65,
            'LEGAL_LICENSE': 60,
            'MEDICAL_LICENSE': 60,
            'DEVELOPER': 40,
            'AI_RESEARCHER': 50,
            'WEB3_BUILDER': 45,
            'HACKATHON_BUILDER': 45,
            'SECURITY_RESEARCHER': 55,
            'OPEN_SOURCE': 35,
            'STUDENT': 30,
        }
        delta = delta_map.get(credential_type, 40)

        issuer_name = request.data.get('issuer_name', '').strip() or 'ProofID Authority'
        issuer_wallet = request.data.get('issuer_wallet', '').strip()
        evidence_url = request.data.get('evidence_url', '').strip()
        notes = request.data.get('notes', '').strip()

        # Check if already exists — if so, update & re-anchor instead of failing
        existing = Credential.objects.filter(identity=identity, credential_type=credential_type).first()
        if existing:
            existing.issuer_name = issuer_name
            existing.issuer_wallet = issuer_wallet
            existing.evidence_url = evidence_url
            existing.notes = notes
            existing.is_revoked = False
            existing.revoked_at = None
            existing.issued_at = timezone.now()

            # Compute credential hash
            cred_hash_input = f"{identity.proof_id}:{credential_type}:{existing.issued_at.isoformat()}"
            existing.credential_hash = '0x' + hashlib.sha3_256(cred_hash_input.encode()).hexdigest()

            # Record on blockchain
            blockchain = get_blockchain_service()
            bc_result = blockchain.record_credential(identity, existing)
            existing.blockchain_tx_hash = bc_result['tx_hash']
            existing.save()

            ReputationEvent.objects.create(
                identity=identity,
                event_type='credential_issued',
                score_delta=delta,
                description=f'Credential updated & re-anchored on Monad: {existing.get_credential_type_display()}',
                triggered_by='system',
                metadata={'credential_id': str(existing.id), 'type': credential_type, 'tx_hash': bc_result['tx_hash']}
            )

            log_audit(request.user, 'update_credential', 'credential', existing.id, request)
            return Response(CredentialSerializer(existing).data, status=status.HTTP_200_OK)

        # Create new credential
        credential = Credential.objects.create(
            identity=identity,
            credential_type=credential_type,
            issuer_name=issuer_name,
            issuer_wallet=issuer_wallet,
            evidence_url=evidence_url,
            notes=notes,
        )

        # Compute credential hash
        cred_hash_input = f"{identity.proof_id}:{credential_type}:{credential.issued_at.isoformat()}"
        credential.credential_hash = '0x' + hashlib.sha3_256(cred_hash_input.encode()).hexdigest()

        # Record on blockchain
        blockchain = get_blockchain_service()
        bc_result = blockchain.record_credential(identity, credential)
        credential.blockchain_tx_hash = bc_result['tx_hash']
        credential.save()

        # Reputation event
        ReputationEvent.objects.create(
            identity=identity,
            event_type='credential_issued',
            score_delta=delta,
            description=f'Credential issued & anchored on Monad: {credential.get_credential_type_display()}',
            triggered_by='system',
            metadata={'credential_id': str(credential.id), 'type': credential_type, 'tx_hash': bc_result['tx_hash']}
        )

        log_audit(request.user, 'add_credential', 'credential', credential.id, request)
        return Response(CredentialSerializer(credential).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        cred = self.get_object()
        cred.is_revoked = True
        cred.revoked_at = timezone.now()
        cred.save()

        ReputationEvent.objects.create(
            identity=cred.identity,
            event_type='credential_revoked',
            score_delta=-20,
            description=f'Credential revoked: {cred.get_credential_type_display()}',
            triggered_by='user',
        )
        return Response({'message': 'Credential revoked successfully'})


class CredentialTypesView(APIView):
    """List all available credential types and ID proofs with metadata"""
    permission_classes = [AllowAny]

    def get(self, request):
        types_data = [
            # Government & Identity Proofs
            {
                'id': 'DRIVING_LICENSE',
                'name': "Driver's License",
                'category': 'identity',
                'category_label': 'Government & Identity Proofs',
                'icon': '🪪',
                'badge_color': 'amber',
                'reputation_delta': 75,
                'description': 'Official government motor vehicle driving license verification with state/province DMV proof.',
                'placeholder_doc': 'e.g. DL-CA-94820194',
                'issuer_default': 'Department of Motor Vehicles (DMV)'
            },
            {
                'id': 'PASSPORT',
                'name': 'Passport Verification',
                'category': 'identity',
                'category_label': 'Government & Identity Proofs',
                'icon': '🛂',
                'badge_color': 'blue',
                'reputation_delta': 85,
                'description': 'International e-Passport cryptographic proof with ICAO 9303 machine-readable zone verification.',
                'placeholder_doc': 'e.g. P-839201948',
                'issuer_default': 'International e-Passport Authority'
            },
            {
                'id': 'NATIONAL_ID',
                'name': 'National ID / Aadhaar / SSN',
                'category': 'identity',
                'category_label': 'Government & Identity Proofs',
                'icon': '🪪',
                'badge_color': 'emerald',
                'reputation_delta': 85,
                'description': 'Official sovereign national citizen card or unique identity credential.',
                'placeholder_doc': 'e.g. NID-4920-5819-2041',
                'issuer_default': 'National Identity Authority'
            },
            {
                'id': 'VOTER_ID',
                'name': 'Voter Registration / Voter ID',
                'category': 'identity',
                'category_label': 'Government & Identity Proofs',
                'icon': '🗳️',
                'badge_color': 'cyan',
                'reputation_delta': 65,
                'description': 'Electoral roll voter registration verification with state/national election commission proof.',
                'placeholder_doc': 'e.g. VOTE-EL-882941',
                'issuer_default': 'Election & Electoral Commission'
            },
            {
                'id': 'TAX_ID',
                'name': 'Tax ID / Social Security (SSN / PAN / TIN)',
                'category': 'identity',
                'category_label': 'Government & Identity Proofs',
                'icon': '📑',
                'badge_color': 'amber',
                'reputation_delta': 70,
                'description': 'Federal revenue or tax compliance identification with hashed zero-knowledge validation.',
                'placeholder_doc': 'e.g. TAX-US-991823',
                'issuer_default': 'Tax & Revenue Authority / IRS'
            },
            {
                'id': 'WORK_PERMIT',
                'name': 'Work Permit / Residency Visa',
                'category': 'identity',
                'category_label': 'Government & Identity Proofs',
                'icon': '🛂',
                'badge_color': 'purple',
                'reputation_delta': 60,
                'description': 'Lawful foreign employment authorization or residency stamp verification.',
                'placeholder_doc': 'e.g. VISA-EAD-394821',
                'issuer_default': 'Immigration & Naturalization Service'
            },
            {
                'id': 'PROOF_OF_ADDRESS',
                'name': 'Proof of Residence / Address',
                'category': 'identity',
                'category_label': 'Government & Identity Proofs',
                'icon': '🏠',
                'badge_color': 'cyan',
                'reputation_delta': 40,
                'description': 'Verified utility bill or residential lease proof with zero-knowledge geographic hashing.',
                'placeholder_doc': 'e.g. RES-SANFRAN-94107',
                'issuer_default': 'Municipal Utility Oracle'
            },
            {
                'id': 'BIOMETRIC_ID',
                'name': 'Biometric FaceMatch Liveness',
                'category': 'identity',
                'category_label': 'Government & Identity Proofs',
                'icon': '🧬',
                'badge_color': 'purple',
                'reputation_delta': 70,
                'description': 'Zero-knowledge 3D face mesh liveness and biometric Sybil resistance verification.',
                'placeholder_doc': 'e.g. BIO-ZK-9F8A21B4',
                'issuer_default': 'ProofID Biometric Oracle'
            },
            {
                'id': 'HUMAN_VERIFIED',
                'name': 'Human Verified (Passkey WebAuthn)',
                'category': 'identity',
                'category_label': 'Government & Identity Proofs',
                'icon': '🧑',
                'badge_color': 'emerald',
                'reputation_delta': 75,
                'description': 'Hardware FIDO2 / WebAuthn secure enclave passkey attestation proving distinct human identity.',
                'placeholder_doc': 'e.g. FIDO2-SE-A3B91C',
                'issuer_default': 'WebAuthn Passkey Protocol'
            },
            # Professional & Academic
            {
                'id': 'EMPLOYMENT_VERIFIED',
                'name': 'Employment & Company ID',
                'category': 'professional',
                'category_label': 'Professional & Academic',
                'icon': '💼',
                'badge_color': 'blue',
                'reputation_delta': 50,
                'description': 'Verified corporate email domain, payroll record, or organizational affiliation.',
                'placeholder_doc': 'e.g. EMP-GOOGLE-84910',
                'issuer_default': 'Corporate HR Oracle'
            },
            {
                'id': 'UNIVERSITY_DEGREE',
                'name': 'University Degree / Diploma',
                'category': 'professional',
                'category_label': 'Professional & Academic',
                'icon': '🎓',
                'badge_color': 'purple',
                'reputation_delta': 60,
                'description': 'Verified Bachelor, Master, or Doctoral diploma from accredited academic institution.',
                'placeholder_doc': 'e.g. DEG-MIT-CS-2024',
                'issuer_default': 'Academic Registrar Clearinghouse'
            },
            {
                'id': 'FINANCIAL_KYC',
                'name': 'Financial KYC / Accredited Investor',
                'category': 'professional',
                'category_label': 'Professional & Academic',
                'icon': '💰',
                'badge_color': 'amber',
                'reputation_delta': 65,
                'description': 'Tier-3 AML/KYC accreditation for compliant Web3 and DeFi protocol participation.',
                'placeholder_doc': 'e.g. KYC-TIER3-VERIFIED',
                'issuer_default': 'Compliant FinCEN / SEC Oracle'
            },
            {
                'id': 'LEGAL_LICENSE',
                'name': 'Legal / Bar License',
                'category': 'professional',
                'category_label': 'Professional & Academic',
                'icon': '🏛️',
                'badge_color': 'amber',
                'reputation_delta': 60,
                'description': 'State bar association or legal notary practitioner license attestation.',
                'placeholder_doc': 'e.g. BAR-NY-849201',
                'issuer_default': 'State Bar Association'
            },
            {
                'id': 'MEDICAL_LICENSE',
                'name': 'Medical Practitioner License',
                'category': 'professional',
                'category_label': 'Professional & Academic',
                'icon': '🩺',
                'badge_color': 'emerald',
                'reputation_delta': 60,
                'description': 'Board-certified medical physician or clinical healthcare practitioner license.',
                'placeholder_doc': 'e.g. MED-BOARD-49201',
                'issuer_default': 'Medical Licensure Board'
            },
            # Developer & Web3 Badges
            {
                'id': 'DEVELOPER',
                'name': 'Developer (GitHub Oracle)',
                'category': 'developer',
                'category_label': 'Developer & Web3',
                'icon': '💻',
                'badge_color': 'purple',
                'reputation_delta': 40,
                'description': 'Verified software engineer profile with validated repository contributions.',
                'placeholder_doc': 'e.g. https://github.com/developer',
                'issuer_default': 'GitHub Developer Oracle'
            },
            {
                'id': 'AI_RESEARCHER',
                'name': 'AI Researcher (ArXiv / Benchmark)',
                'category': 'developer',
                'category_label': 'Developer & Web3',
                'icon': '🤖',
                'badge_color': 'cyan',
                'reputation_delta': 50,
                'description': 'Peer-reviewed research author or open benchmark contributor (ArXiv, NeurIPS, HuggingFace).',
                'placeholder_doc': 'e.g. https://arxiv.org/abs/2405.xxxxx',
                'issuer_default': 'Open Research Foundation'
            },
            {
                'id': 'WEB3_BUILDER',
                'name': 'Web3 & Monad Builder',
                'category': 'developer',
                'category_label': 'Developer & Web3',
                'icon': '⛓️',
                'badge_color': 'blue',
                'reputation_delta': 45,
                'description': 'Verified smart contract creator and high-throughput parallel EVM ecosystem builder.',
                'placeholder_doc': 'e.g. 0x3A5B8c72D96aB10E463138b1E22964e5C48E1D94',
                'issuer_default': 'Monad Ecosystem Guild'
            },
            {
                'id': 'HACKATHON_BUILDER',
                'name': 'Hackathon Builder / Winner',
                'category': 'developer',
                'category_label': 'Developer & Web3',
                'icon': '🏆',
                'badge_color': 'amber',
                'reputation_delta': 45,
                'description': 'Official prize winner or finalist in global Web3 and AI hackathons.',
                'placeholder_doc': 'e.g. Monad Metropolis Hackathon 2026',
                'issuer_default': 'Hackathon Consortium Oracle'
            },
            {
                'id': 'SECURITY_RESEARCHER',
                'name': 'Security Auditor / Bug Bounty',
                'category': 'developer',
                'category_label': 'Developer & Web3',
                'icon': '🛡️',
                'badge_color': 'red',
                'reputation_delta': 55,
                'description': 'Smart contract security auditor with verified Immunefi/Code4rena vulnerability reports.',
                'placeholder_doc': 'e.g. IMMUNEFI-SEC-REPORT-94',
                'issuer_default': 'Security Audit Guild'
            },
            {
                'id': 'OPEN_SOURCE',
                'name': 'Open Source Maintainer',
                'category': 'developer',
                'category_label': 'Developer & Web3',
                'icon': '🔓',
                'badge_color': 'emerald',
                'reputation_delta': 35,
                'description': 'Public OSS package maintainer with active dependent packages.',
                'placeholder_doc': 'e.g. npm / pypi maintainer URL',
                'issuer_default': 'Open Source Initiative Oracle'
            },
            {
                'id': 'STUDENT',
                'name': 'Student / Academic Fellow',
                'category': 'professional',
                'category_label': 'Professional & Academic',
                'icon': '🎓',
                'badge_color': 'cyan',
                'reputation_delta': 30,
                'description': 'Enrolled student or academic researcher with verified university email.',
                'placeholder_doc': 'e.g. student@stanford.edu',
                'issuer_default': 'University Registrar'
            },
        ]
        return Response({'types': types_data, 'total': len(types_data)})


# ─────────────────────────────────────────────────────────────
#  AI Agent Views
# ─────────────────────────────────────────────────────────────

class AIAgentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return AIAgentSerializer

    def get_queryset(self):
        return AIAgent.objects.filter(owner__user=self.request.user)

    def create(self, request, *args, **kwargs):
        try:
            identity = request.user.identity
        except Identity.DoesNotExist:
            return Response({'error': 'Create your ProofID first'}, status=400)

        name = request.data.get('name', '').strip()
        description = request.data.get('description', '').strip()
        if not name or not description:
            return Response({'error': 'name and description are required'}, status=400)

        # Generate agent ID
        agent_uid = uuid.uuid4().hex[:8].upper()
        agent_id = f"AGT-{agent_uid}"

        agent = AIAgent.objects.create(
            agent_id=agent_id,
            owner=identity,
            name=name,
            description=description,
            capabilities=request.data.get('capabilities', []),
            model_name=request.data.get('model_name', ''),
            version=request.data.get('version', '1.0.0'),
            endpoint_url=request.data.get('endpoint_url', ''),
        )

        # Compute agent hash
        agent.agent_id_hash = keccak256_hash(agent_id)

        # Register on blockchain
        blockchain = get_blockchain_service()
        bc_result = blockchain.register_agent(agent, identity)
        agent.blockchain_tx_hash = bc_result['tx_hash']
        agent.blockchain_registered = True
        agent.save()

        # Reputation event for owner
        ReputationEvent.objects.create(
            identity=identity,
            event_type='ai_task_completed',
            score_delta=20,
            description=f'AI Agent registered: {agent.name} ({agent_id})',
            triggered_by='system',
            metadata={'agent_id': agent_id}
        )

        # Initial agent activity
        AgentActivity.objects.create(
            agent=agent,
            activity_type='verification_check',
            description='Agent registered and initialized in ProofID system',
            score_impact=10,
            success=True,
        )

        log_audit(request.user, 'register_agent', 'agent', agent_id, request)
        return Response(AIAgentSerializer(agent).data, status=201)

    @action(detail=True, methods=['post'])
    def log_activity(self, request, pk=None):
        """Log an activity for an agent"""
        agent = self.get_object()
        activity_type = request.data.get('activity_type', 'api_call')
        success = request.data.get('success', True)
        description = request.data.get('description', 'Activity recorded')

        score_impact = 5 if success else -10

        activity = AgentActivity.objects.create(
            agent=agent,
            activity_type=activity_type,
            description=description,
            output_summary=request.data.get('output_summary', ''),
            score_impact=score_impact,
            success=success,
            duration_ms=request.data.get('duration_ms'),
            error_message=request.data.get('error_message', ''),
        )

        # Update agent stats
        agent.total_tasks += 1
        if success:
            agent.successful_tasks += 1
        else:
            agent.failed_tasks += 1
        agent.save()

        # Reputation impact on owner
        event_type = 'ai_task_completed' if success else 'ai_task_failed'
        delta = 5 if success else -5
        ReputationEvent.objects.create(
            identity=agent.owner,
            event_type=event_type,
            score_delta=delta,
            description=f'Agent {agent.agent_id}: {description[:80]}',
            triggered_by=agent.agent_id,
        )

        return Response(AgentActivitySerializer(activity).data, status=201)

    @action(detail=True, methods=['post'])
    def verify_agent(self, request, pk=None):
        """Simulate agent verification"""
        agent = self.get_object()
        agent.is_verified = True
        agent.verified_at = timezone.now()
        agent.save()
        return Response({'message': f'Agent {agent.agent_id} verified', 'agent': AIAgentSerializer(agent).data})


# ─────────────────────────────────────────────────────────────
#  Trust Analyzer Views
# ─────────────────────────────────────────────────────────────

class TrustAnalyzerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        subject_type = request.data.get('subject_type', 'identity')
        subject_id = request.data.get('subject_id', '').strip()

        if not subject_id:
            return Response({'error': 'subject_id is required'}, status=400)

        identity = None
        agent = None

        if subject_type == 'identity':
            try:
                if subject_id.startswith('PID-'):
                    identity = Identity.objects.get(proof_id=subject_id)
                else:
                    identity = request.user.identity
                    subject_id = identity.proof_id
            except Identity.DoesNotExist:
                return Response({'error': f'Identity {subject_id} not found'}, status=404)

        elif subject_type == 'agent':
            try:
                agent = AIAgent.objects.get(agent_id=subject_id)
            except AIAgent.DoesNotExist:
                return Response({'error': f'Agent {subject_id} not found'}, status=404)
        else:
            return Response({'error': 'subject_type must be identity or agent'}, status=400)

        try:
            report = generate_trust_report(
                subject_type=subject_type,
                subject_id=subject_id,
                identity=identity,
                agent=agent,
                requested_by=request.user,
            )

            # Add reputation event for generating trust report
            if identity and identity.user == request.user:
                ReputationEvent.objects.create(
                    identity=identity,
                    event_type='trust_report_generated',
                    score_delta=5,
                    description='AI Trust Report generated for identity',
                    triggered_by='system',
                )

            return Response(TrustReportSerializer(report).data)

        except Exception as e:
            logger.error(f"Trust report generation failed: {e}")
            return Response({'error': 'Trust analysis failed. Please try again.'}, status=500)


# ─────────────────────────────────────────────────────────────
#  Public Verify View
# ─────────────────────────────────────────────────────────────

class PublicVerifyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.GET.get('q', '').strip()
        if not query:
            return Response({'error': 'Query parameter q is required'}, status=400)

        # Record verification request
        vr = VerificationRequest.objects.create(
            query=query,
            requester_ip=request.META.get('REMOTE_ADDR'),
        )

        result = {'found': False, 'query': query, 'identity': None, 'agent': None, 'blockchain_proof': None, 'trust_summary': {}}

        # Try identity lookup
        if query.startswith('PID-'):
            try:
                identity = Identity.objects.get(proof_id=query, is_public=True)
                blockchain_proof = BlockchainProof.objects.filter(proof_id=query).first()
                result.update({
                    'found': True,
                    'query_type': 'proof_id',
                    'identity': IdentityPublicSerializer(identity).data,
                    'blockchain_proof': BlockchainProofSerializer(blockchain_proof).data if blockchain_proof else None,
                    'trust_summary': {
                        'reputation_score': identity.reputation_score,
                        'verification_status': identity.verification_status,
                        'credential_count': identity.credential_count,
                        'blockchain_registered': identity.blockchain_registered,
                        'is_simulated': blockchain_proof.is_simulated if blockchain_proof else True,
                    }
                })
                vr.status = 'completed'
                vr.result_summary = result['trust_summary']
                vr.save()
                return Response(result)
            except Identity.DoesNotExist:
                pass

        # Try agent lookup
        if query.startswith('AGT-'):
            try:
                agent = AIAgent.objects.get(agent_id=query)
                blockchain_proof = BlockchainProof.objects.filter(agent_id=query).first()
                result.update({
                    'found': True,
                    'query_type': 'agent_id',
                    'agent': AIAgentPublicSerializer(agent).data,
                    'blockchain_proof': BlockchainProofSerializer(blockchain_proof).data if blockchain_proof else None,
                    'trust_summary': {
                        'reputation_score': agent.reputation_score,
                        'is_verified': agent.is_verified,
                        'success_rate': agent.success_rate,
                        'total_tasks': agent.total_tasks,
                        'blockchain_registered': agent.blockchain_registered,
                    }
                })
                vr.status = 'completed'
                vr.save()
                return Response(result)
            except AIAgent.DoesNotExist:
                pass

        # Try wallet address
        if query.startswith('0x') and len(query) == 42:
            try:
                identity = Identity.objects.get(wallet_address__iexact=query, is_public=True)
                result.update({
                    'found': True,
                    'query_type': 'wallet',
                    'identity': IdentityPublicSerializer(identity).data,
                    'trust_summary': {
                        'reputation_score': identity.reputation_score,
                        'verification_status': identity.verification_status,
                    }
                })
                vr.status = 'completed'
                vr.save()
                return Response(result)
            except Identity.DoesNotExist:
                pass

        vr.status = 'not_found'
        vr.save()
        return Response({'found': False, 'query': query, 'message': 'No identity or agent found with this identifier.'})


# ─────────────────────────────────────────────────────────────
#  Dashboard & Stats Views
# ─────────────────────────────────────────────────────────────

class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            identity = request.user.identity
        except Identity.DoesNotExist:
            return Response({'has_identity': False, 'message': 'Create your ProofID to get started.'})

        recent_events = ReputationEvent.objects.filter(identity=identity).order_by('-created_at')[:10]
        agents = AIAgent.objects.filter(owner=identity)
        recent_reports = TrustReport.objects.filter(subject_id=identity.proof_id).order_by('-generated_at')[:3]

        return Response({
            'has_identity': True,
            'identity': IdentitySerializer(identity).data,
            'stats': {
                'reputation_score': identity.reputation_score,
                'credential_count': identity.credential_count,
                'agent_count': agents.count(),
                'verification_status': identity.verification_status,
                'blockchain_registered': identity.blockchain_registered,
                'wallet_connected': bool(identity.wallet_address),
            },
            'recent_events': ReputationEventSerializer(recent_events, many=True).data,
            'agents': AIAgentSerializer(agents, many=True).data,
            'recent_reports': TrustReportSerializer(recent_reports, many=True).data,
        })


class ActivityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            identity = request.user.identity
        except Identity.DoesNotExist:
            return Response({'events': []})

        events = ReputationEvent.objects.filter(identity=identity).order_by('-created_at')[:50]
        return Response({'events': ReputationEventSerializer(events, many=True).data})


class ReputationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            identity = request.user.identity
        except Identity.DoesNotExist:
            return Response({'error': 'No identity found'}, status=404)

        events = ReputationEvent.objects.filter(identity=identity).order_by('-created_at')
        score = identity.reputation_score

        # Score breakdown by category
        breakdown = {}
        for event in events:
            cat = event.event_type
            breakdown[cat] = breakdown.get(cat, 0) + event.score_delta

        return Response({
            'score': score,
            'score_max': 1000,
            'score_percentage': min(100, round(score / 10, 1)),
            'breakdown': breakdown,
            'events': ReputationEventSerializer(events[:20], many=True).data,
            'event_count': events.count(),
        })


class BlockchainStatusView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        blockchain = get_blockchain_service()
        return Response(blockchain.get_status())


class PublicIdentityView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, proof_id):
        try:
            identity = Identity.objects.get(proof_id=proof_id, is_public=True)
            blockchain_proof = BlockchainProof.objects.filter(
                proof_id=proof_id, proof_type='identity_registration'
            ).first()
            return Response({
                'identity': IdentityPublicSerializer(identity).data,
                'blockchain_proof': BlockchainProofSerializer(blockchain_proof).data if blockchain_proof else None,
            })
        except Identity.DoesNotExist:
            return Response({'error': 'Identity not found or is private'}, status=404)


class PublicAgentView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, agent_id):
        try:
            agent = AIAgent.objects.get(agent_id=agent_id)
            blockchain_proof = BlockchainProof.objects.filter(
                agent_id=agent_id, proof_type='agent_registration'
            ).first()
            recent_activities = agent.activity_logs.order_by('-created_at')[:10]
            return Response({
                'agent': AIAgentPublicSerializer(agent).data,
                'recent_activities': AgentActivitySerializer(recent_activities, many=True).data,
                'blockchain_proof': BlockchainProofSerializer(blockchain_proof).data if blockchain_proof else None,
            })
        except AIAgent.DoesNotExist:
            return Response({'error': 'Agent not found'}, status=404)


class TrustReportHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            identity = request.user.identity
        except Identity.DoesNotExist:
            return Response({'reports': []})

        reports = TrustReport.objects.filter(subject_id=identity.proof_id).order_by('-generated_at')[:10]
        return Response({'reports': TrustReportSerializer(reports, many=True).data})


class SettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'user': UserSerializer(request.user).data,
            'demo_mode': settings.DEMO_MODE,
            'blockchain': get_blockchain_service().get_status(),
        })

    def patch(self, request):
        user = request.user
        if 'email' in request.data:
            if User.objects.filter(email=request.data['email']).exclude(pk=user.pk).exists():
                return Response({'error': 'Email already in use'}, status=400)
            user.email = request.data['email']
        if 'first_name' in request.data:
            user.first_name = request.data['first_name']
        if 'last_name' in request.data:
            user.last_name = request.data['last_name']
        if 'password' in request.data and 'current_password' in request.data:
            if not user.check_password(request.data['current_password']):
                return Response({'error': 'Current password incorrect'}, status=400)
            user.set_password(request.data['password'])
        user.save()
        return Response({'message': 'Settings updated', 'user': UserSerializer(user).data})
