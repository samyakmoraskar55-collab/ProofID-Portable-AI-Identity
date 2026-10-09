/**
 * ProofID — Portable AI Identity
 * API Client — handles all backend communication with robust error parsing & social auth
 */
const API_BASE = '/api';

class ApiClient {
  constructor() {
    this._accessToken = localStorage.getItem('proofid_access_token');
    this._refreshToken = localStorage.getItem('proofid_refresh_token');
  }

  setTokens(access, refresh) {
    this._accessToken = access;
    this._refreshToken = refresh;
    localStorage.setItem('proofid_access_token', access);
    if (refresh) localStorage.setItem('proofid_refresh_token', refresh);
  }

  clearTokens() {
    this._accessToken = null;
    this._refreshToken = null;
    localStorage.removeItem('proofid_access_token');
    localStorage.removeItem('proofid_refresh_token');
  }

  get isAuthenticated() {
    return !!this._accessToken;
  }

  async _request(method, path, body = null, retry = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (this._accessToken) headers['Authorization'] = `Bearer ${this._accessToken}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    try {
      const res = await fetch(`${API_BASE}${path}`, opts);

      // Try token refresh on 401
      if (res.status === 401 && retry && this._refreshToken) {
        const refreshed = await this._refreshAccessToken();
        if (refreshed) return this._request(method, path, body, false);
        this.clearTokens();
        window.app?.showPage('landing');
        return { error: 'Session expired. Please sign in again.' };
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Extract human-friendly error string
        let errorMsg = 'Request failed';
        if (typeof data.error === 'string') {
          errorMsg = data.error;
        } else if (data.detail) {
          errorMsg = data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        } else if (data.errors && typeof data.errors === 'object') {
          const errList = [];
          for (const [k, v] of Object.entries(data.errors)) {
            const val = Array.isArray(v) ? v[0] : v;
            errList.push(`${k.replace(/_/g, ' ')}: ${val}`);
          }
          errorMsg = errList.join(' · ');
        }
        return { error: errorMsg, data, status: res.status };
      }
      return data;
    } catch (e) {
      return { error: 'Network error — unable to reach the server.' };
    }
  }

  async _refreshAccessToken() {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: this._refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.setTokens(data.access, this._refreshToken);
      return true;
    } catch { return false; }
  }

  get(path) { return this._request('GET', path); }
  post(path, body) { return this._request('POST', path, body); }
  patch(path, body) { return this._request('PATCH', path, body); }
  delete(path) { return this._request('DELETE', path); }

  // Auth & Social Logins
  register(data) { return this.post('/auth/register/', data); }
  login(data) { return this.post('/auth/login/', data); }
  googleLogin(data = {}) { return this.post('/auth/google/', data); }
  githubLogin(data = {}) { return this.post('/auth/github/', data); }
  web3Login(data = {}) { return this.post('/auth/web3/', data); }
  demoProfileLogin(profile = 'alex') { return this.post('/auth/demo-profile/', { profile }); }
  me() { return this.get('/auth/me/'); }

  // Identity
  getIdentity() { return this.get('/identity/'); }
  createIdentity(data) { return this.post('/identity/', data); }
  updateIdentity(data) { return this.patch('/identity/', data); }
  verifyIdentity() { return this.post('/identity/verify/', {}); }
  connectWallet(wallet_address) { return this.post('/identity/connect-wallet/', { wallet_address }); }

  // Dashboard & Reputation
  getDashboard() { return this.get('/dashboard/'); }
  getActivity() { return this.get('/activity/'); }
  getReputation() { return this.get('/reputation/'); }

  // Credentials & ID Proofs
  getCredentials() { return this.get('/credentials/'); }
  getCredentialTypes() { return this.get('/credentials/types/'); }
  addCredential(data) { return this.post('/credentials/', data); }
  revokeCredential(id) { return this.delete(`/credentials/${id}/`); }

  // AI Agents
  getAgents() { return this.get('/agents/'); }
  createAgent(data) { return this.post('/agents/', data); }
  getAgent(id) { return this.get(`/agents/${id}/`); }
  logAgentActivity(id, data) { return this.post(`/agents/${id}/log_activity/`, data); }
  verifyAgent(id) { return this.post(`/agents/${id}/verify_agent/`, {}); }

  // Trust Analysis
  analyze(data) { return this.post('/analyze/', data); }
  getTrustReports() { return this.get('/trust-reports/'); }

  // Public
  verify(q) { return this.get(`/verify/?q=${encodeURIComponent(q)}`); }
  getPublicIdentity(proofId) { return this.get(`/public/identity/${proofId}/`); }
  getPublicAgent(agentId) { return this.get(`/public/agent/${agentId}/`); }
  getBlockchainStatus() { return this.get('/blockchain/status/'); }

  // Settings
  getSettings() { return this.get('/settings/'); }
  updateSettings(data) { return this.patch('/settings/', data); }
}

window.api = new ApiClient();
