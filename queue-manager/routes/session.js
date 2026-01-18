/**
 * Session validation routes.
 */

const state = require('../services/state');
const { validateInvite } = require('../services/invite');

/**
 * Register session routes.
 * @param {Express} app - Express application
 * @param {Object} redis - Redis client
 */
function register(app, redis) {
  // Session validation endpoint (used by nginx auth_request for Grafana/Splunk)
  app.get('/api/session/validate', (req, res) => {
    const sessionCookie = req.cookies.demo_session;

    if (!sessionCookie) {
      return res.status(401).send('No session cookie');
    }

    // Check active session token first
    const sessionId = state.sessionTokens.get(sessionCookie);
    const activeSession = state.getActiveSession();
    if (sessionId && activeSession && activeSession.sessionId === sessionId) {
      res.set('X-Grafana-User', `demo-${sessionId.slice(0, 8)}`);
      return res.status(200).send('OK');
    }

    // Check pending session token (user in queue or session starting)
    const pending = state.pendingSessionTokens.get(sessionCookie);
    if (pending) {
      res.set('X-Grafana-User', `demo-${pending.clientId.slice(0, 8)}`);
      return res.status(200).send('OK');
    }

    // Clean up stale token if it was in sessionTokens
    if (state.sessionTokens.has(sessionCookie)) {
      state.sessionTokens.delete(sessionCookie);
    }

    return res.status(401).send('Session not active');
  });

  // Invite validation endpoint (used by nginx auth_request)
  app.get('/api/invite/validate', async (req, res) => {
    const token = req.headers['x-invite-token'] || req.query.token;
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

    if (!token) {
      return res.status(401).json({ valid: false, reason: 'missing', message: 'Invite token required' });
    }

    const validation = await validateInvite(redis, token, clientIp);

    if (validation.valid) {
      res.status(200).json({ valid: true });
    } else {
      res.status(401).json({ valid: false, reason: validation.reason, message: validation.message });
    }
  });
}

module.exports = { register };
