"""
ProofID AI Trust Analyzer
Uses Anthropic Claude to generate verifiable trust reports.
Clearly states that AI analysis is based on verifiable signals — never claims LLM proves trust.
"""
import logging
from django.conf import settings
from .models import Identity, AIAgent, TrustReport

logger = logging.getLogger('api')


TRUST_ANALYZER_SYSTEM_PROMPT = """You are the ProofID Trust Analyzer, an AI assistant that generates structured trust analysis reports.

IMPORTANT DISCLAIMERS YOU MUST FOLLOW:
1. Your analysis is based ONLY on verifiable signals (credentials, reputation history, blockchain registration, activity patterns).
2. You MUST never claim that an LLM or AI system itself proves or guarantees trustworthiness.
3. You MUST clearly state that this is an AI-assisted analysis of verifiable signals, not a guarantee.
4. Be honest about limitations and uncertainty.
5. Never fabricate data or infer information not provided in the signals.

OUTPUT FORMAT (JSON):
{
  "trust_score": <integer 0-100>,
  "confidence": "<LOW|MEDIUM|HIGH>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "risks": ["<risk 1>", "<risk 2>", ...],
  "recommendation": "<1-2 sentence recommendation>",
  "full_analysis": "<3-5 paragraph detailed analysis>",
  "disclaimer": "<must include standard AI disclaimer>"
}

SCORING GUIDE:
- 0-30: Very low trust, significant concerns
- 31-50: Low trust, limited verifiable signals
- 51-70: Moderate trust, some verified signals
- 71-85: Good trust, solid verified credentials and history
- 86-100: Excellent trust, strong verified identity with rich history
"""


def build_identity_signals(identity: Identity) -> dict:
    """Build signal dictionary from identity data for AI analysis"""
    credentials = identity.credentials.filter(is_revoked=False)
    events = identity.reputation_events.all()[:20]

    return {
        'subject_type': 'human_identity',
        'proof_id': identity.proof_id,
        'verification_status': identity.verification_status,
        'is_verified': identity.verification_status == 'verified',
        'days_since_creation': (
            __import__('django.utils.timezone', fromlist=['now']).now() - identity.created_at
        ).days,
        'wallet_connected': bool(identity.wallet_address),
        'blockchain_registered': identity.blockchain_registered,
        'reputation_score': identity.reputation_score,
        'total_credentials': credentials.count(),
        'credential_types': list(credentials.values_list('credential_type', flat=True)),
        'total_reputation_events': events.count(),
        'recent_events': [
            {
                'type': e.event_type,
                'delta': e.score_delta,
                'description': e.description
            }
            for e in events[:5]
        ],
        'ai_agents_count': identity.ai_agents.count(),
        'public_profile': identity.is_public,
    }


def build_agent_signals(agent: AIAgent) -> dict:
    """Build signal dictionary from agent data"""
    recent_activities = agent.activity_logs.order_by('-created_at')[:10]

    return {
        'subject_type': 'ai_agent',
        'agent_id': agent.agent_id,
        'is_verified': agent.is_verified,
        'status': agent.status,
        'days_since_creation': (
            __import__('django.utils.timezone', fromlist=['now']).now() - agent.created_at
        ).days,
        'owner_verified': agent.owner.verification_status == 'verified',
        'blockchain_registered': agent.blockchain_registered,
        'reputation_score': agent.reputation_score,
        'total_tasks': agent.total_tasks,
        'successful_tasks': agent.successful_tasks,
        'failed_tasks': agent.failed_tasks,
        'success_rate': agent.success_rate,
        'capabilities': agent.capabilities,
        'model_name': agent.model_name,
        'recent_activities': [
            {
                'type': a.activity_type,
                'success': a.success,
                'score_impact': a.score_impact,
            }
            for a in recent_activities
        ],
    }


def _build_user_prompt(signals: dict) -> str:
    """Build the user prompt with signals data"""
    subject_type = signals.get('subject_type', 'unknown')
    import json
    signals_json = json.dumps(signals, indent=2)

    return f"""Analyze the following verifiable signals for this {subject_type} and generate a trust report.

VERIFIABLE SIGNALS:
{signals_json}

Generate a comprehensive trust report following the JSON format specified. Remember:
- Base your analysis ONLY on the signals provided above
- Be honest about what you can and cannot determine
- Include a clear disclaimer that this is AI-assisted analysis of verifiable signals
- Score fairly based on the evidence available
"""


def generate_trust_report(
    subject_type: str,
    subject_id: str,
    identity: Identity = None,
    agent: AIAgent = None,
    requested_by=None
) -> TrustReport:
    """
    Generate an AI-powered trust report using Anthropic Claude.
    Falls back to a rule-based analysis in Demo Mode.
    """
    import json as json_module

    # Build signals
    if subject_type == 'identity' and identity:
        signals = build_identity_signals(identity)
    elif subject_type == 'agent' and agent:
        signals = build_agent_signals(agent)
    else:
        raise ValueError("Must provide identity or agent for trust analysis")

    api_key = settings.ANTHROPIC_API_KEY
    is_simulated = False

    if api_key and not settings.DEMO_MODE:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1500,
                system=TRUST_ANALYZER_SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": _build_user_prompt(signals)}
                ]
            )
            content = response.content[0].text
            # Extract JSON
            start = content.find('{')
            end = content.rfind('}') + 1
            report_data = json_module.loads(content[start:end])
            ai_model = "claude-3-5-sonnet-20241022"

        except Exception as e:
            logger.error(f"Anthropic API call failed: {e}. Falling back to rule-based analysis.")
            report_data = _rule_based_analysis(signals)
            ai_model = "rule-based-fallback"
            is_simulated = True
    else:
        # Demo mode: rule-based analysis
        report_data = _rule_based_analysis(signals)
        ai_model = "demo-mode-rule-based"
        is_simulated = True

    # Ensure disclaimer is present
    if 'disclaimer' not in report_data:
        report_data['disclaimer'] = (
            "⚠️ This report is generated by AI analyzing verifiable signals only. "
            "It does not constitute a guarantee of trustworthiness. "
            "An AI system cannot prove or certify trust — only verifiable, real-world "
            "actions and credentials can build genuine trust."
        )

    trust_report = TrustReport.objects.create(
        subject_type=subject_type,
        subject_id=subject_id,
        trust_score=report_data.get('trust_score', 50),
        strengths=report_data.get('strengths', []),
        risks=report_data.get('risks', []),
        confidence=report_data.get('confidence', 'LOW'),
        recommendation=report_data.get('recommendation', ''),
        full_analysis=report_data.get('full_analysis', '') + '\n\n' + report_data.get('disclaimer', ''),
        signals_used=signals,
        ai_model=ai_model,
        is_simulated=is_simulated,
        requested_by=requested_by,
    )

    return trust_report


def _rule_based_analysis(signals: dict) -> dict:
    """
    Deterministic rule-based trust analysis for Demo Mode.
    Based entirely on real signal values — not random.
    """
    subject_type = signals.get('subject_type')
    score = 0
    strengths = []
    risks = []

    if subject_type == 'human_identity':
        # Base factors
        if signals.get('is_verified'):
            score += 25
            strengths.append("Identity is officially verified")
        else:
            risks.append("Identity not yet verified — verification strengthens trust significantly")

        if signals.get('blockchain_registered'):
            score += 15
            strengths.append("Identity anchored to Monad blockchain with cryptographic proof")
        else:
            risks.append("Identity not yet registered on blockchain")

        if signals.get('wallet_connected'):
            score += 10
            strengths.append("Monad-compatible wallet connected")

        cred_count = signals.get('total_credentials', 0)
        if cred_count >= 3:
            score += 20
            strengths.append(f"Strong credential portfolio with {cred_count} verifiable credentials")
        elif cred_count >= 1:
            score += 10
            strengths.append(f"{cred_count} verifiable credential(s) on record")
        else:
            risks.append("No verifiable credentials issued yet")

        cred_types = signals.get('credential_types', [])
        if 'HUMAN_VERIFIED' in cred_types:
            score += 10
            strengths.append("Human verification credential confirmed")

        rep_score = signals.get('reputation_score', 100)
        if rep_score >= 300:
            score += 15
            strengths.append(f"Excellent reputation score of {rep_score}/1000")
        elif rep_score >= 150:
            score += 8
            strengths.append(f"Good reputation score of {rep_score}/1000")
        elif rep_score < 80:
            risks.append(f"Below-average reputation score of {rep_score}/1000")

        days = signals.get('days_since_creation', 0)
        if days >= 30:
            score += 5
            strengths.append(f"Established identity ({days} days active)")
        elif days < 1:
            risks.append("Very newly created identity — limited history")

    elif subject_type == 'ai_agent':
        if signals.get('is_verified'):
            score += 20
            strengths.append("Agent is officially verified by ProofID")
        else:
            risks.append("Agent not yet verified")

        if signals.get('owner_verified'):
            score += 15
            strengths.append("Owner identity is verified — increases agent credibility")

        if signals.get('blockchain_registered'):
            score += 10
            strengths.append("Agent registered on Monad blockchain")

        success_rate = signals.get('success_rate', 0)
        total = signals.get('total_tasks', 0)

        if total >= 10 and success_rate >= 90:
            score += 25
            strengths.append(f"Excellent task success rate: {success_rate}% over {total} tasks")
        elif total >= 5 and success_rate >= 70:
            score += 15
            strengths.append(f"Good success rate: {success_rate}% over {total} tasks")
        elif total == 0:
            risks.append("No task history available yet")
        elif success_rate < 50:
            risks.append(f"Low task success rate: {success_rate}%")

        caps = signals.get('capabilities', [])
        if len(caps) >= 3:
            score += 5
            strengths.append(f"Well-defined capability set: {', '.join(caps[:3])}")

        rep = signals.get('reputation_score', 100)
        if rep >= 200:
            score += 10
            strengths.append(f"Strong agent reputation score: {rep}/1000")

    # Cap score
    final_score = min(100, max(5, score))

    # Confidence based on available data
    event_count = signals.get('total_reputation_events', 0) or signals.get('total_tasks', 0)
    if event_count >= 10:
        confidence = 'HIGH'
    elif event_count >= 3:
        confidence = 'MEDIUM'
    else:
        confidence = 'LOW'

    if final_score >= 70:
        recommendation = (
            "This entity shows strong verifiable signals and can be considered trustworthy "
            "for most standard interactions. Continue building credential and activity history."
        )
    elif final_score >= 50:
        recommendation = (
            "Moderate trust signals detected. Consider verifying identity and adding credentials "
            "before engaging in high-stakes interactions."
        )
    else:
        recommendation = (
            "Limited verifiable signals available. Exercise caution and request additional "
            "verification before engaging in trust-sensitive operations."
        )

    analysis_paragraphs = [
        f"This trust analysis evaluates a {signals.get('subject_type', 'entity').replace('_', ' ')} "
        f"using {len(strengths) + len(risks)} verifiable signals extracted from the ProofID system.",

        f"Strengths identified: {', '.join(strengths[:3]) if strengths else 'None at this time'}.",

        f"Risk factors: {', '.join(risks[:3]) if risks else 'No significant risks identified'}.",

        f"Reputation score of {signals.get('reputation_score', 100)}/1000 reflects cumulative real activity. "
        f"Confidence in this analysis is {confidence} based on available signal volume.",

        "⚠️ IMPORTANT: This report is AI-assisted analysis of verifiable on-chain and off-chain signals. "
        "It is not a guarantee of trustworthiness. Only real-world verified actions build genuine trust. "
        "The AI model analyzing this data does not itself vouch for or certify any entity."
    ]

    return {
        'trust_score': final_score,
        'confidence': confidence,
        'strengths': strengths,
        'risks': risks,
        'recommendation': recommendation,
        'full_analysis': '\n\n'.join(analysis_paragraphs),
        'disclaimer': (
            "⚠️ AI Disclaimer: This report was generated by analyzing verifiable signals only. "
            "An LLM/AI system cannot prove or certify trust. Trust is built through real, verifiable "
            "actions and credentials — not AI analysis alone."
        )
    }
