/**
 * ProofID — UI Utilities
 * Toast notifications, modals, formatting, SVGs & Credential Renderers
 */

// ── Toast Notifications ──────────────────────────────────────
class ToastManager {
  constructor() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  show(type, title, message, duration = 4000) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:2px 4px;margin-left:8px;">✕</button>
    `;
    this.container.appendChild(toast);
    if (duration > 0) {
      setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
    return toast;
  }

  success(title, message, duration) { return this.show('success', title, message, duration); }
  error(title, message, duration) { return this.show('error', title, message, duration); }
  info(title, message, duration) { return this.show('info', title, message, duration); }
  warning(title, message, duration) { return this.show('warning', title, message, duration); }
}
window.toast = new ToastManager();

// ── Modal Manager ──────────────────────────────────────────────
class ModalManager {
  show(id, html, onClose) {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = `modal-${id}`;
    overlay.innerHTML = `<div class="modal">${html}</div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { this.close(); onClose?.(); }
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  close() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  }
}
window.modal = new ModalManager();

// ── Loading helpers ──────────────────────────────────────────
function setLoading(btn, loading, text = null) {
  if (!btn) return;
  if (loading) {
    btn._originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${text || 'Loading...'}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn._originalText || text || 'Submit';
  }
}

function showPageLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="loading-overlay"><div class="spinner spinner-lg"></div><div>Loading ProofID State...</div></div>`;
}

// ── Formatters ────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function shortHash(hash) {
  if (!hash) return '—';
  if (hash.startsWith('DEMO_')) return hash.substring(0, 16) + '...';
  if (hash.length <= 16) return hash;
  return hash.substring(0, 10) + '...' + hash.substring(hash.length - 6);
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
}

function getVerificationIcon(status) {
  const icons = { verified: '✅', pending: '⏳', unverified: '○', revoked: '🚫' };
  return icons[status] || '○';
}

function getScoreColor(score) {
  if (score >= 700) return 'var(--emerald-400)';
  if (score >= 400) return 'var(--blue-400)';
  if (score >= 200) return 'var(--amber-400)';
  return 'var(--red-400)';
}

function getTrustScoreColor(score) {
  if (score >= 70) return 'var(--emerald-400)';
  if (score >= 50) return 'var(--blue-400)';
  if (score >= 30) return 'var(--amber-400)';
  return 'var(--red-400)';
}

// ── Credential Type Mapping ──────────────────────────────────
const CREDENTIAL_META = {
  // Government IDs
  DRIVING_LICENSE: { icon: '🪪', label: "Driver's License", category: 'identity', color: 'amber', points: 75 },
  PASSPORT: { icon: '🛂', label: 'Passport Verification', category: 'identity', color: 'blue', points: 85 },
  NATIONAL_ID: { icon: '🪪', label: 'National ID / Aadhaar / SSN', category: 'identity', color: 'emerald', points: 85 },
  VOTER_ID: { icon: '🗳️', label: 'Voter Registration / Voter ID', category: 'identity', color: 'cyan', points: 65 },
  TAX_ID: { icon: '📑', label: 'Tax ID / SSN / PAN', category: 'identity', color: 'amber', points: 70 },
  WORK_PERMIT: { icon: '🛂', label: 'Work Permit / Residency Visa', category: 'identity', color: 'purple', points: 60 },
  PROOF_OF_ADDRESS: { icon: '🏠', label: 'Proof of Residence', category: 'identity', color: 'cyan', points: 40 },
  BIOMETRIC_ID: { icon: '🧬', label: 'Biometric FaceMatch', category: 'identity', color: 'purple', points: 70 },
  HUMAN_VERIFIED: { icon: '🧑', label: 'Human Verified (Passkey)', category: 'identity', color: 'emerald', points: 75 },

  // Professional & Academic
  EMPLOYMENT_VERIFIED: { icon: '💼', label: 'Employment & Company ID', category: 'professional', color: 'blue', points: 50 },
  UNIVERSITY_DEGREE: { icon: '🎓', label: 'University Degree', category: 'professional', color: 'purple', points: 60 },
  FINANCIAL_KYC: { icon: '💰', label: 'Financial KYC / Investor', category: 'professional', color: 'amber', points: 65 },
  LEGAL_LICENSE: { icon: '🏛️', label: 'Legal / Bar License', category: 'professional', color: 'amber', points: 60 },
  MEDICAL_LICENSE: { icon: '🩺', label: 'Medical License', category: 'professional', color: 'emerald', points: 60 },
  STUDENT: { icon: '🎓', label: 'Student / Fellow', category: 'professional', color: 'cyan', points: 30 },

  // Developer & Web3
  DEVELOPER: { icon: '💻', label: 'Developer Verified', category: 'developer', color: 'purple', points: 40 },
  AI_RESEARCHER: { icon: '🤖', label: 'AI Researcher', category: 'developer', color: 'cyan', points: 50 },
  WEB3_BUILDER: { icon: '⛓️', label: 'Web3 & Monad Builder', category: 'developer', color: 'blue', points: 45 },
  HACKATHON_BUILDER: { icon: '🏆', label: 'Hackathon Builder', category: 'developer', color: 'amber', points: 45 },
  SECURITY_RESEARCHER: { icon: '🛡️', label: 'Security Researcher', category: 'developer', color: 'red', points: 55 },
  OPEN_SOURCE: { icon: '🔓', label: 'Open Source Contributor', category: 'developer', color: 'emerald', points: 35 },
};

function getCredentialIcon(type) {
  return CREDENTIAL_META[type]?.icon || '📄';
}

function getCredentialLabel(type) {
  return CREDENTIAL_META[type]?.label || type?.replace(/_/g, ' ');
}

function getCredentialCategory(type) {
  return CREDENTIAL_META[type]?.category || 'identity';
}

function getCredentialPoints(type) {
  return CREDENTIAL_META[type]?.points || 35;
}

function getEventIcon(type) {
  const icons = {
    credential_issued: '📜', credential_revoked: '🚫',
    identity_verified: '✅', ai_task_completed: '🤖',
    ai_task_failed: '⚠️', report_submitted: '📋',
    wallet_connected: '👛', blockchain_registered: '⛓️',
    trust_report_generated: '🔍', activity_completed: '✔️',
    violation: '❌', peer_endorsement: '👍', verification_request: '🛡️'
  };
  return icons[type] || '📌';
}

// ── Reputation Score Ring ─────────────────────────────────────
function renderScoreRing(score, max = 1000, size = 120) {
  const pct = Math.min(100, (score / max) * 100);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = getScoreColor(score);
  return `
    <div class="score-ring" style="width:${size}px;height:${size}px;">
      <svg width="${size}" height="${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}"
          stroke-width="8" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
          style="transition: stroke-dashoffset 1s ease;"/>
      </svg>
      <div class="score-ring-value">
        <div class="score-ring-number" style="color:${color}">${score}</div>
        <div class="score-ring-label">/ ${max}</div>
      </div>
    </div>`;
}

// ── Blockchain Proof Card ─────────────────────────────────────
function renderBlockchainProof(proof) {
  if (!proof) return `<div class="blockchain-proof"><div class="blockchain-proof-row"><span class="blockchain-proof-key">Status</span><span class="blockchain-proof-value text-muted">Not yet anchored to blockchain</span></div></div>`;
  const simBadge = proof.is_simulated ? `<span class="simulated-badge">🔶 Demo Mode — Simulated Monad Proof</span>` : `<span class="badge badge-verified">⛓️ Monad Testnet Validated</span>`;
  const explorerLink = proof.explorer_url ? `<a href="${proof.explorer_url}" target="_blank" rel="noopener">${shortHash(proof.tx_hash)} ↗</a>` : shortHash(proof.tx_hash);
  return `
    <div class="blockchain-proof">
      <div class="blockchain-proof-row">
        <span class="blockchain-proof-key">Network</span>
        <span class="blockchain-proof-value font-mono text-purple">${proof.network_name || 'Monad Testnet'} (Chain ${proof.chain_id || 10143})</span>
      </div>
      <div class="blockchain-proof-row">
        <span class="blockchain-proof-key">Tx Hash</span>
        <span class="blockchain-proof-value font-mono">${explorerLink}</span>
      </div>
      ${proof.block_number ? `<div class="blockchain-proof-row"><span class="blockchain-proof-key">Block</span><span class="blockchain-proof-value font-mono">#${proof.block_number.toLocaleString()}</span></div>` : ''}
      <div class="blockchain-proof-row">
        <span class="blockchain-proof-key">Contract</span>
        <span class="blockchain-proof-value font-mono">${shortHash(proof.contract_address || '0x3A5B8c72D96aB10E463138b1E22964e5C48E1D94')}</span>
      </div>
      <div class="blockchain-proof-row">
        <span class="blockchain-proof-key">Proof Type</span>
        <span class="blockchain-proof-value text-cyan">${proof.proof_type?.replace(/_/g,' ') || 'Credential Issuance'}</span>
      </div>
      <div class="blockchain-proof-row" style="padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;">
        <span class="blockchain-proof-key">Attestation</span>
        <span>${simBadge}</span>
      </div>
    </div>`;
}

// ── Credential Card ───────────────────────────────────────────
function renderCredentialCard(cred) {
  const icon = getCredentialIcon(cred.credential_type);
  const label = getCredentialLabel(cred.credential_type);
  const meta = CREDENTIAL_META[cred.credential_type] || { color: 'purple', points: 40 };
  const pts = meta.points;
  const isRevoked = cred.is_revoked;

  return `
    <div class="card credential-card ${isRevoked ? 'credential-revoked' : ''}" style="padding:18px;display:flex;align-items:center;gap:16px;border-left: 3px solid var(--${meta.color}-500, var(--purple-500));">
      <div class="credential-icon-box" style="font-size:30px;width:52px;height:52px;border-radius:var(--radius-md);background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        ${icon}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="flex items-center gap-8 mb-4" style="flex-wrap:wrap;">
          <span class="font-display font-bold text-sm text-primary">${label}</span>
          ${isRevoked ? '<span class="badge badge-red">Revoked</span>' : '<span class="badge badge-verified">✅ Monad Anchored</span>'}
          <span class="badge badge-${meta.color}" style="font-size:11px;">+${pts} pts</span>
        </div>
        <div class="text-xs text-secondary mb-4">
          Issued by <strong>${cred.issuer_name || 'ProofID Authority'}</strong> · ${formatDate(cred.issued_at)}
        </div>
        ${cred.evidence_url ? `<div class="text-xs text-muted truncate" style="max-width:380px;">Proof: <span class="font-mono text-cyan">${cred.evidence_url}</span></div>` : ''}
        ${cred.notes ? `<div class="text-xs text-muted italic mt-2">${cred.notes}</div>` : ''}
        ${cred.credential_hash ? `
          <div class="flex items-center gap-8 mt-6">
            <span class="text-xs font-mono text-muted" style="opacity:0.75;">SHA3: ${shortHash(cred.credential_hash)}</span>
            <button class="btn btn-ghost btn-sm" onclick="app.copyToClipboard('${cred.credential_hash}', 'Hash copied!')" style="padding:1px 6px;font-size:10px;">📋 Copy</button>
          </div>
        ` : ''}
      </div>
      <div class="flex flex-col gap-6 items-end flex-shrink-0">
        <button class="btn btn-secondary btn-sm" onclick="app.showCredentialDetails('${cred.id}')" style="padding:6px 12px;font-size:12px;">Inspect ➔</button>
        ${!isRevoked ? `<button class="btn btn-ghost btn-sm text-red" onclick="app.revokeCredential('${cred.id}')" title="Revoke" style="padding:4px 8px;font-size:11px;color:var(--red-400);">Revoke</button>` : ''}
      </div>
    </div>`;
}

// ── Agent Card ────────────────────────────────────────────────
function renderAgentCard(agent) {
  const statusColors = { active: 'badge-verified', inactive: 'badge-unverified', suspended: 'badge-red', pending_verification: 'badge-pending' };
  const pct = Math.min(100, agent.success_rate || 0);
  return `
    <div class="agent-card" onclick="app.showAgentDetail('${agent.id}')">
      <div class="flex items-center gap-12 mb-16">
        <div class="agent-icon">🤖</div>
        <div style="flex:1;min-width:0;">
          <div class="agent-name truncate">${agent.name}</div>
          <div class="agent-id">${agent.agent_id}</div>
        </div>
        <div class="flex flex-col items-center gap-4">
          <span class="badge ${statusColors[agent.status] || 'badge-unverified'}">${agent.status?.replace(/_/g,' ')}</span>
          ${agent.is_verified ? '<span class="badge badge-verified" style="font-size:10px">Verified</span>' : ''}
        </div>
      </div>
      <div class="flex justify-between mb-12">
        <div class="agent-stat"><span class="agent-stat-value">${agent.total_tasks}</span><span class="agent-stat-label">Tasks</span></div>
        <div class="agent-stat"><span class="agent-stat-value text-emerald">${agent.success_rate}%</span><span class="agent-stat-label">Success</span></div>
        <div class="agent-stat"><span class="agent-stat-value" style="color:${getScoreColor(agent.reputation_score || 100)}">${agent.reputation_score || 100}</span><span class="agent-stat-label">Rep</span></div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${pct>=70?'var(--gradient-emerald)':'var(--gradient-primary)'}"></div></div>
      <div class="flex justify-between mt-8">
        <span class="text-xs text-muted">${agent.capabilities?.slice(0,2).join(', ') || 'Autonomous subagent'}</span>
        <span class="text-xs text-muted">${timeAgo(agent.created_at)}</span>
      </div>
    </div>`;
}

// ── Reputation Timeline Item ──────────────────────────────────
function renderReputationEvent(ev) {
  const isPos = ev.score_delta >= 0;
  const icon = getEventIcon(ev.event_type);
  const iconClass = isPos ? 'timeline-icon-positive' : 'timeline-icon-negative';
  return `
    <div class="timeline-item">
      <div class="timeline-icon ${iconClass}">${icon}</div>
      <div class="timeline-content">
        <div class="timeline-title">${ev.event_type_display || ev.event_type.replace(/_/g,' ')}</div>
        <div class="timeline-meta">${ev.description} · ${timeAgo(ev.created_at)}</div>
      </div>
      <div class="timeline-delta ${isPos ? 'positive' : 'negative'}">${isPos ? '+' : ''}${ev.score_delta}</div>
    </div>`;
}

// ── Demo Mode Banner ──────────────────────────────────────────
function renderDemoBanner() {
  return `
    <div class="demo-banner" id="demo-banner">
      <span class="demo-banner-icon">⚡</span>
      <div class="demo-banner-text">
        <strong>PROOFID TRUST PROTOCOL ACTIVE</strong> — Verifiable credentials, Google & Web3 logins, and ID proofs are live with instant SHA3-256 Monad anchors.
      </div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;margin-left:auto;">✕</button>
    </div>`;
}

// ── Empty State ───────────────────────────────────────────────
function renderEmpty(icon, title, desc, actionHtml = '') {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <div class="empty-state-title">${title}</div>
      <div class="empty-state-desc">${desc}</div>
      ${actionHtml}
    </div>`;
}

// ── Error State ───────────────────────────────────────────────
function renderError(msg) {
  return `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Something went wrong</div><div class="empty-state-desc">${msg}</div></div>`;
}
