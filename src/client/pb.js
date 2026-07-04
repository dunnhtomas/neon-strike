/* Neon Strike — PocketBase client wrapper + offline fallback */
'use strict';

const PB_URL = (typeof importScripts !== 'undefined' ? '' : window.location?.origin.replace(/:\d+$/, ':8090')) || 'http://127.0.0.1:8090';

window.NeonPB = (function () {
  let authModel = null;
  let token = null;

  // Generic fetch helper.
  async function rpc(path, options = {}) {
    const url = `${PB_URL}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = token;
    try {
      const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
      const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) throw new Error(data.message || `${res.status} ${res.statusText}`);
      return data;
    } catch (err) {
      // Return an offline sentinel so callers can gracefully fall back.
      return { offline: true, error: err.message };
    }
  }

  const Client = {
    url: PB_URL,

    async signUp(email, password) {
      const data = await rpc('/api/collections/users/records', {
        method: 'POST',
        body: JSON.stringify({ email, password, passwordConfirm: password }),
      });
      return data;
    },

    async authWithPassword(email, password) {
      const data = await rpc('/api/collections/users/auth-with-password', {
        method: 'POST',
        body: JSON.stringify({ identity: email, password }),
      });
      if (data.record && data.token) { authModel = data.record; token = data.token; }
      return data;
    },

    async authAsAnonymous() {
      const data = await rpc('/api/collections/users/auth-with-oauth2', {
        method: 'POST',
        body: JSON.stringify({ provider: 'oidc', code: 'anon', codeVerifier: 'anon', redirectUrl: PB_URL }),
      });
      if (data.record && data.token) { authModel = data.record; token = data.token; }
      return data;
    },

    async submitScore(score, level, streak, seed) {
      const payload = {
        user: authModel?.id || '',
        score, level, streak,
        dailySeed: seed || null,
        created: new Date().toISOString(),
      };
      // Online when possible; otherwise store locally for retry.
      const data = await rpc('/api/collections/scores/records', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.offline) {
        const q = JSON.parse(localStorage.getItem('neonStrike.pendingScores') || '[]');
        q.push(payload);
        localStorage.setItem('neonStrike.pendingScores', JSON.stringify(q));
      }
      return data;
    },

    async getLeaderboard(seed) {
      const filter = seed ? `dailySeed=${seed}` : '';
      const data = await rpc(`/api/collections/scores/records?sort=-score&perPage=20&filter=${encodeURIComponent(filter)}`);
      if (data.offline) {
        // Return a deterministic fake leaderboard for offline gameplay.
        return { items: offlineLeaderboard(seed) };
      }
      return data;
    },

    async saveGameState(state) {
      if (!authModel?.id) return { offline: true };
      return rpc('/api/collections/game_state/records', {
        method: 'POST',
        body: JSON.stringify({ user: authModel.id, state: JSON.stringify(state) }),
      });
    },

    async loadGameState() {
      if (!authModel?.id) return { offline: true };
      const data = await rpc(`/api/collections/game_state/records?filter=${encodeURIComponent(`user="${authModel.id}"`)}`);
      if (data.offline) return { offline: true };
      return data;
    },

    isAuthenticated() { return !!token; },
    getAuthModel() { return authModel; },
  };

  function offlineLeaderboard(seed) {
    const rand = (n) => {
      let x = Math.sin((seed || 1) + n) * 10000;
      return x - Math.floor(x);
    };
    const names = ['Ace', 'Neb', 'Vex', 'Luna', 'Bolt', 'Rex', 'Zed', 'Nova'];
    return names.map((n, i) => ({
      player: n, score: 1200 + Math.floor(rand(i) * 4000), level: 1 + Math.floor(rand(i + 10) * 10),
    }));
  }

  return Client;
})();
