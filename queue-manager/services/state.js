/**
 * Shared state for queue manager.
 * Centralized state management to avoid circular dependencies.
 */

// Client connections: ws -> { id, state, joinedAt, ip, userAgent, inviteToken }
const clients = new Map();

// Queue of client IDs waiting
const queue = [];

// Active session: { clientId, sessionId, startedAt, expiresAt, ttydProcess, inviteToken, ip, userAgent, queueWaitMs, errors, sessionToken }
let activeSession = null;

// Session tokens for Grafana/Splunk auth: sessionToken -> sessionId
const sessionTokens = new Map();

// Pending session tokens (for queue/pending state): sessionToken -> { clientId, inviteToken, ip }
const pendingSessionTokens = new Map();

// Timeout for disconnect grace period
let disconnectGraceTimeout = null;

// Reconnection lock to prevent concurrent reconnection attempts
let reconnectionInProgress = false;

module.exports = {
  clients,
  queue,

  getActiveSession() {
    return activeSession;
  },

  setActiveSession(session) {
    activeSession = session;
  },

  sessionTokens,
  pendingSessionTokens,

  getDisconnectGraceTimeout() {
    return disconnectGraceTimeout;
  },

  setDisconnectGraceTimeout(timeout) {
    disconnectGraceTimeout = timeout;
  },

  clearDisconnectGraceTimeout() {
    if (disconnectGraceTimeout) {
      clearTimeout(disconnectGraceTimeout);
      disconnectGraceTimeout = null;
    }
  },

  isReconnectionInProgress() {
    return reconnectionInProgress;
  },

  setReconnectionInProgress(inProgress) {
    reconnectionInProgress = inProgress;
  }
};
