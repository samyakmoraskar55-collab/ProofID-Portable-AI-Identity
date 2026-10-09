# 🛡️ ProofID — Portable AI Identity

> **Portable Trust Layer for Humans & Autonomous AI Agents**  
> *Track: Trust, Identity & AI Infrastructure*  
> Built for the Monad EVM Ecosystem

---

## 🌟 Executive Summary

In an era where autonomous AI agents outnumber human software developers and synthetic media challenges digital trust, verifying **who** or **what** is behind a digital transaction has become the fundamental bottleneck of the internet.

**ProofID** is a decentralized, portable trust and identity protocol designed specifically for humans and autonomous AI agents. ProofID bridges WebAuthn biometrics, multi-chain wallets (Monad EVM), verifiable credentials, event-driven reputation scoring, and AI trust risk analysis into a unified, cryptographically verifiable profile.

---

## ✨ Key Features

### 👤 1. Verifiable Human & Developer Identity
- **Passkey / WebAuthn Ready:** Secure phishing-resistant biometric authentication.
- **One-Click Social & Web3 Onboarding:** Instant sign-in via Google, GitHub, or Monad EVM wallet.
- **Public & Private Proofs:** Public profile reveals cryptographic proofs and reputation without leaking sensitive PII.

### 🤖 2. Autonomous AI Agent Delegation & Identity
- **Sub-Agent Registration:** Humans can register autonomous AI agents (`AGT-XXXXX`), binding cryptographic ownership to their master ProofID.
- **Capability Scoping:** Define granular agent boundaries (code generation, trading, automated customer support, research).
- **Execution History & Verifiable Uptime:** Track agent task counts, success rates, and autonomous reputation.

### 📜 3. Verifiable Credentials & Zero-Knowledge Anchors
- **Multi-Category Credentials:**
  - *Government & Sovereign:* Passport, Driver's License, National ID, Voter ID, Tax ID.
  - *Developer & Ecosystem:* GitHub Developer, Monad Web3 Builder, Hackathon Builder, Open Source Contributor.
  - *Academic & Professional:* University Degree, AI Researcher Fellowship, Financial KYC.
- **Cryptographic Hashing:** Credentials generate SHA3-256 state hashes anchored directly to smart contracts.

### 📈 4. Transparent Event-Driven Reputation Engine (0–1000)
- Reputation is **not an arbitrary number**. Every score point is backed by an auditable audit event:
  - Identity verification: `+100 pts`
  - Monad wallet attestation: `+25 pts`
  - Verifiable credentials issued: `+30 to +85 pts` each
  - Autonomous AI agent successful execution: `+5 pts` per task
  - Credential revocation or flagged reports: `-20 to -150 pts`

### 🧠 5. AI-Powered Trust Analyzer
- Dual-engine architecture:
  - **Live LLM Integration:** Claude / Anthropic API for real-time natural language risk analysis.
  - **Deterministic Heuristic Engine:** Offline fallback computing risk levels, credential depth, historical velocity, and key trust recommendations.

### ⛓️ 6. Monad Parallel EVM Blockchain Registry
- Solidity smart contract (`ProofIDRegistry.sol`) deployed to Monad Testnet (Chain ID `10143`).
- Stores identity hashes, reputation updates, issued credential hashes, and agent registrations with sub-second finality.
- Interactive **Monad Blockchain Explorer** built right into the app to inspect live on-chain proofs and tx hashes.

### 🎭 7. Hackathon Demo Mode & Profile Switcher
- Designed for judges and evaluation with **zero friction**.
- Pre-seeded with rich, realistic profiles:
  - **Alex Rivera** (`demo` / `demo123`): Lead AI Systems Architect (Score: 840)
  - **Dr. Sarah Chen**: AI Safety & Alignment Researcher (Score: 780)
  - **Marcus Vance**: Monad Parallel EVM Core Dev (Score: 890)
- Clearly labeled **Demo Mode** badges ensure full transparency without misrepresenting simulated transactions as real mainnet gas.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (SPA / Vanilla)                        │
│   HTML5 · CSS3 Design System · Glassmorphism · Vanilla JS ES6 Modules  │
│   Dashboard · Identity · Credentials · Agents · Verify · Explorer      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ JSON REST APIs / Bearer JWT
┌────────────────────────────────────▼───────────────────────────────────┐
│                       DJANGO REST BACKEND (Python)                     │
│  Django 5 · DRF · SimpleJWT · SQLite/PostgreSQL-Ready Architecture      │
│  Models: Identity, Credential, AIAgent, ReputationEvent, Proof, Report │
│  Services: BlockchainService · TrustAnalyzerService · AuditLogger      │
└──────────────────────┬───────────────────────────┬─────────────────────┘
                       │                           │
┌──────────────────────▼───────┐   ┌───────────────▼─────────────────────┐
│    MONAD TESTNET (Solidity)  │   │        AI TRUST ANALYZER            │
│  ProofIDRegistry.sol         │   │  Claude / Anthropic API             │
│  Chain ID: 10143             │   │  Deterministic Risk Engine          │
│  Parallel EVM Sub-Second TXs │   │  Anomaly Detection & Audits         │
└──────────────────────────────┘   └─────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & npm
- Git

---

### Step 1: Clone & Configure Environment

```bash
git clone https://github.com/samyakmoraskar55-collab/ProofID-Portable-AI-Identity.git
cd ProofID-Portable-AI-Identity

# Copy example environment configuration
cp .env.example .env
```

The default `.env` is pre-configured for instant local development with `DEMO_MODE=True`.

---

### Step 2: Backend Setup (Django & DRF)

```bash
# Navigate to backend directory
cd proofid_backend

# (Optional) Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install django djangorestframework django-cors-headers djangorestframework-simplejwt python-dotenv web3

# Run database migrations
python manage.py migrate

# Seed rich demo data (users, identities, credentials, agents, proofs)
python manage.py seed_demo_data

# Run the backend dev server
python manage.py runserver 8000
```

The application is now live at **`http://127.0.0.1:8000/`**.

---

### Step 3: Smart Contract Setup & Tests (Monad / Hardhat)

```bash
# In a new terminal, navigate to contracts directory
cd contracts

# Install dependencies
npm install

# Run the complete test suite (12 tests covering identity, credentials, agents, and admin)
npm test
```

#### Contract Test Output:
```
  ProofIDRegistry Smart Contract
    Deployment & Admin
      √ Should set the deployer as owner and trusted issuer
      √ Should allow owner to add and remove trusted issuers
    Identity Lifecycle
      √ Should register a new human identity
      √ Should prevent duplicate identity registration with same hash
      √ Should allow trusted issuer to verify identity
      √ Should allow trusted issuer to update reputation score up to 1000
      √ Should reject score update above 1000
    Verifiable Credentials
      √ Should issue verifiable credentials
      √ Should allow credential revocation
    Autonomous AI Agent Delegation
      √ Should allow identity owner to register autonomous AI subagent
      √ Should allow trusted issuer to verify agent and update agent reputation
      √ Should reject agent registration by non-owner

  12 passing (4s)
```

To deploy to the Monad Testnet:
```bash
npx hardhat run scripts/deploy.js --network monadTestnet
```

---

## 🧪 Demo Credentials & Judging Walkthrough

### Default Credentials:
| Account | Username | Password | Role | ProofID |
| :--- | :--- | :--- | :--- | :--- |
| **Alex Rivera** | `demo` | `demo123` | Lead AI Systems Architect | `PID-8F3A29B1` |
| **Dr. Sarah Chen** | `sarah_chen` | `demo123` | AI Safety & Alignment Researcher | `PID-4E90B12D` |
| **Marcus Vance** | `marcus_web3` | `demo123` | Monad Parallel EVM Core Dev | `PID-1C8894EF` |

### Recommended Demo Flow:
1. **Landing Page:** Open `http://127.0.0.1:8000/` to explore the futuristic Web3/AI hero landing page with live platform statistics.
2. **Instant Demo Login:** Click **"Explore Live Demo"** or select **"Alex Rivera"** from the demo profile switcher in the top banner.
3. **User Dashboard:** View reputation score (`840/1000`), active credentials, autonomous AI agents, and real-time activity feed.
4. **Issue Credentials:** Navigate to **"Credentials"** → click **"Add Credential"** → select from Driver's License, Passport, Developer, or Hackathon Builder. Watch the reputation score increase immediately!
5. **Autonomous AI Agents:** Navigate to **"AI Agents"** → inspect registered agents like *Sentient-Code-Optimizer (`AGT-7C91B420`)*. Click **"Register New AI Agent"** to anchor a new sub-agent.
6. **AI Trust Analyzer:** Navigate to **"Trust Analyzer"** → run an in-depth trust and safety evaluation on Alex or Sarah.
7. **Public Verification Oracle:** Navigate to **"Verify Oracle"** → search `PID-8F3A29B1` or `AGT-7C91B420` to inspect public trust certificates without logging in.
8. **Monad Explorer:** Navigate to **"Blockchain"** to view real-time cryptographic state proofs anchored on Monad Testnet.

---

## 📡 REST API Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login/` | JWT login with username/password | No |
| `POST` | `/api/auth/register/` | Register new user + auto-provision ProofID | No |
| `POST` | `/api/auth/google/` | One-click Google OAuth / Biometric entry | No |
| `POST` | `/api/auth/github/` | One-click GitHub developer onboarding | No |
| `POST` | `/api/auth/web3/` | Monad EVM wallet attestation | No |
| `POST` | `/api/auth/demo-profile/`| Switch instant demo test profiles | No |
| `GET` | `/api/dashboard/` | Full user metrics, stats, and feeds | Yes (JWT) |
| `GET/POST` | `/api/identity/` | Get or update identity profile | Yes (JWT) |
| `GET/POST` | `/api/credentials/` | List and issue verifiable credentials | Yes (JWT) |
| `GET/POST` | `/api/agents/` | List and register autonomous AI agents | Yes (JWT) |
| `POST` | `/api/analyze/` | AI-powered trust & risk report | Yes (JWT) |
| `GET` | `/api/verify/?q=<id>` | Universal public verification oracle | No |
| `GET` | `/api/blockchain/status/`| Monad RPC connection & anchored proofs | No |

---

## 🔒 Security & Privacy Guarantees

- **No Sensitive PII On-Chain:** Only salted SHA3-256 hashes and verifiable credential digests are committed to smart contracts.
- **Phishing-Resistant Authentication:** Passwordless WebAuthn / Passkey support and rotating JWTs with HTTP-only tokens.
- **Granular Agent Delegation:** AI agents possess strictly defined cryptographic delegation scopes without direct access to human private keys.
- **Audit Trails:** Immutable database audit logs record IP address, user-agent, action type, and status for every state-changing event.

---

## 📄 License

MIT License. Designed and engineered for the Trust, Identity & AI Infrastructure Hackathon.
