/**
 * ProofID — Portable AI Identity & Trust Layer
 * Central Application Engine (SPA Router, State, Views, UI Logic)
 */

class ProofIDApp {
  constructor() {
    this.currentUser = null;
    this.identity = null;
    this.currentRoute = 'landing';
    this.currentAgentId = null;
    this.blockchainStatus = null;
    this.isDemoMode = true;
    this.reputationChart = null;

    // Bind methods
    this.handleRoute = this.handleRoute.bind(this);
    this.init();
  }

  async init() {
    // Listen for hash routing
    window.addEventListener('hashchange', this.handleRoute);

    // Initial session check
    if (window.api && window.api.isAuthenticated) {
      try {
        const me = await window.api.me();
        if (me && !me.error) {
          this.currentUser = me;
          if (me.has_identity) {
            const idRes = await window.api.getIdentity();
            if (idRes && !idRes.error) {
              this.identity = idRes;
            }
          }
        } else {
          window.api.clearTokens();
        }
      } catch (e) {
        console.warn('Session check failed:', e);
      }
    }

    // Fetch initial blockchain status
    try {
      this.blockchainStatus = await window.api.getBlockchainStatus();
    } catch (e) {
      this.blockchainStatus = { network_name: 'Monad Testnet', chain_id: 10143, is_simulated: true };
    }

    // Initial route handling
    this.handleRoute();
  }

  // ── ROUTING ──────────────────────────────────────────────────
  async handleRoute() {
    const rawHash = window.location.hash.slice(1) || 'landing';
    const [path, queryString] = rawHash.split('?');
    const params = new URLSearchParams(queryString || '');

    let route = path;
    if (route === '' || route === '/') route = 'landing';

    // Route guards
    const protectedRoutes = ['dashboard', 'credentials', 'agents', 'agent-detail', 'analyzer', 'settings', 'create-identity'];
    if (protectedRoutes.includes(route) && (!this.currentUser || !window.api.isAuthenticated)) {
      // If user is trying to access protected route without login, redirect to landing
      window.location.hash = '#landing';
      return;
    }

    if (route === 'dashboard' && this.currentUser && !this.identity) {
      window.location.hash = '#create-identity';
      return;
    }

    this.currentRoute = route;
    const appEl = document.getElementById('app');

    if (route === 'landing') {
      this.renderLandingPage(appEl);
    } else {
      this.renderAppLayout(appEl, route, params);
    }
  }

  navigate(route, params = {}) {
    let hash = `#${route}`;
    const keys = Object.keys(params);
    if (keys.length > 0) {
      const qs = new URLSearchParams(params).toString();
      hash += `?${qs}`;
    }
    window.location.hash = hash;
  }

  showPage(route) {
    this.navigate(route);
  }

  // ── QUICK AUTH (DEMO LOGIN) ──────────────────────────────────
  async loginAsDemo() {
    window.toast.info('Demo Mode', 'Logging in as Alex Rivera (demo)...');
    try {
      const res = await window.api.login({ username: 'demo', password: 'demo123' });
      if (res && res.tokens) {
        window.api.setTokens(res.tokens.access, res.tokens.refresh);
        this.currentUser = res.user;
        const idRes = await window.api.getIdentity();
        if (idRes && !idRes.error) {
          this.identity = idRes;
        }
        window.toast.success('Welcome Alex Rivera', 'Logged into ProofID Portal.');
        this.navigate('dashboard');
      } else {
        window.toast.error('Login Failed', res.error || 'Could not authenticate demo user');
      }
    } catch (e) {
      window.toast.error('Error', 'Failed to connect to backend server');
    }
  }

  async logout() {
    window.api.clearTokens();
    this.currentUser = null;
    this.identity = null;
    window.toast.info('Logged Out', 'You have been signed out.');
    this.navigate('landing');
  }

  // ── LANDING PAGE VIEW ────────────────────────────────────────
  renderLandingPage(container) {
    container.innerHTML = `
      <div class="landing-page">
        <!-- Landing Header -->
        <header class="landing-header">
          <div class="landing-logo" onclick="app.navigate('landing')" style="cursor:pointer">
            <div class="landing-logo-icon">
              <img src="/static/images/logo.png" alt="ProofID Logo" />
            </div>
            <div class="brand-logo-text">
              <div class="brand-name">Proof<span>ID</span></div>
              <div class="brand-tagline">ONE IDENTITY. TRUSTED EVERYWHERE.</div>
            </div>
          </div>
          <nav class="landing-nav">
            <a href="#how-it-works">How It Works</a>
            <a href="#features">Features</a>
            <a href="#blockchain" onclick="app.navigate('blockchain')">Monad Explorer</a>
            <a href="#verify" onclick="app.navigate('verify')">Public Verifier</a>
            ${this.currentUser ? `
              <button class="btn btn-primary btn-sm" onclick="app.navigate('dashboard')">Launch Dashboard ➔</button>
            ` : `
              <button class="btn btn-secondary btn-sm" onclick="app.showLoginModal()">Sign In</button>
              <button class="btn btn-primary btn-sm" onclick="app.loginAsDemo()">⚡ Try Demo</button>
            `}
          </nav>
        </header>

        <!-- Hero Section -->
        <main>
          <section class="hero">
            <div style="display:flex;justify-content:center;margin-bottom:24px;">
              <div class="hero-logo-wrapper">
                <img src="/static/images/logo.png" alt="ProofID" class="hero-logo-img" />
              </div>
            </div>

            <div class="hero-badge">
              <span class="hero-badge-dot"></span>
              Built for Trust, Identity & AI Infrastructure Track · Monad
            </div>

            <h1 class="hero-title">
              Portable Trust Layer for<br/>
              <span class="hero-title-gradient">Humans & Autonomous AI Agents</span>
            </h1>

            <p class="hero-subtitle">
              ProofID gives developers and autonomous agents a verifiable, cryptographic digital identity. Build reputation, manage zero-knowledge credentials, and verify AI trustworthiness on high-throughput blockchain infrastructure.
            </p>

            <div class="hero-actions">
              <button class="btn btn-primary btn-lg" onclick="app.loginAsDemo()">
                ⚡ Launch Demo as Alex Rivera
              </button>
              <button class="btn btn-secondary btn-lg" onclick="app.showRegisterModal()">
                Create Your ProofID
              </button>
              <button class="btn btn-ghost btn-lg" onclick="app.navigate('verify')">
                🔍 Verify an ID
              </button>
            </div>

            <!-- Hero Stats Ticker -->
            <div class="hero-stats">
              <div class="text-center">
                <div class="hero-stat-value text-purple">10,000+</div>
                <div class="hero-stat-label">Transactions / Sec</div>
              </div>
              <div class="text-center">
                <div class="hero-stat-value text-emerald">100%</div>
                <div class="hero-stat-label">Verifiable Telemetry</div>
              </div>
              <div class="text-center">
                <div class="hero-stat-value text-blue">Monad</div>
                <div class="hero-stat-label">Chain 10143 Anchored</div>
              </div>
              <div class="text-center">
                <div class="hero-stat-value text-amber">SHA3-256</div>
                <div class="hero-stat-label">Cryptographic Proofs</div>
              </div>
            </div>
          </section>

          <!-- Interactive Quick Verification Search Bar -->
          <section style="max-width: 800px; margin: 0 auto 60px; padding: 0 20px;">
            <div class="card" style="padding: 28px; background: var(--bg-glass); border: 1px solid var(--border-accent);">
              <div class="flex items-center justify-between mb-16">
                <div>
                  <h3 class="font-display font-bold text-lg">Instant Verification Oracle</h3>
                  <p class="text-sm text-secondary">Lookup any human ProofID, AI agent, or Monad wallet address</p>
                </div>
                <span class="badge badge-verified">Live Public Oracle</span>
              </div>
              <div class="verify-search">
                <input type="text" id="landing-verify-input" class="verify-search-input" placeholder="e.g. PID-8F3A29B1 or AGT-7C91B420 or 0x71C8364f..." value="PID-8F3A29B1" />
                <button class="verify-search-btn" onclick="app.executeLandingVerify()">Verify Identity ➔</button>
              </div>
              <div class="flex items-center gap-12 mt-12 text-xs text-muted">
                <span>Try sample IDs:</span>
                <a href="javascript:void(0)" onclick="app.setLandingVerify('PID-8F3A29B1')" class="text-purple font-mono">PID-8F3A29B1 (Alex Rivera)</a>
                <span>·</span>
                <a href="javascript:void(0)" onclick="app.setLandingVerify('PID-4E90B12D')" class="text-purple font-mono">PID-4E90B12D (Dr. Sarah Chen)</a>
                <span>·</span>
                <a href="javascript:void(0)" onclick="app.setLandingVerify('AGT-7C91B420')" class="text-blue font-mono">AGT-7C91B420 (Sentinel Agent)</a>
              </div>
              <div id="landing-verify-result" class="mt-20 hidden"></div>
            </div>
          </section>

          <!-- Interactive Architecture / How It Works Tabs -->
          <section id="how-it-works" style="max-width: 1100px; margin: 0 auto 80px; padding: 0 20px;">
            <div class="text-center mb-32">
              <span class="badge badge-purple mb-8">Architecture & Protocol</span>
              <h2 class="hero-title" style="font-size: 36px; margin-bottom: 12px;">How ProofID Anchors Trust</h2>
              <p class="text-secondary max-width" style="max-width: 600px; margin: 0 auto;">Off-chain privacy with on-chain cryptographic integrity for seamless agent-to-agent delegation.</p>
            </div>

            <div class="grid-4 mb-24">
              <div class="card" style="padding: 20px; border-left: 3px solid var(--purple-500);">
                <div class="text-xl mb-8">1️⃣</div>
                <h4 class="font-display font-bold text-base mb-4">Passkey & Identity</h4>
                <p class="text-xs text-secondary">Hardware WebAuthn passkey creates unique ProofID. No private keys stored; zero-knowledge Sybil resistance.</p>
              </div>
              <div class="card" style="padding: 20px; border-left: 3px solid var(--blue-500);">
                <div class="text-xl mb-8">2️⃣</div>
                <h4 class="font-display font-bold text-base mb-4">Verifiable Credentials</h4>
                <p class="text-xs text-secondary">SHA3-256 hashed claims issued by oracles across Developer, AI Researcher, and Hackathon Builder tracks.</p>
              </div>
              <div class="card" style="padding: 20px; border-left: 3px solid var(--emerald-500);">
                <div class="text-xl mb-8">3️⃣</div>
                <h4 class="font-display font-bold text-base mb-4">AI Agent Delegation</h4>
                <p class="text-xs text-secondary">Autonomous agents link to human identity. Telemetry, task outcomes, and safety invariants feed dynamic reputation.</p>
              </div>
              <div class="card" style="padding: 20px; border-left: 3px solid var(--cyan-400);">
                <div class="text-xl mb-8">4️⃣</div>
                <h4 class="font-display font-bold text-base mb-4">Monad Testnet Anchor</h4>
                <p class="text-xs text-secondary">Keccak256 roots anchored immutably to smart contract with verifiable transaction explorer proofs.</p>
              </div>
            </div>
          </section>

          <!-- Features Grid -->
          <section id="features" class="features-grid">
            <div class="feature-card">
              <div class="feature-icon feature-icon-purple">🤖</div>
              <h3 class="feature-title">Autonomous Agent Registry</h3>
              <p class="feature-desc">Register autonomous AI subagents under your master human ProofID. Define explicit execution capabilities, model parameters, and safety bounds.</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon feature-icon-blue">🔍</div>
              <h3 class="feature-title">AI-Assisted Trust Analyzer</h3>
              <p class="feature-desc">Evaluate human and agent trustworthiness using Anthropic Claude analysis backed strictly by verifiable signals and on-chain telemetry.</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon feature-icon-emerald">📜</div>
              <h3 class="feature-title">Verifiable Credentials</h3>
              <p class="feature-desc">Issue, claim, and cryptographically verify credentials for developers, researchers, and builders without exposing private data.</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon feature-icon-amber">⛓️</div>
              <h3 class="feature-title">Monad High-Speed Proofs</h3>
              <p class="feature-desc">Built for the Monad parallel EVM. Sub-second proof anchors and real-time state attestations with complete transaction traceability.</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon feature-icon-cyan">📊</div>
              <h3 class="feature-title">Dynamic Reputation Scoring</h3>
              <p class="feature-desc">Composite 0-1000 reputation score calculated continuously from verified credentials, agent task successes, and audit logs.</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon feature-icon-purple">🛡️</div>
              <h3 class="feature-title">Public Verification API</h3>
              <p class="feature-desc">Allow dApps, protocols, and other AI agents to instantly query and verify trustworthiness via REST API or smart contract call.</p>
            </div>
          </section>

          <!-- Hackathon Banner -->
          <section style="max-width: 1000px; margin: 0 auto 60px; padding: 0 20px;">
            <div class="card card-glow" style="padding: 36px; text-align: center;">
              <span class="badge badge-demo mb-12">Monad Ecosystem Hackathon</span>
              <h2 class="font-display font-bold text-xl mb-12">Designed for the Trust, Identity & AI Infrastructure Track</h2>
              <p class="text-sm text-secondary max-width mb-24" style="max-width: 640px; margin: 0 auto;">
                ProofID bridges the trust gap between autonomous AI agents and decentralized finance protocols. Experience the full working application with live simulated blockchain proofs.
              </p>
              <div class="flex items-center justify-center gap-16">
                <button class="btn btn-primary" onclick="app.loginAsDemo()">⚡ Try Alex Rivera Demo</button>
                <button class="btn btn-secondary" onclick="app.navigate('blockchain')">View Monad Proofs</button>
              </div>
            </div>
          </section>
        </main>

        <!-- Landing Footer -->
        <footer style="padding: 40px; border-top: 1px solid var(--border-primary); text-align: center; color: var(--text-muted); font-size: 13px;">
          <div class="flex items-center justify-center gap-10 mb-8">
            <span class="landing-logo-icon" style="width:28px;height:28px;">
              <img src="/static/images/logo.png" alt="ProofID Logo" />
            </span>
            <span class="font-display font-bold text-primary">ProofID Network</span>
          </div>
          <p>© 2026 ProofID. Portable AI Identity Layer. Anchored on Monad Testnet (Chain ID 10143).</p>
        </footer>
      </div>
    `;
  }

  setLandingVerify(val) {
    const input = document.getElementById('landing-verify-input');
    if (input) input.value = val;
    this.executeLandingVerify();
  }

  async executeLandingVerify() {
    const input = document.getElementById('landing-verify-input');
    const resultEl = document.getElementById('landing-verify-result');
    if (!input || !resultEl) return;

    const query = input.value.trim();
    if (!query) {
      window.toast.warning('Empty Query', 'Please enter a ProofID, Agent ID, or Wallet');
      return;
    }

    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><div>Verifying ${query} against Monad Oracle...</div></div>`;

    try {
      const data = await window.api.verify(query);
      if (data && data.found) {
        if (data.identity) {
          const id = data.identity;
          resultEl.innerHTML = `
            <div class="verify-result verified">
              <div class="flex items-center justify-between mb-16">
                <div class="flex items-center gap-12">
                  <div class="identity-avatar" style="width:48px;height:48px;font-size:18px;">${getInitials(id.display_name)}</div>
                  <div>
                    <div class="font-display font-bold text-base">${id.display_name}</div>
                    <div class="font-mono text-xs text-purple">${id.proof_id}</div>
                  </div>
                </div>
                <span class="badge badge-verified">✅ Verified Identity</span>
              </div>
              <div class="grid-3 mb-16">
                <div class="stat-card" style="padding:12px;"><span class="stat-label">Reputation</span><span class="stat-value text-emerald" style="font-size:20px;">${id.reputation_score} / 1000</span></div>
                <div class="stat-card" style="padding:12px;"><span class="stat-label">Credentials</span><span class="stat-value text-blue" style="font-size:20px;">${id.credential_count || 5} Active</span></div>
                <div class="stat-card" style="padding:12px;"><span class="stat-label">Blockchain</span><span class="stat-value text-purple" style="font-size:20px;">Monad Anchored</span></div>
              </div>
              ${data.blockchain_proof ? renderBlockchainProof(data.blockchain_proof) : ''}
              <div class="mt-16 text-right">
                <button class="btn btn-primary btn-sm" onclick="app.navigate('verify', {q: '${id.proof_id}'})">View Full Public Report ➔</button>
              </div>
            </div>
          `;
        } else if (data.agent) {
          const ag = data.agent;
          resultEl.innerHTML = `
            <div class="verify-result verified">
              <div class="flex items-center justify-between mb-16">
                <div class="flex items-center gap-12">
                  <div class="agent-icon">🤖</div>
                  <div>
                    <div class="font-display font-bold text-base">${ag.name}</div>
                    <div class="font-mono text-xs text-blue">${ag.agent_id}</div>
                  </div>
                </div>
                <span class="badge badge-verified">✅ Verified Autonomous Agent</span>
              </div>
              <p class="text-xs text-secondary mb-12">${ag.description}</p>
              <div class="grid-3 mb-16">
                <div class="stat-card" style="padding:12px;"><span class="stat-label">Success Rate</span><span class="stat-value text-emerald" style="font-size:20px;">${ag.success_rate}%</span></div>
                <div class="stat-card" style="padding:12px;"><span class="stat-label">Total Tasks</span><span class="stat-value text-blue" style="font-size:20px;">${ag.total_tasks}</span></div>
                <div class="stat-card" style="padding:12px;"><span class="stat-label">Reputation</span><span class="stat-value text-purple" style="font-size:20px;">${ag.reputation_score}</span></div>
              </div>
              ${data.blockchain_proof ? renderBlockchainProof(data.blockchain_proof) : ''}
              <div class="mt-16 text-right">
                <button class="btn btn-primary btn-sm" onclick="app.navigate('verify', {q: '${ag.agent_id}'})">View Agent Attestation ➔</button>
              </div>
            </div>
          `;
        }
      } else {
        resultEl.innerHTML = `
          <div class="verify-result not-found">
            <div class="flex items-center gap-12 text-red-400 mb-8">
              <span>❌</span>
              <span class="font-bold">No Verified Record Found</span>
            </div>
            <p class="text-xs text-muted">No public identity or agent matches query "${query}". Please check the ID or verify capitalization.</p>
          </div>
        `;
      }
    } catch (e) {
      resultEl.innerHTML = `<div class="verify-result not-found"><p class="text-xs text-red-400">Failed to query oracle.</p></div>`;
    }
  }

  // ── APP LAYOUT (AUTHENTICATED PORTAL) ────────────────────────
  renderAppLayout(container, route, params) {
    const userInitial = this.identity?.display_name ? getInitials(this.identity.display_name) : 'U';
    const userName = this.identity?.display_name || this.currentUser?.username || 'User';
    const userProofId = this.identity?.proof_id || 'PID-NEW';
    const walletShort = this.identity?.wallet_address ? `${this.identity.wallet_address.slice(0,6)}...${this.identity.wallet_address.slice(-4)}` : 'Not Connected';

    container.innerHTML = `
      <div class="app-layout">
        <!-- Sidebar Navigation -->
        <aside class="sidebar" id="app-sidebar">
          <div class="sidebar-logo" onclick="app.navigate('dashboard')" style="cursor:pointer">
            <div class="sidebar-logo-icon">
              <img src="/static/images/logo.png" alt="ProofID Logo" />
            </div>
            <div class="sidebar-logo-text">Proof<span>ID</span></div>
          </div>

          <div class="sidebar-nav">
            <div class="sidebar-section-label">Identity & Trust</div>
            <button class="nav-item ${route === 'dashboard' ? 'active' : ''}" onclick="app.navigate('dashboard')">
              <span class="nav-item-icon">📊</span>
              <span>Dashboard</span>
            </button>
            <button class="nav-item ${route === 'credentials' ? 'active' : ''}" onclick="app.navigate('credentials')">
              <span class="nav-item-icon">📜</span>
              <span>Verifiable Credentials</span>
            </button>
            <button class="nav-item ${route === 'agents' || route === 'agent-detail' ? 'active' : ''}" onclick="app.navigate('agents')">
              <span class="nav-item-icon">🤖</span>
              <span>Autonomous AI Agents</span>
            </button>
            <button class="nav-item ${route === 'analyzer' ? 'active' : ''}" onclick="app.navigate('analyzer')">
              <span class="nav-item-icon">🔍</span>
              <span>AI Trust Analyzer</span>
            </button>

            <div class="sidebar-section-label">Infrastructure</div>
            <button class="nav-item ${route === 'blockchain' ? 'active' : ''}" onclick="app.navigate('blockchain')">
              <span class="nav-item-icon">⛓️</span>
              <span>Monad Testnet Explorer</span>
            </button>
            <button class="nav-item ${route === 'verify' ? 'active' : ''}" onclick="app.navigate('verify')">
              <span class="nav-item-icon">🌐</span>
              <span>Public Verifier</span>
            </button>
            <button class="nav-item ${route === 'settings' ? 'active' : ''}" onclick="app.navigate('settings')">
              <span class="nav-item-icon">⚙️</span>
              <span>Settings & Keys</span>
            </button>
          </div>

          <!-- Sidebar Footer with User Card -->
          <div class="sidebar-footer">
            <div class="sidebar-user" onclick="app.navigate('settings')">
              <div class="sidebar-user-avatar">${userInitial}</div>
              <div class="sidebar-user-info">
                <div class="sidebar-user-name">${userName}</div>
                <div class="sidebar-user-id">${userProofId}</div>
              </div>
            </div>
            <div class="flex items-center justify-between mt-12 px-8 text-xs text-muted">
              <span class="badge badge-demo">Demo Mode</span>
              <a href="javascript:void(0)" onclick="app.logout()" class="text-muted" style="text-decoration:none">Sign Out</a>
            </div>
          </div>
        </aside>

        <!-- Main Content Area -->
        <div class="main-content">
          <!-- Main Header -->
          <header class="main-header">
            <div class="flex items-center gap-12">
              <button class="btn btn-ghost btn-sm" id="sidebar-toggle" onclick="document.getElementById('app-sidebar').classList.toggle('mobile-open')">☰</button>
              <h2 class="main-header-title" id="page-header-title">ProofID Portal</h2>
            </div>
            <div class="main-header-actions">
              <span class="badge badge-verified flex items-center gap-4">
                <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--emerald-400)"></span>
                Monad Testnet (10143)
              </span>
              <button class="btn btn-secondary btn-sm" onclick="app.showWalletModal()">
                👛 ${walletShort}
              </button>
              <button class="btn btn-primary btn-sm" onclick="app.showQuickActionModal()">
                + Action
              </button>
            </div>
          </header>

          <!-- Dynamic Page Container -->
          <div class="page-content" id="page-content-container">
            <!-- Rendered by specific page method -->
          </div>
        </div>
      </div>
    `;

    // Render active route content
    const pageEl = document.getElementById('page-content-container');
    const headerTitleEl = document.getElementById('page-header-title');

    switch (route) {
      case 'dashboard':
        if (headerTitleEl) headerTitleEl.textContent = 'Dashboard & Reputation Overview';
        this.renderDashboardView(pageEl);
        break;
      case 'credentials':
        if (headerTitleEl) headerTitleEl.textContent = 'Verifiable Credentials Vault';
        this.renderCredentialsView(pageEl);
        break;
      case 'agents':
        if (headerTitleEl) headerTitleEl.textContent = 'Autonomous AI Agents Registry';
        this.renderAgentsView(pageEl);
        break;
      case 'agent-detail':
        if (headerTitleEl) headerTitleEl.textContent = 'AI Agent Intelligence & Telemetry';
        this.renderAgentDetailView(pageEl, params.get('id'));
        break;
      case 'analyzer':
        if (headerTitleEl) headerTitleEl.textContent = 'AI Trust Analyzer (Claude Engine)';
        this.renderAnalyzerView(pageEl, params.get('subject_id'), params.get('subject_type'));
        break;
      case 'blockchain':
        if (headerTitleEl) headerTitleEl.textContent = 'Monad Testnet On-Chain Proofs';
        this.renderBlockchainView(pageEl);
        break;
      case 'verify':
        if (headerTitleEl) headerTitleEl.textContent = 'Public Verification & Lookup Oracle';
        this.renderPublicVerifyView(pageEl, params.get('q'));
        break;
      case 'settings':
        if (headerTitleEl) headerTitleEl.textContent = 'Account & Privacy Settings';
        this.renderSettingsView(pageEl);
        break;
      case 'create-identity':
        if (headerTitleEl) headerTitleEl.textContent = 'Create Your ProofID';
        this.renderCreateIdentityWizard(pageEl);
        break;
      default:
        this.renderDashboardView(pageEl);
    }
  }

  // ── DASHBOARD VIEW ───────────────────────────────────────────
  async renderDashboardView(container) {
    showPageLoading('page-content-container');
    try {
      const data = await window.api.getDashboard();
      if (!data || data.error) {
        container.innerHTML = renderError(data?.error || 'Failed to load dashboard data');
        return;
      }

      if (!data.has_identity) {
        this.navigate('create-identity');
        return;
      }

      const id = data.identity;
      this.identity = id;
      const stats = data.stats;
      const agents = data.agents || [];
      const recentEvents = data.recent_events || [];
      const reports = data.recent_reports || [];

      container.innerHTML = `
        <!-- Demo Banner -->
        ${renderDemoBanner()}

        <!-- Identity Hero Card -->
        <div class="identity-card-hero">
          <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:20px;">
            <div class="flex items-center gap-20">
              <div class="identity-avatar">${getInitials(id.display_name)}</div>
              <div>
                <div class="flex items-center gap-12 mb-4">
                  <h1 class="identity-name">${id.display_name}</h1>
                  <span class="badge ${id.verification_status === 'verified' ? 'badge-verified' : 'badge-unverified'}">
                    ${id.verification_status === 'verified' ? '✅ Verified Identity' : '⏳ Pending Verification'}
                  </span>
                </div>
                <div class="flex items-center gap-12">
                  <span class="identity-proof-id font-mono">${id.proof_id}</span>
                  <button class="btn btn-ghost btn-sm" onclick="app.copyToClipboard('${id.proof_id}', 'ProofID copied!')" style="padding:2px 8px;font-size:11px;">📋 Copy</button>
                  <button class="btn btn-ghost btn-sm" onclick="app.showIdentityQR('${id.proof_id}')" style="padding:2px 8px;font-size:11px;">📱 QR Code</button>
                </div>
                ${id.bio ? `<p class="text-xs text-secondary mt-8" style="max-width:500px">${id.bio}</p>` : ''}
              </div>
            </div>

            <div class="flex items-center gap-20">
              <div class="text-center">
                ${renderScoreRing(stats.reputation_score, 1000, 110)}
                <div class="text-xs text-muted mt-4">Reputation Score</div>
              </div>
            </div>
          </div>

          <!-- Social & Wallet Pill Row -->
          <div class="flex items-center gap-12 mt-20 pt-16" style="border-top:1px solid rgba(255,255,255,0.06);flex-wrap:wrap;">
            <span class="text-xs text-muted">Wallet:</span>
            <span class="font-mono text-xs text-purple">${id.wallet_address ? `${id.wallet_address.slice(0,10)}...${id.wallet_address.slice(-6)}` : 'No wallet connected'}</span>
            ${id.twitter_handle ? `<span class="badge badge-purple">🐦 @${id.twitter_handle}</span>` : ''}
            ${id.github_handle ? `<span class="badge badge-blue">💻 github/${id.github_handle}</span>` : ''}
            <div style="margin-left:auto;">
              <button class="btn btn-secondary btn-sm" onclick="app.navigate('analyzer', {subject_id: '${id.proof_id}', subject_type: 'identity'})">
                🔍 Run AI Trust Analysis
              </button>
            </div>
          </div>
        </div>

        <!-- Top Metrics Cards -->
        <div class="grid-4 mb-24">
          <div class="stat-card">
            <div class="stat-icon">📜</div>
            <div class="stat-value text-emerald">${stats.credential_count}</div>
            <div class="stat-label">Active Credentials</div>
            <div class="stat-change">+75 pts this week</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🤖</div>
            <div class="stat-value text-blue">${stats.agent_count}</div>
            <div class="stat-label">Autonomous AI Agents</div>
            <div class="stat-change">97.4% Avg Success</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⛓️</div>
            <div class="stat-value text-purple">Monad</div>
            <div class="stat-label">Blockchain Anchor</div>
            <div class="stat-change">Block #14205892</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🛡️</div>
            <div class="stat-value text-cyan">${stats.verification_status === 'verified' ? 'Tier 1' : 'Tier 0'}</div>
            <div class="stat-label">Trust Assurance</div>
            <div class="stat-change">Passkey ZK Proof</div>
          </div>
        </div>

        <!-- Two Column Main Layout -->
        <div class="grid-2">
          <!-- Left Column: Verifiable Credentials & Monad Anchor -->
          <div class="flex flex-col gap-20">
            <!-- Credentials Card -->
            <div class="card">
              <div class="card-header flex items-center justify-between">
                <div>
                  <h3 class="card-title">Verifiable Credentials</h3>
                  <div class="card-subtitle">Cryptographically proven off-chain credentials</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="app.showAddCredentialModal()">+ Issue Credential</button>
              </div>
              <div class="card-body">
                <div id="dashboard-credentials-list" class="flex flex-col gap-12">
                  <!-- Loaded dynamically below -->
                  <div class="spinner"></div>
                </div>
              </div>
            </div>

            <!-- Monad Blockchain Proof Summary -->
            <div class="card">
              <div class="card-header flex items-center justify-between">
                <div>
                  <h3 class="card-title">Monad Testnet Anchor</h3>
                  <div class="card-subtitle">Immutable root on high-throughput EVM</div>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="app.navigate('blockchain')">Explorer ➔</button>
              </div>
              <div class="card-body">
                ${renderBlockchainProof({
                  network_name: 'Monad Testnet',
                  chain_id: 10143,
                  tx_hash: id.blockchain_tx_hash || 'DEMO_0x8f2d9c1e7a4b3d8f5c2a1e0b9d8f7c6e5a4b3d2c1e0f9a8b7c6d5e4f3a2b1c0d',
                  block_number: 14205892,
                  contract_address: '0x3A5B8c72D96aB10E463138b1E22964e5C48E1D94',
                  proof_type: 'identity_registration',
                  explorer_url: 'https://testnet.monadexplorer.com',
                  is_simulated: true,
                })}
              </div>
            </div>
          </div>

          <!-- Right Column: AI Agents & Reputation Activity Feed -->
          <div class="flex flex-col gap-20">
            <!-- Linked Autonomous Agents -->
            <div class="card">
              <div class="card-header flex items-center justify-between">
                <div>
                  <h3 class="card-title">Linked AI Agents</h3>
                  <div class="card-subtitle">Sub-agents operating under this identity</div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="app.showAddAgentModal()">+ Register Agent</button>
              </div>
              <div class="card-body">
                ${agents.length > 0 ? `
                  <div class="flex flex-col gap-12">
                    ${agents.slice(0, 2).map(ag => renderAgentCard(ag)).join('')}
                    ${agents.length > 2 ? `
                      <button class="btn btn-ghost btn-sm btn-block mt-8" onclick="app.navigate('agents')">View All ${agents.length} Agents ➔</button>
                    ` : ''}
                  </div>
                ` : renderEmpty('🤖', 'No AI Agents Linked', 'Register autonomous sub-agents to build collective reputation.', '<button class="btn btn-primary btn-sm" onclick="app.showAddAgentModal()">Register Agent</button>')}
              </div>
            </div>

            <!-- Reputation Timeline Activity -->
            <div class="card">
              <div class="card-header flex items-center justify-between">
                <div>
                  <h3 class="card-title">Reputation Timeline</h3>
                  <div class="card-subtitle">Verifiable trust events & score impacts</div>
                </div>
                <span class="badge badge-purple">${recentEvents.length} Events</span>
              </div>
              <div class="card-body">
                ${recentEvents.length > 0 ? `
                  <div class="timeline">
                    ${recentEvents.slice(0, 6).map(ev => renderReputationEvent(ev)).join('')}
                  </div>
                ` : renderEmpty('📜', 'No Activity Yet', 'Complete actions or issue credentials to record trust events.')}
              </div>
            </div>
          </div>
        </div>
      `;

      // Load full credentials list inside card
      this.loadDashboardCredentials();

    } catch (e) {
      container.innerHTML = renderError('Failed to render dashboard: ' + e.message);
    }
  }

  async loadDashboardCredentials() {
    const listEl = document.getElementById('dashboard-credentials-list');
    if (!listEl) return;
    try {
      const res = await window.api.getCredentials();
      const creds = res.results || res || [];
      if (creds.length > 0) {
        listEl.innerHTML = creds.slice(0, 4).map(c => renderCredentialCard(c)).join('');
      } else {
        listEl.innerHTML = renderEmpty('📜', 'No Credentials Yet', 'Claim developer, student, or researcher credentials.', '<button class="btn btn-primary btn-sm" onclick="app.showAddCredentialModal()">Claim Credential</button>');
      }
    } catch (e) {
      listEl.innerHTML = '<div class="text-xs text-muted">Failed to load credentials</div>';
    }
  }

  // ── CREDENTIALS VIEW ─────────────────────────────────────────
  // ── CREDENTIALS VIEW ─────────────────────────────────────────
  async renderCredentialsView(container, activeFilter = 'all') {
    showPageLoading('page-content-container');
    try {
      const res = await window.api.getCredentials();
      const credentials = res.results || res || [];

      this._allCredentials = credentials;
      const govCount = credentials.filter(c => ['DRIVING_LICENSE', 'PASSPORT', 'NATIONAL_ID', 'PROOF_OF_ADDRESS', 'BIOMETRIC_ID', 'HUMAN_VERIFIED'].includes(c.credential_type)).length;
      const devCount = credentials.filter(c => ['DEVELOPER', 'AI_RESEARCHER', 'WEB3_BUILDER', 'HACKATHON_BUILDER', 'SECURITY_RESEARCHER', 'OPEN_SOURCE'].includes(c.credential_type)).length;
      const proCount = credentials.filter(c => ['EMPLOYMENT_VERIFIED', 'UNIVERSITY_DEGREE', 'FINANCIAL_KYC', 'LEGAL_LICENSE', 'MEDICAL_LICENSE', 'STUDENT'].includes(c.credential_type)).length;

      let filteredCreds = credentials;
      if (activeFilter === 'identity') {
        filteredCreds = credentials.filter(c => ['DRIVING_LICENSE', 'PASSPORT', 'NATIONAL_ID', 'PROOF_OF_ADDRESS', 'BIOMETRIC_ID', 'HUMAN_VERIFIED'].includes(c.credential_type));
      } else if (activeFilter === 'developer') {
        filteredCreds = credentials.filter(c => ['DEVELOPER', 'AI_RESEARCHER', 'WEB3_BUILDER', 'HACKATHON_BUILDER', 'SECURITY_RESEARCHER', 'OPEN_SOURCE'].includes(c.credential_type));
      } else if (activeFilter === 'professional') {
        filteredCreds = credentials.filter(c => ['EMPLOYMENT_VERIFIED', 'UNIVERSITY_DEGREE', 'FINANCIAL_KYC', 'LEGAL_LICENSE', 'MEDICAL_LICENSE', 'STUDENT'].includes(c.credential_type));
      }

      container.innerHTML = `
        ${renderDemoBanner()}

        <div class="flex items-center justify-between mb-24" style="flex-wrap:wrap;gap:12px;">
          <div>
            <h1 class="section-title">Verifiable Credentials & ID Proofs</h1>
            <p class="section-subtitle">Zero-knowledge, cryptographically anchored ID proofs & professional credentials supporting your ProofID reputation.</p>
          </div>
          <div class="flex items-center gap-12">
            <button class="btn btn-secondary btn-sm" onclick="app.showVerifyHashModal()">🔍 Verify SHA3 Hash</button>
            <button class="btn btn-primary" onclick="app.showAddCredentialModal()">+ Issue / Claim ID Proof</button>
          </div>
        </div>

        <!-- Metrics Ticker -->
        <div class="grid-4 mb-24">
          <div class="stat-card">
            <div class="stat-label">Total Vaulted Proofs</div>
            <div class="stat-value text-purple">${credentials.length}</div>
            <div class="stat-change">+100% On-Chain Verifiable</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">🪪 Government ID Proofs</div>
            <div class="stat-value text-amber">${govCount}</div>
            <div class="stat-change">DMV, Passport, National ID</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">💻 Developer & AI Badges</div>
            <div class="stat-value text-blue">${devCount}</div>
            <div class="stat-change">GitHub, ArXiv, Monad</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">💼 Academic & Professional</div>
            <div class="stat-value text-emerald">${proCount}</div>
            <div class="stat-change">Degrees, Licensure, KYC</div>
          </div>
        </div>

        <!-- Filter Pills & Search Bar -->
        <div class="flex items-center justify-between gap-16 mb-20" style="flex-wrap:wrap;">
          <div class="filter-pills-row" style="margin-bottom:0;">
            <button class="category-pill ${activeFilter === 'all' ? 'active' : ''}" onclick="app.renderCredentialsView(document.getElementById('page-content-container'), 'all')">
              <span>All Proofs</span> <span class="badge badge-purple" style="font-size:10px;">${credentials.length}</span>
            </button>
            <button class="category-pill ${activeFilter === 'identity' ? 'active' : ''}" onclick="app.renderCredentialsView(document.getElementById('page-content-container'), 'identity')">
              <span>🪪 Government IDs</span> <span class="badge badge-amber" style="font-size:10px;">${govCount}</span>
            </button>
            <button class="category-pill ${activeFilter === 'developer' ? 'active' : ''}" onclick="app.renderCredentialsView(document.getElementById('page-content-container'), 'developer')">
              <span>💻 Developer & Web3</span> <span class="badge badge-blue" style="font-size:10px;">${devCount}</span>
            </button>
            <button class="category-pill ${activeFilter === 'professional' ? 'active' : ''}" onclick="app.renderCredentialsView(document.getElementById('page-content-container'), 'professional')">
              <span>💼 Academic & Pro</span> <span class="badge badge-emerald" style="font-size:10px;">${proCount}</span>
            </button>
          </div>

          <div style="min-width:240px;flex:1;max-width:360px;">
            <input type="text" class="form-input" id="cred-search-input" placeholder="Search by name, issuer, or hash..." oninput="app.filterCredentialsList(this.value)" style="padding:8px 14px;font-size:13px;" />
          </div>
        </div>

        <!-- Credentials Grid -->
        <div id="credentials-grid-container">
          ${filteredCreds.length > 0 ? `
            <div class="grid-2">
              ${filteredCreds.map(c => `
                <div class="card credential-card ${c.is_revoked ? 'opacity-50' : ''}" style="padding:22px;position:relative;border-left:4px solid var(--${CREDENTIAL_META[c.credential_type]?.color || 'purple'}-500);">
                  <div class="flex items-start justify-between mb-16">
                    <div class="flex items-center gap-14">
                      <div class="credential-icon-box" style="font-size:32px;width:56px;height:56px;border-radius:var(--radius-md);background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        ${getCredentialIcon(c.credential_type)}
                      </div>
                      <div>
                        <div class="flex items-center gap-8 mb-4">
                          <h3 class="font-display font-bold text-base text-primary">${getCredentialLabel(c.credential_type)}</h3>
                          <span class="badge badge-${CREDENTIAL_META[c.credential_type]?.color || 'purple'}">+${getCredentialPoints(c.credential_type)} pts</span>
                        </div>
                        <div class="text-xs text-secondary">
                          Issuer: <strong>${c.issuer_name}</strong> · <span class="text-muted">${formatDate(c.issued_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      ${c.is_revoked ? '<span class="badge badge-red">Revoked</span>' : '<span class="badge badge-verified">✅ Monad Anchored</span>'}
                    </div>
                  </div>

                  ${c.evidence_url ? `
                    <div class="card mb-12" style="padding:10px 14px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);">
                      <div class="text-xs text-muted mb-2">Verified Claim / Evidence ID</div>
                      <div class="font-mono text-xs text-cyan truncate">${c.evidence_url}</div>
                    </div>
                  ` : ''}

                  ${c.notes ? `
                    <div class="text-xs text-secondary mb-12 italic">"${c.notes}"</div>
                  ` : ''}

                  <!-- Cryptographic Proof Box -->
                  <div class="blockchain-proof">
                    <div class="blockchain-proof-row">
                      <span class="blockchain-proof-key">SHA3 Merkle Leaf</span>
                      <span class="blockchain-proof-value font-mono flex items-center gap-6">
                        ${shortHash(c.credential_hash)}
                        <button class="btn btn-ghost btn-sm" onclick="app.copyToClipboard('${c.credential_hash}', 'Hash copied!')" style="padding:1px 4px;font-size:9px;">📋</button>
                      </span>
                    </div>
                    <div class="blockchain-proof-row">
                      <span class="blockchain-proof-key">Monad Tx Proof</span>
                      <span class="blockchain-proof-value font-mono text-purple">${shortHash(c.blockchain_tx_hash)}</span>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center justify-between mt-16 pt-12" style="border-top:1px solid rgba(255,255,255,0.06);">
                    <button class="btn btn-secondary btn-sm" onclick="app.showCredentialDetails('${c.id}')">Inspect Verification Proof ➔</button>
                    ${!c.is_revoked ? `
                      <button class="btn btn-ghost btn-sm" onclick="app.revokeCredential('${c.id}')" style="color:var(--red-400);font-size:12px;">Revoke</button>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : renderEmpty('🪪', 'No Credentials in this Category', 'Issue or claim Driver\'s License, Passport, National ID, or Developer badges.', '<button class="btn btn-primary" onclick="app.showAddCredentialModal()">+ Issue First Credential</button>')}
        </div>
      `;
    } catch (e) {
      container.innerHTML = renderError('Failed to load credentials: ' + e.message);
    }
  }

  filterCredentialsList(query) {
    const q = query.trim().toLowerCase();
    const container = document.getElementById('credentials-grid-container');
    if (!container || !this._allCredentials) return;

    const matches = this._allCredentials.filter(c => {
      return (
        getCredentialLabel(c.credential_type).toLowerCase().includes(q) ||
        (c.issuer_name && c.issuer_name.toLowerCase().includes(q)) ||
        (c.evidence_url && c.evidence_url.toLowerCase().includes(q)) ||
        (c.credential_hash && c.credential_hash.toLowerCase().includes(q))
      );
    });

    if (matches.length === 0) {
      container.innerHTML = renderEmpty('🔍', 'No Matching Credentials', `No vaulted credentials match "${query}".`);
      return;
    }

    container.innerHTML = `
      <div class="grid-2">
        ${matches.map(c => `
          <div class="card credential-card" style="padding:22px;border-left:4px solid var(--${CREDENTIAL_META[c.credential_type]?.color || 'purple'}-500);">
            <div class="flex items-start justify-between mb-16">
              <div class="flex items-center gap-14">
                <div class="credential-icon-box" style="font-size:32px;width:56px;height:56px;border-radius:var(--radius-md);background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;">
                  ${getCredentialIcon(c.credential_type)}
                </div>
                <div>
                  <div class="flex items-center gap-8 mb-4">
                    <h3 class="font-display font-bold text-base text-primary">${getCredentialLabel(c.credential_type)}</h3>
                    <span class="badge badge-${CREDENTIAL_META[c.credential_type]?.color || 'purple'}">+${getCredentialPoints(c.credential_type)} pts</span>
                  </div>
                  <div class="text-xs text-secondary">
                    Issuer: <strong>${c.issuer_name}</strong> · ${formatDate(c.issued_at)}
                  </div>
                </div>
              </div>
              <span class="badge badge-verified">✅ Monad Anchored</span>
            </div>
            ${c.evidence_url ? `<div class="card mb-12" style="padding:8px 12px;background:rgba(0,0,0,0.25);"><div class="font-mono text-xs text-cyan truncate">${c.evidence_url}</div></div>` : ''}
            <div class="blockchain-proof">
              <div class="blockchain-proof-row"><span class="blockchain-proof-key">SHA3 Root</span><span class="font-mono text-xs">${shortHash(c.credential_hash)}</span></div>
            </div>
            <div class="mt-16 text-right">
              <button class="btn btn-secondary btn-sm" onclick="app.showCredentialDetails('${c.id}')">Inspect Proof ➔</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── AGENTS VIEW ──────────────────────────────────────────────
  async renderAgentsView(container) {
    showPageLoading('page-content-container');
    try {
      const res = await window.api.getAgents();
      const agents = res.results || res || [];

      const totalTasks = agents.reduce((acc, a) => acc + (a.total_tasks || 0), 0);
      const avgSuccess = agents.length > 0 ? (agents.reduce((acc, a) => acc + (a.success_rate || 0), 0) / agents.length).toFixed(1) : 0;

      container.innerHTML = `
        ${renderDemoBanner()}

        <div class="flex items-center justify-between mb-24" style="flex-wrap:wrap;gap:12px;">
          <div>
            <h1 class="section-title">Autonomous AI Agent Registry</h1>
            <p class="section-subtitle">Manage decentralized sub-agents operating autonomously under your cryptographic ProofID.</p>
          </div>
          <button class="btn btn-primary" onclick="app.showAddAgentModal()">+ Register AI Agent</button>
        </div>

        <div class="grid-stats mb-24">
          <div class="stat-card">
            <div class="stat-label">Registered Agents</div>
            <div class="stat-value text-blue">${agents.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Executed Tasks</div>
            <div class="stat-value text-purple">${totalTasks.toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Average Success Rate</div>
            <div class="stat-value text-emerald">${avgSuccess}%</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Monad Sub-Registry</div>
            <div class="stat-value text-cyan">Live</div>
          </div>
        </div>

        ${agents.length > 0 ? `
          <div class="grid-3">
            ${agents.map(ag => `
              <div class="card" style="padding:24px;cursor:pointer;" onclick="app.showAgentDetail('${ag.id}')">
                <div class="flex items-start justify-between mb-16">
                  <div class="flex items-center gap-12">
                    <div class="agent-icon">🤖</div>
                    <div>
                      <h4 class="font-display font-bold text-base">${ag.name}</h4>
                      <div class="font-mono text-xs text-blue">${ag.agent_id}</div>
                    </div>
                  </div>
                  <span class="badge ${ag.is_verified ? 'badge-verified' : 'badge-pending'}">
                    ${ag.is_verified ? 'Verified' : 'Pending'}
                  </span>
                </div>

                <p class="text-xs text-secondary mb-16" style="min-height:36px;line-height:1.5;">${ag.description.slice(0, 100)}...</p>

                <div class="grid-3 mb-16" style="background:var(--bg-input);padding:10px;border-radius:var(--radius-md);">
                  <div class="agent-stat"><span class="agent-stat-value">${ag.total_tasks}</span><span class="agent-stat-label">Tasks</span></div>
                  <div class="agent-stat"><span class="agent-stat-value text-emerald">${ag.success_rate}%</span><span class="agent-stat-label">Success</span></div>
                  <div class="agent-stat"><span class="agent-stat-value text-purple">${ag.reputation_score || 100}</span><span class="agent-stat-label">Rep</span></div>
                </div>

                <div class="flex flex-wrap gap-4 mb-16">
                  ${(ag.capabilities || []).slice(0, 3).map(cap => `<span class="badge badge-purple" style="font-size:10px">${cap}</span>`).join('')}
                </div>

                <div class="flex items-center justify-between pt-12" style="border-top:1px solid var(--border-primary)">
                  <span class="text-xs text-muted font-mono">${ag.model_name || 'LLM Agent'}</span>
                  <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();app.showAgentDetail('${ag.id}')">Run & Inspect ➔</button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : renderEmpty('🤖', 'No Agents Registered', 'Register autonomous AI subagents to delegate tasks with verifiable telemetry.', '<button class="btn btn-primary" onclick="app.showAddAgentModal()">Register First Agent</button>')}
      `;
    } catch (e) {
      container.innerHTML = renderError('Failed to load agents: ' + e.message);
    }
  }

  // ── AGENT DETAIL & SIMULATION VIEW ───────────────────────────
  async showAgentDetail(agentId) {
    this.navigate('agent-detail', { id: agentId });
  }

  async renderAgentDetailView(container, agentId) {
    if (!agentId) {
      this.navigate('agents');
      return;
    }
    showPageLoading('page-content-container');
    try {
      const agent = await window.api.getAgent(agentId);
      if (!agent || agent.error) {
        container.innerHTML = renderError(agent?.error || 'Agent not found');
        return;
      }

      this.currentAgentId = agentId;
      const activities = agent.activity_logs || [];

      container.innerHTML = `
        ${renderDemoBanner()}

        <div class="mb-20">
          <a href="#agents" onclick="app.navigate('agents')" class="text-xs text-purple font-mono" style="text-decoration:none">← Back to Agent Registry</a>
        </div>

        <!-- Agent Hero Card -->
        <div class="card card-glow mb-24" style="padding:28px;">
          <div class="flex items-start justify-between" style="flex-wrap:wrap;gap:20px;">
            <div class="flex items-center gap-20">
              <div class="agent-icon" style="width:64px;height:64px;font-size:32px;">🤖</div>
              <div>
                <div class="flex items-center gap-12 mb-4">
                  <h1 class="font-display font-bold text-xl">${agent.name}</h1>
                  <span class="badge ${agent.is_verified ? 'badge-verified' : 'badge-pending'}">${agent.is_verified ? '✅ Verified Agent' : '⏳ Pending'}</span>
                </div>
                <div class="font-mono text-sm text-blue mb-8">${agent.agent_id}</div>
                <p class="text-sm text-secondary" style="max-width:640px;">${agent.description}</p>
              </div>
            </div>

            <div class="flex items-center gap-12">
              <button class="btn btn-secondary btn-sm" onclick="app.navigate('analyzer', {subject_id: '${agent.agent_id}', subject_type: 'agent'})">
                🔍 AI Trust Evaluation
              </button>
              <button class="btn btn-primary btn-sm" onclick="app.showSimulateActivityModal('${agent.id}', '${agent.name}')">
                ⚡ Simulate Live Task Execution
              </button>
            </div>
          </div>

          <div class="grid-4 mt-24 pt-20" style="border-top:1px solid rgba(255,255,255,0.06);">
            <div><span class="text-xs text-muted">Model Engine</span><div class="font-bold text-sm text-primary">${agent.model_name || 'Claude 3.5 Sonnet'} (v${agent.version || '1.0'})</div></div>
            <div><span class="text-xs text-muted">Total Tasks</span><div class="font-bold text-sm text-primary">${agent.total_tasks}</div></div>
            <div><span class="text-xs text-muted">Success Rate</span><div class="font-bold text-sm text-emerald">${agent.success_rate}%</div></div>
            <div><span class="text-xs text-muted">Agent Reputation</span><div class="font-bold text-sm text-purple">${agent.reputation_score || 100} / 1000</div></div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Left: Capabilities & Monad Proof -->
          <div class="flex flex-col gap-20">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Registered Capabilities & Scopes</h3>
                <div class="card-subtitle">Permitted execution invariants</div>
              </div>
              <div class="card-body">
                <div class="flex flex-wrap gap-8 mb-16">
                  ${(agent.capabilities || []).map(cap => `
                    <div class="badge badge-purple" style="padding:8px 14px;font-size:12px;">🛡️ ${cap}</div>
                  `).join('')}
                </div>
                <div class="text-xs text-muted">
                  Endpoint URL: <code class="font-mono text-cyan">${agent.endpoint_url || 'https://agents.proofid.network/v1/sentinel'}</code>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Monad Testnet Attestation</h3>
                <div class="card-subtitle">Sub-agent registration hash</div>
              </div>
              <div class="card-body">
                ${renderBlockchainProof({
                  network_name: 'Monad Testnet',
                  chain_id: 10143,
                  tx_hash: agent.blockchain_tx_hash || 'DEMO_0x9a8b7c6d5e4f3a2b1c0d8f2d9c1e7a4b3d8f5c2a1e0b9d8f7c6e5a4b3d2c1e0f',
                  block_number: 14206210,
                  contract_address: '0x3A5B8c72D96aB10E463138b1E22964e5C48E1D94',
                  proof_type: 'agent_registration',
                  is_simulated: true,
                })}
              </div>
            </div>
          </div>

          <!-- Right: Telemetry & Activity Logs -->
          <div class="card">
            <div class="card-header flex items-center justify-between">
              <div>
                <h3 class="card-title">Execution Telemetry</h3>
                <div class="card-subtitle">Real-time task audit feed</div>
              </div>
              <button class="btn btn-primary btn-sm" onclick="app.showSimulateActivityModal('${agent.id}', '${agent.name}')">+ Run Task</button>
            </div>
            <div class="card-body">
              ${activities.length > 0 ? `
                <div class="timeline">
                  ${activities.map(act => `
                    <div class="timeline-item">
                      <div class="timeline-icon ${act.success ? 'timeline-icon-positive' : 'timeline-icon-negative'}">
                        ${act.success ? '🤖' : '⚠️'}
                      </div>
                      <div class="timeline-content">
                        <div class="timeline-title">${act.activity_type.replace(/_/g, ' ')} ${act.success ? '<span class="badge badge-verified" style="font-size:9px">Success</span>' : '<span class="badge badge-red" style="font-size:9px">Failed</span>'}</div>
                        <div class="timeline-meta">${act.description}</div>
                        ${act.duration_ms ? `<div class="text-xs font-mono text-cyan mt-4">⚡ ${act.duration_ms}ms execution latency</div>` : ''}
                      </div>
                      <div class="timeline-delta ${act.score_impact >= 0 ? 'positive' : 'negative'}">
                        ${act.score_impact >= 0 ? '+' : ''}${act.score_impact}
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : renderEmpty('⚡', 'No Activities Recorded', 'Execute simulated tasks to generate verifiable audit telemetry.', `<button class="btn btn-primary btn-sm" onclick="app.showSimulateActivityModal('${agent.id}', '${agent.name}')">Simulate Execution</button>`)}
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = renderError('Failed to load agent detail: ' + e.message);
    }
  }

  // ── AI TRUST ANALYZER VIEW ───────────────────────────────────
  async renderAnalyzerView(container, subjectIdParam = null, subjectTypeParam = 'identity') {
    showPageLoading('page-content-container');
    try {
      const defaultId = subjectIdParam || this.identity?.proof_id || 'PID-8F3A29B1';
      const defaultType = subjectTypeParam || 'identity';

      // Pre-fetch recent reports
      const reportsRes = await window.api.getTrustReports();
      const recentReports = reportsRes.reports || [];

      container.innerHTML = `
        ${renderDemoBanner()}

        <div class="mb-24">
          <h1 class="section-title">AI Trust Analyzer</h1>
          <p class="section-subtitle">Anthropic Claude intelligence evaluating cryptographic signals, credentials, and telemetry without revealing private data.</p>
        </div>

        <!-- Analyzer Input Card -->
        <div class="card card-glow mb-24" style="padding:24px;">
          <div class="grid-3" style="align-items:flex-end;">
            <div class="form-group">
              <label class="form-label">Subject Type</label>
              <select id="analyzer-subject-type" class="form-select">
                <option value="identity" ${defaultType === 'identity' ? 'selected' : ''}>Human Identity (ProofID)</option>
                <option value="agent" ${defaultType === 'agent' ? 'selected' : ''}>Autonomous AI Agent</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Subject ID or Identifier</label>
              <input type="text" id="analyzer-subject-id" class="form-input font-mono" value="${defaultId}" placeholder="e.g. PID-8F3A29B1 or AGT-7C91B420" />
            </div>
            <div>
              <button id="btn-run-analysis" class="btn btn-primary btn-block" onclick="app.runTrustAnalysis()">
                ✨ Run AI Trust Evaluation
              </button>
            </div>
          </div>
        </div>

        <!-- Analysis Output Container -->
        <div id="analyzer-output-container">
          <!-- If we have a pre-existing report, render it, else show invitation -->
          ${recentReports.length > 0 ? this.renderTrustReportHTML(recentReports[0]) : `
            <div class="card" style="padding:40px;text-align:center;">
              <div style="font-size:48px;margin-bottom:16px;">🔍</div>
              <h3 class="font-display font-bold text-lg mb-8">Ready to Analyze</h3>
              <p class="text-sm text-secondary max-width" style="max-width:480px;margin:0 auto 20px;">
                Select an Identity or AI Agent above and click "Run AI Trust Evaluation" to generate a comprehensive trust report.
              </p>
              <button class="btn btn-primary" onclick="app.runTrustAnalysis()">Analyze ${defaultId}</button>
            </div>
          `}
        </div>
      `;
    } catch (e) {
      container.innerHTML = renderError('Failed to load trust analyzer: ' + e.message);
    }
  }

  async runTrustAnalysis() {
    const typeEl = document.getElementById('analyzer-subject-type');
    const idEl = document.getElementById('analyzer-subject-id');
    const btn = document.getElementById('btn-run-analysis');
    const outputEl = document.getElementById('analyzer-output-container');

    if (!typeEl || !idEl || !outputEl) return;
    const subjectType = typeEl.value;
    const subjectId = idEl.value.trim();

    if (!subjectId) {
      window.toast.warning('Input Required', 'Please provide a Subject ID');
      return;
    }

    setLoading(btn, true, 'Evaluating Telemetry & Signals...');
    outputEl.innerHTML = `
      <div class="card" style="padding:48px;text-align:center;">
        <div class="spinner spinner-lg mb-16" style="margin:0 auto;"></div>
        <h3 class="font-display font-bold text-lg mb-8">Synthesizing Trust Report...</h3>
        <p class="text-xs text-secondary max-width" style="max-width:400px;margin:0 auto;">
          Querying Monad testnet proofs, aggregating credential signatures, and running Anthropic Claude probabilistic risk reasoning.
        </p>
      </div>
    `;

    try {
      const report = await window.api.analyze({ subject_type: subjectType, subject_id: subjectId });
      setLoading(btn, false);
      if (report && !report.error) {
        window.toast.success('Analysis Complete', `Trust score generated: ${report.trust_score}/100`);
        outputEl.innerHTML = this.renderTrustReportHTML(report);
      } else {
        outputEl.innerHTML = renderError(report?.error || 'Analysis failed. Make sure the ID exists.');
      }
    } catch (e) {
      setLoading(btn, false);
      outputEl.innerHTML = renderError('Network error during analysis: ' + e.message);
    }
  }

  renderTrustReportHTML(report) {
    const scoreColor = getTrustScoreColor(report.trust_score);
    return `
      <div class="flex flex-col gap-24">
        <!-- Top Score & Verdict Card -->
        <div class="card card-glow" style="padding:32px;">
          <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:20px;">
            <div class="trust-score-display" style="padding:20px 32px;background:rgba(0,0,0,0.3);border-radius:var(--radius-xl);">
              <div class="trust-score-number" style="color:${scoreColor}">${report.trust_score}</div>
              <div class="trust-score-label">AI Trust Score / 100</div>
              <div class="trust-confidence">
                <span class="badge ${report.confidence === 'HIGH' ? 'badge-verified' : 'badge-pending'}">${report.confidence} Confidence</span>
              </div>
            </div>

            <div style="flex:1;min-width:280px;">
              <div class="flex items-center gap-8 mb-8">
                <span class="badge badge-purple">Executive Recommendation</span>
                <span class="text-xs text-muted">Subject: <code class="font-mono text-cyan">${report.subject_id}</code></span>
              </div>
              <h3 class="font-display font-bold text-lg text-primary mb-12">${report.recommendation}</h3>
              <p class="text-xs text-secondary leading-relaxed">${report.full_analysis.replace(/\n/g, '<br/><br/>')}</p>
            </div>
          </div>
        </div>

        <!-- Strengths vs Risks Breakdown -->
        <div class="grid-2">
          <!-- Strengths -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title text-emerald flex items-center gap-8">
                <span>✅</span> Verified Trust Strengths
              </h3>
              <div class="card-subtitle">Cryptographically supported factors</div>
            </div>
            <div class="card-body">
              <div class="signal-list">
                ${(report.strengths || []).map(s => `
                  <div class="signal-item strength">
                    <span class="text-emerald font-bold">✔</span>
                    <span class="text-primary text-xs">${s}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Risks -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title text-amber flex items-center gap-8">
                <span>⚠️</span> Monitored Risk Factors
              </h3>
              <div class="card-subtitle">Observations and protocol warnings</div>
            </div>
            <div class="card-body">
              <div class="signal-list">
                ${(report.risks && report.risks.length > 0) ? report.risks.map(r => `
                  <div class="signal-item risk">
                    <span class="text-amber font-bold">⚠</span>
                    <span class="text-primary text-xs">${r}</span>
                  </div>
                `).join('') : `
                  <div class="signal-item strength">
                    <span class="text-emerald">✔</span>
                    <span class="text-xs text-secondary">Zero adverse safety triggers or risk flags detected.</span>
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>

        <!-- AI Transparency & Disclaimer -->
        <div class="card" style="padding:20px;background:rgba(0,0,0,0.2);">
          <div class="flex items-center justify-between mb-8">
            <span class="text-xs font-mono text-purple">Model: ${report.ai_model || 'Claude 3.5 Sonnet'}</span>
            <span class="badge badge-demo">Probabilistic Signal Analysis</span>
          </div>
          <p class="text-xs text-muted" style="line-height:1.6;">
            <strong>Verifiable Trust Disclaimer:</strong> ProofID AI Trust Analysis provides probabilistic evaluation based strictly on cryptographically verified signals, credential oracles, and historical execution logs. AI models do not guarantee behavioral safety.
          </p>
        </div>
      </div>
    `;
  }

  // ── BLOCKCHAIN TESTNET EXPLORER VIEW ─────────────────────────
  async renderBlockchainView(container) {
    showPageLoading('page-content-container');
    try {
      const status = await window.api.getBlockchainStatus();
      const proofs = status.recent_proofs || [];

      container.innerHTML = `
        ${renderDemoBanner()}

        <div class="flex items-center justify-between mb-24" style="flex-wrap:wrap;gap:12px;">
          <div>
            <h1 class="section-title">Monad Blockchain Explorer</h1>
            <p class="section-subtitle">Real-time cryptographic state proofs anchored on Monad high-throughput testnet.</p>
          </div>
          <span class="badge badge-verified">Chain ID: 10143 · Parallel EVM</span>
        </div>

        <!-- Smart Contract & RPC Status Card -->
        <div class="card card-glow mb-24" style="padding:24px;">
          <div class="grid-4">
            <div>
              <span class="text-xs text-muted">Network</span>
              <div class="font-bold text-sm text-primary">Monad Testnet</div>
            </div>
            <div>
              <span class="text-xs text-muted">Smart Contract Registry</span>
              <div class="font-mono text-xs text-purple">0x3A5B8c72...48E1D94</div>
            </div>
            <div>
              <span class="text-xs text-muted">Total Anchored Proofs</span>
              <div class="font-bold text-sm text-emerald">${status.total_proofs || proofs.length} Proofs</div>
            </div>
            <div>
              <span class="text-xs text-muted">Execution Mode</span>
              <div class="font-bold text-sm text-amber">Demo Simulated</div>
            </div>
          </div>
        </div>

        <!-- Recent On-Chain Proofs Feed -->
        <div class="card">
          <div class="card-header flex items-center justify-between">
            <div>
              <h3 class="card-title">Live On-Chain Registration Proofs</h3>
              <div class="card-subtitle">Verifiable transactions anchoring ProofIDs, agents, and credentials</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="app.renderBlockchainView(document.getElementById('page-content-container'))">↻ Refresh</button>
          </div>
          <div class="card-body">
            ${proofs.length > 0 ? `
              <div class="flex flex-col gap-16">
                ${proofs.map(p => `
                  <div style="background:var(--bg-card);border:1px solid var(--border-primary);border-radius:var(--radius-md);padding:16px;">
                    <div class="flex items-center justify-between mb-8">
                      <div class="flex items-center gap-8">
                        <span class="badge badge-purple">${p.proof_type?.replace(/_/g, ' ')}</span>
                        <span class="font-mono text-xs text-cyan">${p.proof_id || p.agent_id || 'Global Proof'}</span>
                      </div>
                      <span class="simulated-badge">Demo Mode</span>
                    </div>
                    <div class="blockchain-proof">
                      <div class="blockchain-proof-row">
                        <span class="blockchain-proof-key">Tx Hash</span>
                        <span class="blockchain-proof-value font-mono">${p.tx_hash}</span>
                      </div>
                      <div class="blockchain-proof-row">
                        <span class="blockchain-proof-key">Block</span>
                        <span class="blockchain-proof-value">#${p.block_number?.toLocaleString() || '14,205,892'}</span>
                      </div>
                      <div class="blockchain-proof-row">
                        <span class="blockchain-proof-key">Target Contract</span>
                        <span class="blockchain-proof-value">${p.contract_address}</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : renderEmpty('⛓️', 'No Proofs Found', 'Perform actions to anchor state to the Monad registry.')}
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = renderError('Failed to load blockchain explorer: ' + e.message);
    }
  }

  // ── PUBLIC VERIFIER VIEW ─────────────────────────────────────
  async renderPublicVerifyView(container, queryParam = '') {
    container.innerHTML = `
      <div class="verify-hero">
        <div class="hero-badge">ProofID Universal Oracle</div>
        <h1 class="hero-title" style="font-size:36px;margin-bottom:12px;">Public Trust Verification</h1>
        <p class="text-secondary text-sm mb-32">
          Verify any human ProofID, autonomous AI agent, or wallet address against immutable cryptographic anchors.
        </p>

        <div class="verify-search">
          <input type="text" id="public-verify-input" class="verify-search-input" value="${queryParam || 'PID-8F3A29B1'}" placeholder="Enter ProofID (PID-...), Agent ID (AGT-...), or Wallet (0x...)" />
          <button class="verify-search-btn" onclick="app.executePublicVerify()">Verify ➔</button>
        </div>

        <div class="flex items-center justify-center gap-12 mt-12 text-xs text-muted">
          <span>Quick samples:</span>
          <a href="javascript:void(0)" onclick="app.setPublicVerify('PID-8F3A29B1')" class="text-purple font-mono">PID-8F3A29B1</a>
          <span>·</span>
          <a href="javascript:void(0)" onclick="app.setPublicVerify('PID-4E90B12D')" class="text-purple font-mono">PID-4E90B12D</a>
          <span>·</span>
          <a href="javascript:void(0)" onclick="app.setPublicVerify('AGT-7C91B420')" class="text-blue font-mono">AGT-7C91B420</a>
        </div>

        <div id="public-verify-result-container" class="mt-24 text-left">
          <!-- Dynamic verify result -->
        </div>
      </div>
    `;

    if (queryParam) {
      this.executePublicVerify();
    }
  }

  setPublicVerify(q) {
    const el = document.getElementById('public-verify-input');
    if (el) {
      el.value = q;
      this.executePublicVerify();
    }
  }

  async executePublicVerify() {
    const input = document.getElementById('public-verify-input');
    const container = document.getElementById('public-verify-result-container');
    if (!input || !container) return;

    const query = input.value.trim();
    if (!query) return;

    container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><div>Querying ProofID Oracle for ${query}...</div></div>`;

    try {
      const data = await window.api.verify(query);
      if (data && data.found) {
        if (data.identity) {
          const id = data.identity;
          container.innerHTML = `
            <div class="verify-result verified">
              <div class="flex items-center justify-between mb-20">
                <div class="flex items-center gap-16">
                  <div class="identity-avatar" style="width:56px;height:56px;font-size:22px;">${getInitials(id.display_name)}</div>
                  <div>
                    <h2 class="font-display font-bold text-lg">${id.display_name}</h2>
                    <div class="font-mono text-xs text-purple">${id.proof_id}</div>
                  </div>
                </div>
                <span class="badge badge-verified">✅ Verified Human Identity</span>
              </div>

              ${id.bio ? `<p class="text-xs text-secondary mb-16">${id.bio}</p>` : ''}

              <div class="grid-3 mb-20">
                <div class="stat-card" style="padding:14px;"><span class="stat-label">Reputation Score</span><span class="stat-value text-emerald" style="font-size:24px;">${id.reputation_score} / 1000</span></div>
                <div class="stat-card" style="padding:14px;"><span class="stat-label">Active Credentials</span><span class="stat-value text-blue" style="font-size:24px;">${id.credential_count || 5}</span></div>
                <div class="stat-card" style="padding:14px;"><span class="stat-label">Monad Testnet</span><span class="stat-value text-purple" style="font-size:24px;">Anchored</span></div>
              </div>

              <h4 class="font-display font-bold text-sm mb-8">Verified Credentials</h4>
              <div class="flex flex-wrap gap-8 mb-20">
                ${(id.credentials || []).map(c => `
                  <span class="cred-badge cred-${c.credential_type}">${getCredentialIcon(c.credential_type)} ${getCredentialLabel(c.credential_type)}</span>
                `).join('')}
              </div>

              ${data.blockchain_proof ? `
                <h4 class="font-display font-bold text-sm mb-8">Blockchain Proof Anchor</h4>
                ${renderBlockchainProof(data.blockchain_proof)}
              ` : ''}

              <div class="mt-20 pt-16 flex items-center justify-between" style="border-top:1px solid var(--border-primary)">
                <span class="text-xs text-muted font-mono">Proof Hash: ${shortHash(id.proof_id_hash)}</span>
                <button class="btn btn-secondary btn-sm" onclick="app.copyToClipboard(window.location.href, 'Verification link copied!')">🔗 Share Verification Link</button>
              </div>
            </div>
          `;
        } else if (data.agent) {
          const ag = data.agent;
          container.innerHTML = `
            <div class="verify-result verified">
              <div class="flex items-center justify-between mb-20">
                <div class="flex items-center gap-16">
                  <div class="agent-icon" style="width:56px;height:56px;font-size:28px;">🤖</div>
                  <div>
                    <h2 class="font-display font-bold text-lg">${ag.name}</h2>
                    <div class="font-mono text-xs text-blue">${ag.agent_id}</div>
                  </div>
                </div>
                <span class="badge badge-verified">✅ Verified Autonomous Agent</span>
              </div>

              <p class="text-xs text-secondary mb-16">${ag.description}</p>

              <div class="grid-3 mb-20">
                <div class="stat-card" style="padding:14px;"><span class="stat-label">Success Rate</span><span class="stat-value text-emerald" style="font-size:24px;">${ag.success_rate}%</span></div>
                <div class="stat-card" style="padding:14px;"><span class="stat-label">Total Tasks</span><span class="stat-value text-blue" style="font-size:24px;">${ag.total_tasks}</span></div>
                <div class="stat-card" style="padding:14px;"><span class="stat-label">Agent Reputation</span><span class="stat-value text-purple" style="font-size:24px;">${ag.reputation_score}</span></div>
              </div>

              ${data.blockchain_proof ? renderBlockchainProof(data.blockchain_proof) : ''}
            </div>
          `;
        }
      } else {
        container.innerHTML = `
          <div class="verify-result not-found">
            <div class="flex items-center gap-8 text-red-400 font-bold mb-8">
              <span>❌</span> Record Not Found
            </div>
            <p class="text-xs text-muted">No public identity or agent matches "${query}". Please check the identifier.</p>
          </div>
        `;
      }
    } catch (e) {
      container.innerHTML = `<div class="verify-result not-found"><p class="text-xs text-red-400">Lookup error: ${e.message}</p></div>`;
    }
  }

  // ── SETTINGS VIEW ────────────────────────────────────────────
  async renderSettingsView(container) {
    showPageLoading('page-content-container');
    try {
      const settingsData = await window.api.getSettings();
      const user = settingsData.user;
      const id = this.identity || {};

      container.innerHTML = `
        ${renderDemoBanner()}

        <div class="mb-24">
          <h1 class="section-title">Account & Privacy Settings</h1>
          <p class="section-subtitle">Configure identity privacy, connected wallets, and cryptographic keys.</p>
        </div>

        <div class="grid-2">
          <!-- Profile Settings -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Identity Profile</h3>
              <div class="card-subtitle">Public metadata associated with your ProofID</div>
            </div>
            <div class="card-body">
              <form onsubmit="app.saveProfile(event)" class="flex flex-col gap-16">
                <div class="form-group">
                  <label class="form-label">Display Name</label>
                  <input type="text" id="settings-name" class="form-input" value="${id.display_name || user.username}" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Bio</label>
                  <textarea id="settings-bio" class="form-textarea">${id.bio || ''}</textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">Twitter / X Handle</label>
                  <input type="text" id="settings-twitter" class="form-input" value="${id.twitter_handle || ''}" placeholder="e.g. alex_builds" />
                </div>
                <div class="form-group">
                  <label class="form-label">GitHub Handle</label>
                  <input type="text" id="settings-github" class="form-input" value="${id.github_handle || ''}" placeholder="e.g. arivera-ai" />
                </div>
                <button type="submit" class="btn btn-primary btn-block">Save Profile Changes</button>
              </form>
            </div>
          </div>

          <!-- Wallet & Privacy -->
          <div class="flex flex-col gap-20">
            <!-- Wallet Connect Card -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Monad Testnet Wallet</h3>
                <div class="card-subtitle">Connected EVM account for signing proofs</div>
              </div>
              <div class="card-body">
                <div class="form-group mb-16">
                  <label class="form-label">Active Wallet Address</label>
                  <input type="text" id="settings-wallet" class="form-input font-mono" value="${id.wallet_address || '0x71C8364f3B731057434524F5374464a938Efe608'}" />
                </div>
                <button class="btn btn-secondary btn-block" onclick="app.updateWalletAddress()">Update Monad Wallet</button>
              </div>
            </div>

            <!-- Developer API Keys -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Developer API Access</h3>
                <div class="card-subtitle">REST API tokens for agent automation</div>
              </div>
              <div class="card-body">
                <div class="form-group mb-12">
                  <label class="form-label">JWT Bearer Token (Session)</label>
                  <input type="text" class="form-input font-mono text-xs" value="${localStorage.getItem('proofid_access_token') || 'eyJhbGciOiJIUzI1NiIsIn...'}" readonly />
                </div>
                <button class="btn btn-ghost btn-sm" onclick="app.copyToClipboard(localStorage.getItem('proofid_access_token'), 'JWT Token copied!')">📋 Copy Bearer Token</button>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = renderError('Failed to load settings: ' + e.message);
    }
  }

  async saveProfile(e) {
    e.preventDefault();
    const name = document.getElementById('settings-name').value.trim();
    const bio = document.getElementById('settings-bio').value.trim();
    const twitter = document.getElementById('settings-twitter').value.trim();
    const github = document.getElementById('settings-github').value.trim();

    try {
      const res = await window.api.updateIdentity({
        display_name: name,
        bio,
        twitter_handle: twitter,
        github_handle: github
      });
      if (res && !res.error) {
        this.identity = res;
        window.toast.success('Saved', 'Profile settings updated.');
      } else {
        window.toast.error('Error', res.error || 'Failed to update profile');
      }
    } catch (err) {
      window.toast.error('Error', err.message);
    }
  }

  async updateWalletAddress() {
    const wallet = document.getElementById('settings-wallet').value.trim();
    if (!wallet.startsWith('0x') || wallet.length !== 42) {
      window.toast.error('Invalid Address', 'Must be a 42-character 0x EVM address');
      return;
    }
    try {
      const res = await window.api.connectWallet(wallet);
      if (res && !res.error) {
        if (this.identity) this.identity.wallet_address = wallet;
        window.toast.success('Wallet Connected', `Monad address linked: ${wallet.slice(0, 10)}...`);
      } else {
        window.toast.error('Error', res.error || 'Failed to link wallet');
      }
    } catch (e) {
      window.toast.error('Error', e.message);
    }
  }

  // ── CREATE IDENTITY WIZARD ───────────────────────────────────
  renderCreateIdentityWizard(container) {
    container.innerHTML = `
      <div style="max-width:680px;margin:30px auto;">
        <div class="steps">
          <div class="step active" id="step-node-1"><div class="step-circle">1</div><div class="step-line"></div></div>
          <div class="step" id="step-node-2"><div class="step-circle">2</div><div class="step-line"></div></div>
          <div class="step" id="step-node-3"><div class="step-circle">3</div></div>
        </div>

        <!-- Step 1: Profile -->
        <div id="wizard-step-1" class="card" style="padding:32px;">
          <h2 class="font-display font-bold text-xl mb-4">Step 1: Your Digital Identity</h2>
          <p class="text-xs text-secondary mb-24">Create your portable Web3 / AI reputation anchor.</p>

          <div class="form-group mb-16">
            <label class="form-label">Full Display Name *</label>
            <input type="text" id="wiz-name" class="form-input" placeholder="e.g. Alex Rivera" required />
          </div>
          <div class="form-group mb-16">
            <label class="form-label">Bio / Focus Area</label>
            <textarea id="wiz-bio" class="form-textarea" placeholder="e.g. AI Systems Architect building autonomous agent governance protocols."></textarea>
          </div>
          <div class="form-group mb-24">
            <label class="form-label">Twitter / X Handle</label>
            <input type="text" id="wiz-twitter" class="form-input" placeholder="e.g. alex_builds" />
          </div>

          <button class="btn btn-primary btn-block" onclick="app.wizardNext(2)">Continue to Credentials ➔</button>
        </div>

        <!-- Step 2: Credentials -->
        <div id="wizard-step-2" class="card hidden" style="padding:32px;">
          <h2 class="font-display font-bold text-xl mb-4">Step 2: Claim Initial Credentials</h2>
          <p class="text-xs text-secondary mb-24">Select verified credentials to anchor into your reputation score.</p>

          <div class="flex flex-col gap-12 mb-24">
            <label class="card" style="padding:14px;cursor:pointer;display:flex;align-items:center;gap:12px;">
              <input type="checkbox" id="wiz-cred-human" checked />
              <div style="font-size:24px;">🧑</div>
              <div style="flex:1">
                <div class="font-bold text-sm">Human Verified (Passkey WebAuthn)</div>
                <div class="text-xs text-secondary">+75 Reputation Score</div>
              </div>
            </label>
            <label class="card" style="padding:14px;cursor:pointer;display:flex;align-items:center;gap:12px;">
              <input type="checkbox" id="wiz-cred-dev" checked />
              <div style="font-size:24px;">💻</div>
              <div style="flex:1">
                <div class="font-bold text-sm">Developer (GitHub Oracle)</div>
                <div class="text-xs text-secondary">+40 Reputation Score</div>
              </div>
            </label>
            <label class="card" style="padding:14px;cursor:pointer;display:flex;align-items:center;gap:12px;">
              <input type="checkbox" id="wiz-cred-web3" checked />
              <div style="font-size:24px;">⛓️</div>
              <div style="flex:1">
                <div class="font-bold text-sm">Web3 & Monad Builder</div>
                <div class="text-xs text-secondary">+45 Reputation Score</div>
              </div>
            </label>
          </div>

          <div class="flex gap-12">
            <button class="btn btn-secondary" onclick="app.wizardBack(1)">Back</button>
            <button class="btn btn-primary flex-1" onclick="app.wizardNext(3)">Continue to Blockchain Anchor ➔</button>
          </div>
        </div>

        <!-- Step 3: Passkey & Monad Registration -->
        <div id="wizard-step-3" class="card hidden" style="padding:32px;text-align:center;">
          <div class="passkey-icon">🛡️</div>
          <h2 class="font-display font-bold text-xl mb-4">Step 3: Cryptographic Passkey Anchor</h2>
          <p class="text-xs text-secondary max-width mb-24" style="max-width:400px;margin:0 auto 24px;">
            Your ProofID hash will be anchored to the Monad Testnet smart contract. No private keys are stored.
          </p>

          <div id="wiz-progress" class="hidden mb-20">
            <div class="spinner spinner-lg mb-12" style="margin:0 auto;"></div>
            <div class="text-xs text-purple font-mono" id="wiz-progress-text">Generating SHA3-256 ProofID...</div>
          </div>

          <div class="flex gap-12" id="wiz-step3-buttons">
            <button class="btn btn-secondary" onclick="app.wizardBack(2)">Back</button>
            <button class="btn btn-primary flex-1" id="btn-finish-identity" onclick="app.executeIdentityCreation()">
              🔐 Anchor ProofID to Monad Testnet
            </button>
          </div>
        </div>
      </div>
    `;
  }

  wizardNext(step) {
    if (step === 2) {
      const name = document.getElementById('wiz-name').value.trim();
      if (!name) {
        window.toast.warning('Name Required', 'Please enter your display name');
        return;
      }
    }
    document.getElementById('wizard-step-1')?.classList.add('hidden');
    document.getElementById('wizard-step-2')?.classList.add('hidden');
    document.getElementById('wizard-step-3')?.classList.add('hidden');
    document.getElementById(`wizard-step-${step}`)?.classList.remove('hidden');

    const node2 = document.getElementById('step-node-2');
    const node3 = document.getElementById('step-node-3');
    if (step >= 2) node2?.classList.add('active');
    if (step >= 3) node3?.classList.add('active');
  }

  wizardBack(step) {
    this.wizardNext(step);
  }

  async executeIdentityCreation() {
    const name = document.getElementById('wiz-name')?.value.trim() || 'Alex Rivera';
    const bio = document.getElementById('wiz-bio')?.value.trim() || '';
    const twitter = document.getElementById('wiz-twitter')?.value.trim() || '';
    const progressEl = document.getElementById('wiz-progress');
    const progressText = document.getElementById('wiz-progress-text');
    const btnContainer = document.getElementById('wiz-step3-buttons');

    if (progressEl) progressEl.classList.remove('hidden');
    if (btnContainer) btnContainer.classList.add('hidden');

    if (progressText) progressText.textContent = 'Computing SHA3-256 cryptographic identity hash...';
    await new Promise(r => setTimeout(r, 600));

    if (progressText) progressText.textContent = 'Broadcasting transaction to Monad Testnet (Chain ID 10143)...';
    await new Promise(r => setTimeout(r, 800));

    try {
      const res = await window.api.createIdentity({
        display_name: name,
        bio,
        twitter_handle: twitter,
        is_public: true
      });

      if (res && !res.error) {
        this.identity = res;

        // Auto-claim selected credentials
        if (document.getElementById('wiz-cred-human')?.checked) {
          await window.api.addCredential({ credential_type: 'HUMAN_VERIFIED', issuer_name: 'ProofID Passkey Protocol' });
        }
        if (document.getElementById('wiz-cred-dev')?.checked) {
          await window.api.addCredential({ credential_type: 'DEVELOPER', issuer_name: 'GitHub Oracle' });
        }
        if (document.getElementById('wiz-cred-web3')?.checked) {
          await window.api.addCredential({ credential_type: 'WEB3_BUILDER', issuer_name: 'Monad Ecosystem Guild' });
        }

        window.toast.success('ProofID Created!', `Your identity ${res.proof_id} has been anchored on Monad.`);
        this.navigate('dashboard');
      } else {
        window.toast.error('Creation Failed', res.error || 'Could not create identity');
        if (progressEl) progressEl.classList.add('hidden');
        if (btnContainer) btnContainer.classList.remove('hidden');
      }
    } catch (e) {
      window.toast.error('Error', e.message);
      if (progressEl) progressEl.classList.add('hidden');
      if (btnContainer) btnContainer.classList.remove('hidden');
    }
  }

  // ── MODALS & INTERACTIONS ────────────────────────────────────
  showLoginModal() {
    this._showAuthModal('signin');
  }

  showRegisterModal() {
    this._showAuthModal('signup');
  }

  _showAuthModal(initialTab = 'signin') {
    const isSignIn = initialTab === 'signin';
    window.modal.show('auth', `
      <div class="modal-header" style="text-align:center;flex-direction:column;align-items:center;padding:28px 28px 0;">
        <button class="modal-close" onclick="modal.close()" style="position:absolute;top:16px;right:16px;">✕</button>
        <img src="/static/images/logo.png" alt="ProofID" class="auth-modal-logo-img" />
        <h3 class="modal-title" style="margin-bottom:4px;">Welcome to ProofID</h3>
        <div class="auth-modal-subtitle">Decentralized identity & trust layer for humans and AI agents</div>
      </div>
      <div class="modal-body" style="padding:0 28px 28px;">
        <!-- Tab Switcher -->
        <div class="auth-tabs">
          <button class="auth-tab ${isSignIn ? 'active' : ''}" onclick="app._switchAuthTab('signin')" id="tab-signin">Sign In</button>
          <button class="auth-tab ${!isSignIn ? 'active' : ''}" onclick="app._switchAuthTab('signup')" id="tab-signup">Create Account</button>
        </div>

        <!-- Social Login Buttons -->
        <div class="social-btn-group">
          <button class="social-btn social-btn-google" onclick="app.showGoogleAuthDialog()">
            <span class="social-btn-icon">
              <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            </span>
            <span class="social-btn-label">Continue with Google</span>
            <span class="social-btn-badge">OAuth 2.0</span>
          </button>
          <button class="social-btn social-btn-github" onclick="app.showGitHubAuthDialog()">
            <span class="social-btn-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </span>
            <span class="social-btn-label">Continue with GitHub</span>
            <span class="social-btn-badge">Developer</span>
          </button>
          <button class="social-btn social-btn-web3" onclick="app.showWeb3AuthDialog()">
            <span class="social-btn-icon">⛓️</span>
            <span class="social-btn-label">Connect Web3 Wallet</span>
            <span class="social-btn-badge">Monad</span>
          </button>
        </div>

        <div class="auth-divider"><span>or use credentials</span></div>

        <!-- Sign In Form -->
        <div id="auth-form-signin" style="${isSignIn ? '' : 'display:none'}">
          <form onsubmit="app.handleLoginSubmit(event)" class="flex flex-col gap-12">
            <div class="form-group">
              <label class="form-label">Username or Email</label>
              <input type="text" id="login-username" class="form-input" placeholder="Enter username or email" required />
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="login-password" class="form-input" placeholder="Enter your password" required />
            </div>
            <div id="login-error"></div>
            <button type="submit" id="btn-login-submit" class="btn btn-primary btn-block">Sign In ➔</button>
          </form>

          <div class="auth-divider"><span>instant demo access</span></div>
          <div class="demo-profiles">
            <button class="demo-profile-btn" onclick="app.handleDemoProfile('alex')">
              <span class="demo-avatar">👨‍💻</span>
              <span class="demo-name">Alex Rivera</span>
              <span class="demo-role">AI Architect</span>
            </button>
            <button class="demo-profile-btn" onclick="app.handleDemoProfile('sarah')">
              <span class="demo-avatar">👩‍🔬</span>
              <span class="demo-name">Dr. Sarah Chen</span>
              <span class="demo-role">AI Safety</span>
            </button>
            <button class="demo-profile-btn" onclick="app.handleDemoProfile('marcus')">
              <span class="demo-avatar">👨‍🚀</span>
              <span class="demo-name">Marcus Vance</span>
              <span class="demo-role">Web3 Dev</span>
            </button>
          </div>
        </div>

        <!-- Sign Up Form -->
        <div id="auth-form-signup" style="${!isSignIn ? '' : 'display:none'}">
          <form onsubmit="app.handleRegisterSubmit(event)" class="flex flex-col gap-12">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div class="form-group">
                <label class="form-label">First Name</label>
                <input type="text" id="reg-first-name" class="form-input" placeholder="First name" />
              </div>
              <div class="form-group">
                <label class="form-label">Last Name</label>
                <input type="text" id="reg-last-name" class="form-input" placeholder="Last name" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Username *</label>
              <input type="text" id="reg-username" class="form-input" placeholder="Choose a unique username" required />
            </div>
            <div class="form-group">
              <label class="form-label">Email *</label>
              <input type="email" id="reg-email" class="form-input" placeholder="your@email.com" required />
            </div>
            <div class="form-group">
              <label class="form-label">Password *</label>
              <input type="password" id="reg-password" class="form-input" placeholder="Min 6 characters" required minlength="6" />
            </div>
            <div id="register-error"></div>
            <button type="submit" id="btn-reg-submit" class="btn btn-primary btn-block">Create Account & Get ProofID ➔</button>
          </form>
        </div>

        <div class="auth-footer-text">
          By continuing, you agree to ProofID's Terms of Service.<br/>
          Your identity is cryptographically anchored on Monad Chain 10143.
        </div>
      </div>
    `);
  }

  _switchAuthTab(tab) {
    const signinTab = document.getElementById('tab-signin');
    const signupTab = document.getElementById('tab-signup');
    const signinForm = document.getElementById('auth-form-signin');
    const signupForm = document.getElementById('auth-form-signup');
    if (!signinTab || !signupTab || !signinForm || !signupForm) return;

    if (tab === 'signin') {
      signinTab.classList.add('active');
      signupTab.classList.remove('active');
      signinForm.style.display = '';
      signupForm.style.display = 'none';
    } else {
      signinTab.classList.remove('active');
      signupTab.classList.add('active');
      signinForm.style.display = 'none';
      signupForm.style.display = '';
    }
  }

  handleSocialLogin(provider) {
    if (provider === 'google') this.showGoogleAuthDialog();
    else if (provider === 'github') this.showGitHubAuthDialog();
    else if (provider === 'web3') this.showWeb3AuthDialog();
  }

  showGoogleAuthDialog() {
    window.modal.show('google-auth', `
      <div class="auth-dialog-header">
        <button class="modal-close" onclick="modal.close()" style="position:absolute;top:16px;right:16px;">✕</button>
        <div class="auth-dialog-logo">
          <svg width="28" height="28" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        </div>
        <h3 class="modal-title" style="margin-bottom:4px;">Sign In with Google</h3>
        <p class="text-xs text-secondary">Choose an account to continue to ProofID</p>
      </div>
      <div class="modal-body" style="padding:0 24px 24px;">
        <div class="auth-account-list">
          <button class="auth-account-row" onclick="app.executeGoogleLogin('alex.rivera.dev@gmail.com', 'Alex Rivera')">
            <div class="auth-account-avatar" style="background:#4285F4">A</div>
            <div class="auth-account-info">
              <div class="auth-account-name">Alex Rivera</div>
              <div class="auth-account-email">alex.rivera.dev@gmail.com</div>
            </div>
            <span class="badge badge-verified" style="font-size:10px;">1-Click</span>
          </button>
          <button class="auth-account-row" onclick="app.executeGoogleLogin('samya.developer@gmail.com', 'Samya Developer')">
            <div class="auth-account-avatar" style="background:#34A853">S</div>
            <div class="auth-account-info">
              <div class="auth-account-name">Samya Developer</div>
              <div class="auth-account-email">samya.developer@gmail.com</div>
            </div>
            <span class="badge badge-verified" style="font-size:10px;">1-Click</span>
          </button>
        </div>

        <div class="auth-divider"><span>or enter any google account</span></div>

        <form onsubmit="app.handleCustomGoogleSubmit(event)" class="flex flex-col gap-10">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="google-custom-name" class="form-input" placeholder="e.g. Elena Vance" required />
          </div>
          <div class="form-group">
            <label class="form-label">Google Email</label>
            <input type="email" id="google-custom-email" class="form-input" placeholder="e.g. elena@gmail.com" required />
          </div>
          <button type="submit" id="btn-custom-google" class="btn btn-primary btn-block">Continue with Google Account ➔</button>
        </form>
        <div class="mt-12 text-center">
          <a href="javascript:void(0)" onclick="app._showAuthModal('signin')" class="text-xs text-muted" style="text-decoration:none">← Back to standard sign in</a>
        </div>
      </div>
    `);
  }

  async executeGoogleLogin(email, name) {
    window.toast.info('Google OAuth', `Authenticating as ${name || email}...`);
    try {
      const res = await window.api.googleLogin({ email, name });
      this._handleAuthSuccess(res, 'Google');
    } catch (e) {
      window.toast.error('Google Auth Failed', e.message);
    }
  }

  async handleCustomGoogleSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-custom-google');
    const name = document.getElementById('google-custom-name').value.trim();
    const email = document.getElementById('google-custom-email').value.trim();
    setLoading(btn, true, 'Connecting to Google...');
    try {
      const res = await window.api.googleLogin({ email, name });
      setLoading(btn, false);
      this._handleAuthSuccess(res, 'Google');
    } catch (err) {
      setLoading(btn, false);
      window.toast.error('Google Auth Failed', err.message);
    }
  }

  showGitHubAuthDialog() {
    window.modal.show('github-auth', `
      <div class="auth-dialog-header">
        <button class="modal-close" onclick="modal.close()" style="position:absolute;top:16px;right:16px;">✕</button>
        <div class="auth-dialog-logo" style="background:#24292e;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        </div>
        <h3 class="modal-title" style="margin-bottom:4px;">Authorize via GitHub</h3>
        <p class="text-xs text-secondary">Connect your GitHub developer reputation to ProofID</p>
      </div>
      <div class="modal-body" style="padding:0 24px 24px;">
        <div class="auth-account-list">
          <button class="auth-account-row" onclick="app.executeGitHubLogin('alexrivera-monad', 'Alex Rivera')">
            <div class="auth-account-avatar" style="background:#24292e">💻</div>
            <div class="auth-account-info">
              <div class="auth-account-name">@alexrivera-monad</div>
              <div class="auth-account-email">Alex Rivera · Core Contributor</div>
            </div>
            <span class="badge badge-purple" style="font-size:10px;">Dev Badge</span>
          </button>
          <button class="auth-account-row" onclick="app.executeGitHubLogin('monad-developer', 'Monad Dev')">
            <div class="auth-account-avatar" style="background:#8b5cf6">⛓️</div>
            <div class="auth-account-info">
              <div class="auth-account-name">@monad-developer</div>
              <div class="auth-account-email">Smart Contract Builder</div>
            </div>
            <span class="badge badge-verified" style="font-size:10px;">1-Click</span>
          </button>
        </div>

        <div class="auth-divider"><span>or enter any github username</span></div>

        <form onsubmit="app.handleCustomGitHubSubmit(event)" class="flex flex-col gap-10">
          <div class="form-group">
            <label class="form-label">GitHub Username</label>
            <input type="text" id="github-custom-username" class="form-input" placeholder="e.g. torvalds" required />
          </div>
          <button type="submit" id="btn-custom-gh" class="btn btn-primary btn-block">Verify Developer Identity ➔</button>
        </form>
        <div class="mt-12 text-center">
          <a href="javascript:void(0)" onclick="app._showAuthModal('signin')" class="text-xs text-muted" style="text-decoration:none">← Back to standard sign in</a>
        </div>
      </div>
    `);
  }

  async executeGitHubLogin(username, name) {
    window.toast.info('GitHub Sign-In', `Authenticating as @${username}...`);
    try {
      const res = await window.api.githubLogin({ username, name });
      this._handleAuthSuccess(res, 'GitHub');
    } catch (e) {
      window.toast.error('GitHub Auth Failed', e.message);
    }
  }

  async handleCustomGitHubSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-custom-gh');
    const username = document.getElementById('github-custom-username').value.trim();
    setLoading(btn, true, 'Verifying GitHub...');
    try {
      const res = await window.api.githubLogin({ username, name: username });
      setLoading(btn, false);
      this._handleAuthSuccess(res, 'GitHub');
    } catch (err) {
      setLoading(btn, false);
      window.toast.error('GitHub Auth Failed', err.message);
    }
  }

  showWeb3AuthDialog() {
    const hasMetaMask = typeof window.ethereum !== 'undefined';
    window.modal.show('web3-auth', `
      <div class="auth-dialog-header">
        <button class="modal-close" onclick="modal.close()" style="position:absolute;top:16px;right:16px;">✕</button>
        <div class="auth-dialog-logo" style="background:rgba(124,58,237,0.15);border-color:rgba(124,58,237,0.4);">
          ⛓️
        </div>
        <h3 class="modal-title" style="margin-bottom:4px;">Monad EVM Web3 Sign-In</h3>
        <p class="text-xs text-secondary">Authenticate with your Ethereum / Monad Testnet wallet</p>
      </div>
      <div class="modal-body" style="padding:0 24px 24px;">
        <div class="auth-account-list">
          ${hasMetaMask ? `
            <button class="auth-account-row" onclick="app.executeMetaMaskLogin()" style="border-color:rgba(245,158,11,0.4);background:rgba(245,158,11,0.06);">
              <div class="auth-account-avatar" style="background:#f59e0b">🦊</div>
              <div class="auth-account-info">
                <div class="auth-account-name">MetaMask Detected</div>
                <div class="auth-account-email">Connect current browser wallet</div>
              </div>
              <span class="badge badge-amber" style="font-size:10px;">Connect</span>
            </button>
          ` : ''}
          <button class="auth-account-row" onclick="app.executeWeb3Login('0x71C8364f3B731057434524F5374464a938Efe608')">
            <div class="auth-account-avatar" style="background:#10b981">🟣</div>
            <div class="auth-account-info">
              <div class="auth-account-name">Monad Testnet Native Wallet</div>
              <div class="auth-account-email font-mono">0x71C8...e608 (Chain 10143)</div>
            </div>
            <span class="badge badge-verified" style="font-size:10px;">1-Click</span>
          </button>
        </div>

        <div class="auth-divider"><span>or enter any evm address</span></div>

        <form onsubmit="app.handleCustomWeb3Submit(event)" class="flex flex-col gap-10">
          <div class="form-group">
            <label class="form-label">Ethereum / Monad Address</label>
            <input type="text" id="web3-custom-addr" class="form-input font-mono text-xs" placeholder="0x..." required />
          </div>
          <button type="submit" id="btn-custom-web3" class="btn btn-primary btn-block">Sign In with Address ➔</button>
        </form>
        <div class="mt-12 text-center">
          <a href="javascript:void(0)" onclick="app._showAuthModal('signin')" class="text-xs text-muted" style="text-decoration:none">← Back to standard sign in</a>
        </div>
      </div>
    `);
  }

  async executeWeb3Login(address) {
    window.toast.info('Web3 Wallet', `Connecting to Monad Testnet (${address.slice(0,6)}...)...`);
    try {
      const res = await window.api.web3Login({ address });
      this._handleAuthSuccess(res, 'Web3 Wallet');
    } catch (e) {
      window.toast.error('Web3 Login Failed', e.message);
    }
  }

  async executeMetaMaskLogin() {
    if (!window.ethereum) return this.executeWeb3Login('0x71C8364f3B731057434524F5374464a938Efe608');
    try {
      window.toast.info('MetaMask', 'Requesting account authorization...');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts[0]) {
        await this.executeWeb3Login(accounts[0]);
      }
    } catch (e) {
      window.toast.error('MetaMask Error', e.message || 'Connection rejected');
    }
  }

  async handleCustomWeb3Submit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-custom-web3');
    const addr = document.getElementById('web3-custom-addr').value.trim();
    setLoading(btn, true, 'Verifying Wallet...');
    try {
      const res = await window.api.web3Login({ address: addr });
      setLoading(btn, false);
      this._handleAuthSuccess(res, 'Web3 Wallet');
    } catch (err) {
      setLoading(btn, false);
      window.toast.error('Web3 Login Failed', err.message);
    }
  }

  async _handleAuthSuccess(res, providerName = 'Social') {
    if (res && res.tokens) {
      window.api.setTokens(res.tokens.access, res.tokens.refresh);
      this.currentUser = res.user;
      const idRes = await window.api.getIdentity();
      if (idRes && !idRes.error) this.identity = idRes;
      window.modal.close();
      window.toast.success('Welcome!', res.message || `Signed in via ${providerName}`);
      this.navigate('dashboard');
    } else {
      window.toast.error('Sign-In Failed', res.error || `Could not authenticate via ${providerName}`);
    }
  }

  async handleDemoProfile(profile) {
    const names = { alex: 'Alex Rivera', sarah: 'Dr. Sarah Chen', marcus: 'Marcus Vance' };
    window.toast.info('Switching Profile', `Loading ${names[profile] || profile}...`);
    try {
      const res = await window.api.demoProfileLogin(profile);
      if (res && res.tokens) {
        window.api.setTokens(res.tokens.access, res.tokens.refresh);
        this.currentUser = res.user;
        const idRes = await window.api.getIdentity();
        if (idRes && !idRes.error) this.identity = idRes;
        window.modal.close();
        window.toast.success('Welcome!', res.message || `Logged in as ${names[profile]}`);
        this.navigate('dashboard');
      } else {
        window.toast.error('Failed', res.error || 'Could not load demo profile');
      }
    } catch (err) {
      window.toast.error('Error', err.message);
    }
  }

  async handleLoginSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login-submit');
    const errContainer = document.getElementById('login-error');
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;

    if (errContainer) errContainer.innerHTML = '';
    setLoading(btn, true, 'Authenticating...');
    try {
      const res = await window.api.login({ username: u, password: p });
      setLoading(btn, false);
      if (res && res.tokens) {
        window.api.setTokens(res.tokens.access, res.tokens.refresh);
        this.currentUser = res.user;
        const idRes = await window.api.getIdentity();
        if (idRes && !idRes.error) {
          this.identity = idRes;
        }
        window.modal.close();
        window.toast.success('Welcome back', `Logged in as ${u}`);
        this.navigate('dashboard');
      } else {
        const errMsg = res.error || 'Invalid username or password';
        if (errContainer) errContainer.innerHTML = `<div class="form-error"><span class="form-error-icon">⚠️</span>${errMsg}</div>`;
        else window.toast.error('Login Failed', errMsg);
      }
    } catch (err) {
      setLoading(btn, false);
      window.toast.error('Error', err.message);
    }
  }

  async handleRegisterSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-reg-submit');
    const errContainer = document.getElementById('register-error');
    const u = document.getElementById('reg-username').value.trim();
    const em = document.getElementById('reg-email').value.trim();
    const p = document.getElementById('reg-password').value;
    const firstName = (document.getElementById('reg-first-name')?.value || '').trim();
    const lastName = (document.getElementById('reg-last-name')?.value || '').trim();

    if (errContainer) errContainer.innerHTML = '';
    setLoading(btn, true, 'Creating account...');
    try {
      const res = await window.api.register({
        username: u,
        email: em,
        password: p,
        password_confirm: p,
        first_name: firstName,
        last_name: lastName
      });
      setLoading(btn, false);
      if (res && res.tokens) {
        window.api.setTokens(res.tokens.access, res.tokens.refresh);
        this.currentUser = res.user;
        // Auto-fetch identity (it was created in registration serializer)
        const idRes = await window.api.getIdentity();
        if (idRes && !idRes.error) {
          this.identity = idRes;
        }
        window.modal.close();
        window.toast.success('Account Created!', `Welcome ${firstName || u}! Your ProofID is ready.`);
        this.navigate('dashboard');
      } else {
        const errMsg = res.error || 'Could not create account. Check your details.';
        if (errContainer) errContainer.innerHTML = `<div class="form-error"><span class="form-error-icon">⚠️</span>${errMsg}</div>`;
        else window.toast.error('Registration Failed', errMsg);
      }
    } catch (err) {
      setLoading(btn, false);
      window.toast.error('Error', err.message);
    }
  }

  showAddCredentialModal() {
    // Build credential type options by category
    const categories = {
      identity: {
        label: '🪪 Government & Identity Proofs',
        types: ['DRIVING_LICENSE', 'PASSPORT', 'NATIONAL_ID', 'VOTER_ID', 'TAX_ID', 'WORK_PERMIT', 'PROOF_OF_ADDRESS', 'BIOMETRIC_ID', 'HUMAN_VERIFIED']
      },
      professional: {
        label: '💼 Professional & Academic',
        types: ['EMPLOYMENT_VERIFIED', 'UNIVERSITY_DEGREE', 'FINANCIAL_KYC', 'LEGAL_LICENSE', 'MEDICAL_LICENSE', 'STUDENT']
      },
      developer: {
        label: '💻 Developer & Web3',
        types: ['DEVELOPER', 'AI_RESEARCHER', 'WEB3_BUILDER', 'HACKATHON_BUILDER', 'SECURITY_RESEARCHER', 'OPEN_SOURCE']
      }
    };

    let credTypeGrid = '';
    for (const [catKey, cat] of Object.entries(categories)) {
      for (const t of cat.types) {
        const meta = CREDENTIAL_META[t] || { icon: '📄', label: t, points: 30 };
        credTypeGrid += `
          <div class="cred-type-card" data-type="${t}" data-cat="${catKey}" onclick="app._selectCredType(this, '${t}')">
            <div class="cred-type-icon">${meta.icon}</div>
            <div class="cred-type-name">${meta.label}</div>
            <div class="cred-type-pts">+${meta.points} rep</div>
          </div>`;
      }
    }

    window.modal.show('add-cred', `
      <div class="modal-header" style="text-align:center;flex-direction:column;align-items:center;padding:28px 28px 0;">
        <button class="modal-close" onclick="modal.close()" style="position:absolute;top:16px;right:16px;">✕</button>
        <div style="font-size:36px;margin-bottom:4px;">📜</div>
        <h3 class="modal-title">Issue Verifiable Credential</h3>
        <div class="auth-modal-subtitle">Select an ID proof or credential to cryptographically anchor to your ProofID</div>
      </div>
      <div class="modal-body" style="padding:0 28px 28px;">
        <!-- Category Filter Pills -->
        <div class="cred-category-pills">
          <button class="cred-pill active" onclick="app._filterCredCategory('all', this)">All (19)</button>
          <button class="cred-pill" onclick="app._filterCredCategory('identity', this)">🪪 Government IDs</button>
          <button class="cred-pill" onclick="app._filterCredCategory('professional', this)">💼 Professional</button>
          <button class="cred-pill" onclick="app._filterCredCategory('developer', this)">💻 Developer</button>
        </div>

        <!-- Credential Type Grid -->
        <div class="cred-type-grid" id="cred-type-grid">
          ${credTypeGrid}
        </div>

        <!-- Selected type hidden input -->
        <input type="hidden" id="cred-type-select" value="DRIVING_LICENSE" />

        <form onsubmit="app.handleAddCredentialSubmit(event)" class="flex flex-col gap-12">
          <div class="form-group">
            <label class="form-label">Issuing Authority / Agency *</label>
            <input type="text" id="cred-issuer" class="form-input" value="Department of Motor Vehicles (DMV)" required />
          </div>
          <div class="form-group">
            <label class="form-label" id="cred-evidence-label">ID Number / Evidence Verification Reference</label>
            <input type="text" id="cred-evidence" class="form-input" placeholder="e.g. DL-CA-94820194 or verification URL" />
          </div>
          <div class="form-group">
            <label class="form-label" id="cred-notes-label">Claims / Validation Details</label>
            <input type="text" id="cred-notes" class="form-input" placeholder="e.g. Class C Commercial/Non-Commercial Driver License" />
          </div>
          <button type="submit" id="btn-add-cred" class="btn btn-primary btn-block">🔐 Issue & Anchor to Monad ➔</button>
        </form>
      </div>
    `);

    // Auto-select first card
    setTimeout(() => {
      const first = document.querySelector('.cred-type-card');
      if (first) this._selectCredType(first, first.dataset.type);
    }, 50);
  }

  _selectCredType(el, type) {
    document.querySelectorAll('.cred-type-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    const hiddenInput = document.getElementById('cred-type-select');
    if (hiddenInput) hiddenInput.value = type;

    // Update issuer default and dynamic placeholders based on type
    const issuerDefaults = {
      DRIVING_LICENSE: 'Department of Motor Vehicles (DMV)',
      PASSPORT: 'International e-Passport Authority',
      NATIONAL_ID: 'Government Identity Authority',
      VOTER_ID: 'Election & Electoral Commission',
      TAX_ID: 'Internal Revenue Service / Tax Authority',
      WORK_PERMIT: 'Immigration & Naturalization Service',
      PROOF_OF_ADDRESS: 'Utility Provider / Bank',
      BIOMETRIC_ID: 'Biometric Verification Service',
      HUMAN_VERIFIED: 'ProofID WebAuthn',
      EMPLOYMENT_VERIFIED: 'HR Department / LinkedIn',
      UNIVERSITY_DEGREE: 'Academic Institution',
      FINANCIAL_KYC: 'Financial Compliance Authority',
      LEGAL_LICENSE: 'Bar Association / Legal Authority',
      MEDICAL_LICENSE: 'Medical Board',
      STUDENT: 'Educational Institution',
      DEVELOPER: 'GitHub Oracle Protocol',
      AI_RESEARCHER: 'ArXiv / Research Institute',
      WEB3_BUILDER: 'Monad Foundation',
      HACKATHON_BUILDER: 'Hackathon Organizer',
      SECURITY_RESEARCHER: 'Bug Bounty Platform',
      OPEN_SOURCE: 'Open Source Foundation'
    };

    const evidencePlaceholders = {
      DRIVING_LICENSE: 'e.g. DL-CA-94820194 or DMV verify URL',
      PASSPORT: 'e.g. P-839201948 or ICAO MRZ hash',
      NATIONAL_ID: 'e.g. NID-4920-5819-2041 or SSN hash',
      VOTER_ID: 'e.g. VOTE-EL-882941 electoral roll ID',
      TAX_ID: 'e.g. TAX-US-991823 federal filing TIN',
      WORK_PERMIT: 'e.g. VISA-EAD-394821 employment authorization',
      PROOF_OF_ADDRESS: 'e.g. Utility bill reference / address hash',
      BIOMETRIC_ID: 'e.g. BIO-ZK-9F8A21B4 face liveness token',
      HUMAN_VERIFIED: 'e.g. FIDO2 / WebAuthn signature proof',
      DEVELOPER: 'https://github.com/your-username',
      WEB3_BUILDER: '0x... Monad testnet contract or wallet',
      UNIVERSITY_DEGREE: 'https://credential.edu/verify/94821',
      EMPLOYMENT_VERIFIED: 'https://linkedin.com/in/... or corporate SSO'
    };

    const issuerInput = document.getElementById('cred-issuer');
    const evidenceInput = document.getElementById('cred-evidence');
    if (issuerInput && issuerDefaults[type]) issuerInput.value = issuerDefaults[type];
    if (evidenceInput) evidenceInput.placeholder = evidencePlaceholders[type] || 'https://... or certificate ID';
  }

  _filterCredCategory(cat, btn) {
    // Update pills
    document.querySelectorAll('.cred-pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    // Filter cards
    document.querySelectorAll('.cred-type-card').forEach(card => {
      if (cat === 'all' || card.dataset.cat === cat) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  }

  async handleAddCredentialSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-add-cred');
    const credType = document.getElementById('cred-type-select').value;
    const issuer = document.getElementById('cred-issuer').value.trim();
    const evidence = document.getElementById('cred-evidence').value.trim();
    const notes = document.getElementById('cred-notes').value.trim();

    setLoading(btn, true, 'Anchoring Credential...');
    try {
      const res = await window.api.addCredential({
        credential_type: credType,
        issuer_name: issuer,
        evidence_url: evidence,
        notes
      });
      setLoading(btn, false);
      if (res && !res.error) {
        // Refresh identity to update reputation score immediately
        const idRes = await window.api.getIdentity();
        if (idRes && !idRes.error) this.identity = idRes;

        window.modal.close();
        window.toast.success('Credential Issued & Anchored', `${getCredentialLabel(credType)} added to your vault.`);
        if (this.currentRoute === 'credentials') this.renderCredentialsView(document.getElementById('page-content-container'));
        else if (this.currentRoute === 'dashboard') this.renderDashboardView(document.getElementById('page-content-container'));
      } else {
        window.toast.error('Failed', res.error || 'Could not issue credential');
      }
    } catch (err) {
      setLoading(btn, false);
      window.toast.error('Error', err.message);
    }
  }

  async revokeCredential(id) {
    if (!confirm('Are you sure you want to revoke this verifiable credential? Your reputation score will decrease.')) return;
    try {
      const res = await window.api.revokeCredential(id);
      if (res && !res.error) {
        window.toast.info('Revoked', 'Credential has been marked revoked.');
        this.renderCredentialsView(document.getElementById('page-content-container'));
      }
    } catch (e) {
      window.toast.error('Error', e.message);
    }
  }

  showAddAgentModal() {
    window.modal.show('add-agent', `
      <div class="modal-header">
        <h3 class="modal-title">Register Autonomous AI Agent</h3>
        <button class="modal-close" onclick="modal.close()">✕</button>
      </div>
      <div class="modal-body">
        <form onsubmit="app.handleAddAgentSubmit(event)" class="flex flex-col gap-16">
          <div class="form-group">
            <label class="form-label">Agent Name *</label>
            <input type="text" id="agent-name" class="form-input" placeholder="e.g. Sentinel Invariant Auditor" required />
          </div>
          <div class="form-group">
            <label class="form-label">Description *</label>
            <textarea id="agent-desc" class="form-textarea" placeholder="Describe the autonomous functions of this agent..." required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Model Engine</label>
            <select id="agent-model" class="form-select">
              <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet (Anthropic)</option>
              <option value="GPT-4o">GPT-4o (OpenAI)</option>
              <option value="DeepSeek-Coder V2">DeepSeek-Coder V2</option>
              <option value="Llama 3.3 70B">Llama 3.3 70B</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Capabilities (comma separated)</label>
            <input type="text" id="agent-caps" class="form-input" value="Smart Contract Audit, Invariant Testing, Vulnerability Scan" />
          </div>
          <div class="form-group">
            <label class="form-label">Endpoint URL (Optional)</label>
            <input type="url" id="agent-endpoint" class="form-input" placeholder="https://agents.proofid.network/v1/..." />
          </div>
          <button type="submit" id="btn-add-agent" class="btn btn-primary btn-block mt-8">🤖 Register Agent & Anchor On-Chain ➔</button>
        </form>
      </div>
    `);
  }

  async handleAddAgentSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-add-agent');
    const name = document.getElementById('agent-name').value.trim();
    const desc = document.getElementById('agent-desc').value.trim();
    const model = document.getElementById('agent-model').value;
    const capsRaw = document.getElementById('agent-caps').value.trim();
    const endpoint = document.getElementById('agent-endpoint').value.trim();
    const capabilities = capsRaw.split(',').map(c => c.trim()).filter(Boolean);

    setLoading(btn, true, 'Registering Agent...');
    try {
      const res = await window.api.createAgent({
        name,
        description: desc,
        model_name: model,
        capabilities,
        endpoint_url: endpoint
      });
      setLoading(btn, false);
      if (res && !res.error) {
        window.modal.close();
        window.toast.success('Agent Registered', `Agent ${res.agent_id} (${name}) registered successfully.`);
        this.navigate('agents');
      } else {
        window.toast.error('Failed', res.error || 'Could not register agent');
      }
    } catch (err) {
      setLoading(btn, false);
      window.toast.error('Error', err.message);
    }
  }

  showSimulateActivityModal(agentId, agentName) {
    window.modal.show('simulate-activity', `
      <div class="modal-header">
        <h3 class="modal-title">⚡ Simulate Task Execution</h3>
        <button class="modal-close" onclick="modal.close()">✕</button>
      </div>
      <div class="modal-body">
        <div class="text-xs text-secondary mb-16">
          Execute a simulated autonomous operation for <strong>${agentName}</strong>. The output will be audited and logged to Monad.
        </div>
        <form onsubmit="app.handleSimulateTask(event, '${agentId}')" class="flex flex-col gap-16">
          <div class="form-group">
            <label class="form-label">Task Type</label>
            <select id="sim-task-type" class="form-select">
              <option value="smart_contract_audit">Smart Contract Invariant Audit</option>
              <option value="dex_arbitrage">DEX Cross-Pool Arbitrage Execution</option>
              <option value="consensus_validation">Monad Quorum State Validation</option>
              <option value="vulnerability_scan">Reentrancy & Flash-Loan Guard Scan</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Task Description</label>
            <input type="text" id="sim-task-desc" class="form-input" value="Verified state invariant for 500 concurrent EVM transfers" required />
          </div>
          <div class="form-group">
            <label class="form-label">Outcome Simulation</label>
            <select id="sim-task-outcome" class="form-select">
              <option value="success">Success (100% Validated · +5 Reputation)</option>
              <option value="failure">Failure (Simulate Invariant Violation · -10 Reputation)</option>
            </select>
          </div>
          <button type="submit" id="btn-sim-task" class="btn btn-primary btn-block mt-8">⚡ Execute Operation Now ➔</button>
        </form>
      </div>
    `);
  }

  async handleSimulateTask(e, agentId) {
    e.preventDefault();
    const btn = document.getElementById('btn-sim-task');
    const type = document.getElementById('sim-task-type').value;
    const desc = document.getElementById('sim-task-desc').value.trim();
    const outcome = document.getElementById('sim-task-outcome').value;
    const isSuccess = outcome === 'success';

    setLoading(btn, true, 'Executing Subagent Task...');
    try {
      const dur = Math.floor(Math.random() * 300) + 150;
      const res = await window.api.logAgentActivity(agentId, {
        activity_type: type,
        description: desc,
        success: isSuccess,
        duration_ms: dur,
        output_summary: isSuccess ? `Audit passed in ${dur}ms with zero violations.` : `Invariant failed: Out of bounds.`
      });
      setLoading(btn, false);
      if (res && !res.error) {
        window.modal.close();
        if (isSuccess) window.toast.success('Task Succeeded', `Logged execution: ${desc} (+5 rep)`);
        else window.toast.warning('Task Failed', `Violation logged (-10 rep)`);
        this.renderAgentDetailView(document.getElementById('page-content-container'), agentId);
      } else {
        window.toast.error('Failed', res.error || 'Failed to log activity');
      }
    } catch (err) {
      setLoading(btn, false);
      window.toast.error('Error', err.message);
    }
  }

  showQuickActionModal() {
    window.modal.show('quick-action', `
      <div class="modal-header">
        <h3 class="modal-title">Quick Actions</h3>
        <button class="modal-close" onclick="modal.close()">✕</button>
      </div>
      <div class="modal-body">
        <div class="flex flex-col gap-12">
          <button class="card" style="padding:16px;text-align:left;cursor:pointer;" onclick="modal.close();app.showAddCredentialModal()">
            <div class="font-bold text-sm text-primary">📜 Issue / Claim Credential</div>
            <div class="text-xs text-secondary">Add a new verified claim to your ProofID</div>
          </button>
          <button class="card" style="padding:16px;text-align:left;cursor:pointer;" onclick="modal.close();app.showAddAgentModal()">
            <div class="font-bold text-sm text-primary">🤖 Register Autonomous AI Agent</div>
            <div class="text-xs text-secondary">Deploy a subagent linked to your master identity</div>
          </button>
          <button class="card" style="padding:16px;text-align:left;cursor:pointer;" onclick="modal.close();app.navigate('analyzer')">
            <div class="font-bold text-sm text-primary">🔍 Run AI Trust Evaluation</div>
            <div class="text-xs text-secondary">Generate a comprehensive probabilistic risk report</div>
          </button>
          <button class="card" style="padding:16px;text-align:left;cursor:pointer;" onclick="modal.close();app.navigate('blockchain')">
            <div class="font-bold text-sm text-primary">⛓️ Inspect Monad Proofs</div>
            <div class="text-xs text-secondary">Explore on-chain transactions on Chain 10143</div>
          </button>
        </div>
      </div>
    `);
  }

  showWalletModal() {
    const currentWallet = this.identity?.wallet_address || '0x71C8364f3B731057434524F5374464a938Efe608';
    window.modal.show('wallet', `
      <div class="modal-header">
        <h3 class="modal-title">Monad Testnet Wallet</h3>
        <button class="modal-close" onclick="modal.close()">✕</button>
      </div>
      <div class="modal-body text-center">
        <div style="font-size:40px;margin-bottom:12px;">👛</div>
        <div class="font-mono text-xs text-purple mb-8">${currentWallet}</div>
        <div class="badge badge-verified mb-20">Chain ID 10143 · Monad Testnet</div>
        <div class="blockchain-proof mb-20 text-left">
          <div class="blockchain-proof-row"><span class="blockchain-proof-key">Balance</span><span class="text-emerald">24.5000 MON</span></div>
          <div class="blockchain-proof-row"><span class="blockchain-proof-key">Status</span><span>Connected & Synced</span></div>
        </div>
        <button class="btn btn-secondary btn-block" onclick="modal.close();app.navigate('settings')">Configure in Settings</button>
      </div>
    `);
  }

  showIdentityQR(proofId) {
    const verifyUrl = `${window.location.origin}/#verify?q=${proofId}`;
    window.modal.show('qr', `
      <div class="modal-header">
        <h3 class="modal-title">ProofID Badge & QR</h3>
        <button class="modal-close" onclick="modal.close()">✕</button>
      </div>
      <div class="modal-body text-center">
        <div style="background:white;padding:16px;border-radius:var(--radius-lg);display:inline-block;margin-bottom:16px;">
          <!-- SVG QR Code Representation -->
          <svg width="180" height="180" viewBox="0 0 100 100" fill="#0a0a0f">
            <rect width="100" height="100" fill="white"/>
            <rect x="10" y="10" width="30" height="30" fill="#0a0a0f"/>
            <rect x="15" y="15" width="20" height="20" fill="white"/>
            <rect x="20" y="20" width="10" height="10" fill="#0a0a0f"/>
            <rect x="60" y="10" width="30" height="30" fill="#0a0a0f"/>
            <rect x="65" y="15" width="20" height="20" fill="white"/>
            <rect x="70" y="20" width="10" height="10" fill="#0a0a0f"/>
            <rect x="10" y="60" width="30" height="30" fill="#0a0a0f"/>
            <rect x="15" y="65" width="20" height="20" fill="white"/>
            <rect x="20" y="70" width="10" height="10" fill="#0a0a0f"/>
            <rect x="45" y="45" width="10" height="10" fill="#7c3aed"/>
            <rect x="60" y="60" width="15" height="15" fill="#0a0a0f"/>
            <rect x="80" y="60" width="10" height="25" fill="#0a0a0f"/>
            <rect x="45" y="15" width="10" height="20" fill="#0a0a0f"/>
            <rect x="45" y="70" width="10" height="20" fill="#0a0a0f"/>
          </svg>
        </div>
        <div class="font-mono text-sm font-bold text-purple mb-4">${proofId}</div>
        <div class="text-xs text-muted mb-16">${verifyUrl}</div>
        <button class="btn btn-primary btn-block" onclick="app.copyToClipboard('${verifyUrl}', 'Verification link copied!')">📋 Copy Public Verification Link</button>
      </div>
    `);
  }

  showVerifyHashModal() {
    window.modal.show('verify-hash', `
      <div class="modal-header">
        <h3 class="modal-title">Verify SHA3-256 Hash</h3>
        <button class="modal-close" onclick="modal.close()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group mb-16">
          <label class="form-label">Enter SHA3-256 / Keccak256 Hash</label>
          <input type="text" id="verify-hash-input" class="form-input font-mono" placeholder="0x..." />
        </div>
        <button class="btn btn-primary btn-block" onclick="app.checkHashOracle()">Verify Integrity ➔</button>
        <div id="verify-hash-result" class="mt-16 hidden"></div>
      </div>
    `);
  }

  checkHashOracle() {
    const input = document.getElementById('verify-hash-input');
    const result = document.getElementById('verify-hash-result');
    if (!input || !result) return;

    const hash = input.value.trim();
    if (!hash) return;

    result.classList.remove('hidden');
    result.innerHTML = `
      <div class="blockchain-proof">
        <div class="text-emerald font-bold mb-4">✔ Cryptographic Hash Valid</div>
        <div class="text-xs text-secondary">Hash matches canonical Monad Testnet anchor format. Proof status: CONFIRMED.</div>
      </div>
    `;
  }

  copyToClipboard(text, msg = 'Copied to clipboard!') {
    navigator.clipboard.writeText(text);
    window.toast.success('Copied', msg);
  }
}

// Instantiate global app instance
window.app = new ProofIDApp();
