"""ProofID API URL Routes"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

router = DefaultRouter()
router.register(r'credentials', views.CredentialViewSet, basename='credential')
router.register(r'agents', views.AIAgentViewSet, basename='agent')

urlpatterns = [
    # Auth
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/google/', views.GoogleAuthView.as_view(), name='auth_google'),
    path('auth/github/', views.GitHubAuthView.as_view(), name='auth_github'),
    path('auth/web3/', views.Web3AuthView.as_view(), name='auth_web3'),
    path('auth/demo-profile/', views.DemoProfileLoginView.as_view(), name='auth_demo_profile'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', views.CurrentUserView.as_view(), name='current_user'),

    # Credentials Types
    path('credentials/types/', views.CredentialTypesView.as_view(), name='credential_types'),

    # Identity
    path('identity/', views.IdentityView.as_view(), name='identity'),
    path('identity/verify/', views.VerifyIdentityView.as_view(), name='verify_identity'),
    path('identity/connect-wallet/', views.ConnectWalletView.as_view(), name='connect_wallet'),

    # Dashboard
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
    path('activity/', views.ActivityView.as_view(), name='activity'),
    path('reputation/', views.ReputationView.as_view(), name='reputation'),
    path('trust-reports/', views.TrustReportHistoryView.as_view(), name='trust_reports'),

    # Trust Analyzer
    path('analyze/', views.TrustAnalyzerView.as_view(), name='analyze'),

    # Public endpoints (no auth required)
    path('verify/', views.PublicVerifyView.as_view(), name='public_verify'),
    path('public/identity/<str:proof_id>/', views.PublicIdentityView.as_view(), name='public_identity'),
    path('public/agent/<str:agent_id>/', views.PublicAgentView.as_view(), name='public_agent'),
    path('blockchain/status/', views.BlockchainStatusView.as_view(), name='blockchain_status'),

    # Settings
    path('settings/', views.SettingsView.as_view(), name='settings'),

    # Router (credentials, agents)
    path('', include(router.urls)),
]
