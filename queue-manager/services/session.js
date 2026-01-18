/**
 * Session management service.
 */

const { spawn } = require('child_process');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const config = require('../config');
const {
  getTracer,
  sessionsStartedCounter,
  sessionsEndedCounter,
  sessionDurationHistogram,
  queueWaitHistogram,
  ttydSpawnHistogram
} = require('../config/metrics');
const state = require('./state');
const { recordInviteUsage } = require('./invite');

/**
 * Generate a session token.
 * @param {string} sessionId - Session ID
 * @returns {string} Session token
 */
function generateSessionToken(sessionId) {
  const timestamp = Date.now().toString();
  const data = `${sessionId}:${timestamp}`;
  const signature = crypto.createHmac('sha256', config.SESSION_SECRET)
    .update(data)
    .digest('hex');
  return `${Buffer.from(data).toString('base64')}.${signature}`;
}

/**
 * Create and register a session token.
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} sessionId - Session ID
 * @returns {string} Session token
 */
function setSessionCookie(ws, sessionId) {
  const token = generateSessionToken(sessionId);
  state.sessionTokens.set(token, sessionId);

  const client = state.clients.get(ws);
  if (client) {
    client.sessionToken = token;
  }

  return token;
}

/**
 * Clear a session token.
 * @param {string} sessionToken - Token to clear
 */
function clearSessionToken(sessionToken) {
  if (sessionToken) {
    state.sessionTokens.delete(sessionToken);
  }
}

/**
 * Find WebSocket for a client ID.
 * @param {string} clientId - Client ID to find
 * @returns {WebSocket|null} WebSocket or null
 */
function findClientWs(clientId) {
  for (const [ws, client] of state.clients.entries()) {
    if (client.id === clientId) {
      return ws;
    }
  }
  return null;
}

/**
 * Start a new session.
 * @param {Object} redis - Redis client
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} client - Client object
 * @param {Function} processQueue - Queue processing callback
 */
async function startSession(redis, ws, client, processQueue) {
  const tracer = getTracer();
  const span = tracer?.startSpan('session.start', {
    attributes: {
      'session.client_id': client.id,
      'session.invite_token': client.inviteToken ? client.inviteToken.slice(0, 8) : 'none',
    }
  });

  console.log(`Starting session for client ${client.id}`);
  const spawnStartTime = Date.now();

  try {
    // Remove from queue
    const queueIndex = state.queue.indexOf(client.id);
    if (queueIndex !== -1) {
      state.queue.splice(queueIndex, 1);
    }

    client.state = 'active';

    // Start ttyd with demo container
    const ttydProcess = spawn('ttyd', [
      '--port', String(config.TTYD_PORT),
      '--interface', '0.0.0.0',
      '--max-clients', '1',
      '--once',
      '--writable',
      '--client-option', 'reconnect=0',
      'docker', 'run', '--rm', '-it',
      '-e', 'TERM=xterm',
      '-e', `SPLUNK_URL=${config.SPLUNK_URL}`,
      '-e', `SPLUNK_USERNAME=${config.SPLUNK_USERNAME}`,
      '-e', `SPLUNK_PASSWORD=${config.SPLUNK_PASSWORD}`,
      '-e', `SESSION_TIMEOUT_MINUTES=${config.SESSION_TIMEOUT_MINUTES}`,
      '-e', `ENABLE_AUTOPLAY=${process.env.ENABLE_AUTOPLAY || 'false'}`,
      '-e', `AUTOPLAY_DEBUG=${process.env.AUTOPLAY_DEBUG || 'false'}`,
      '-e', `AUTOPLAY_SHOW_TOOLS=${process.env.AUTOPLAY_SHOW_TOOLS || 'false'}`,
      '-e', `OTEL_ENDPOINT=${process.env.OTEL_ENDPOINT || ''}`,
      ...(config.CLAUDE_CODE_OAUTH_TOKEN ? ['-e', `CLAUDE_CODE_OAUTH_TOKEN=${config.CLAUDE_CODE_OAUTH_TOKEN}`] : []),
      ...(config.ANTHROPIC_API_KEY ? ['-e', `ANTHROPIC_API_KEY=${config.ANTHROPIC_API_KEY}`] : []),
      'splunk-demo-container:latest'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle ttyd spawn errors
    ttydProcess.on('error', (err) => {
      console.error('Failed to spawn ttyd:', err.message);
      span?.recordException(err);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to start terminal' }));
      client.state = 'connected';
      processQueue();
    });

    // Record spawn time
    const spawnDuration = (Date.now() - spawnStartTime) / 1000;
    ttydSpawnHistogram?.record(spawnDuration);
    span?.setAttribute('ttyd.spawn_seconds', spawnDuration);

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + config.SESSION_TIMEOUT_MINUTES * 60 * 1000);
    const queueWaitMs = client.joinedAt ? (startedAt - client.joinedAt) : 0;
    const sessionId = uuidv4();

    // Record queue wait time
    if (queueWaitMs > 0) {
      queueWaitHistogram?.record(queueWaitMs / 1000);
      span?.setAttribute('session.queue_wait_seconds', queueWaitMs / 1000);
    }

    // Promote pending session token to active session token
    const sessionToken = client.pendingSessionToken;
    if (sessionToken) {
      state.pendingSessionTokens.delete(sessionToken);
      state.sessionTokens.set(sessionToken, sessionId);
    }

    const activeSession = {
      clientId: client.id,
      sessionId: sessionId,
      sessionToken: sessionToken,
      ttydProcess: ttydProcess,
      startedAt: startedAt,
      expiresAt: expiresAt,
      inviteToken: client.inviteToken || null,
      ip: client.ip,
      userAgent: client.userAgent,
      queueWaitMs: queueWaitMs,
      errors: []
    };

    state.setActiveSession(activeSession);

    // Handle ttyd exit
    ttydProcess.on('exit', (code) => {
      console.log(`ttyd exited with code ${code}`);
      const currentSession = state.getActiveSession();
      if (currentSession && currentSession.clientId === client.id) {
        endSession(redis, 'container_exit', processQueue);
      }
    });

    // Notify client
    ws.send(JSON.stringify({
      type: 'session_starting',
      terminal_url: '/terminal',
      expires_at: expiresAt.toISOString(),
      session_token: sessionToken
    }));

    // Schedule warning and timeout
    scheduleSessionWarning(ws, client);
    scheduleSessionTimeout(redis, client, processQueue);

    // Save to Redis for persistence
    await redis.set(`session:${client.id}`, JSON.stringify({
      sessionId: sessionId,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      inviteToken: client.inviteToken || null,
      ip: client.ip,
      userAgent: client.userAgent,
      queueWaitMs: queueWaitMs
    }), 'EX', config.SESSION_TIMEOUT_MINUTES * 60);

    // Record metrics
    sessionsStartedCounter?.add(1);
    span?.setAttribute('session.id', sessionId);

    console.log(`Session started for ${client.id}, expires at ${expiresAt.toISOString()}`);

    span?.end();
  } catch (err) {
    console.error('Failed to start session:', err);
    span?.recordException(err);
    span?.end();
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to start demo session' }));
    client.state = 'connected';
    processQueue();
  }
}

function scheduleSessionWarning(ws, client) {
  const warningTime = (config.SESSION_TIMEOUT_MINUTES - 5) * 60 * 1000;

  setTimeout(() => {
    const activeSession = state.getActiveSession();
    if (activeSession && activeSession.clientId === client.id) {
      ws.send(JSON.stringify({
        type: 'session_warning',
        minutes_remaining: 5
      }));
    }
  }, warningTime);
}

function scheduleSessionTimeout(redis, client, processQueue) {
  const timeoutMs = config.SESSION_TIMEOUT_MINUTES * 60 * 1000;

  setTimeout(() => {
    const activeSession = state.getActiveSession();
    if (activeSession && activeSession.clientId === client.id) {
      endSession(redis, 'timeout', processQueue);
    }
  }, timeoutMs);
}

/**
 * End the current session.
 * @param {Object} redis - Redis client
 * @param {string} reason - End reason
 * @param {Function} processQueue - Queue processing callback
 */
async function endSession(redis, reason, processQueue) {
  const activeSession = state.getActiveSession();
  if (!activeSession) return;

  const tracer = getTracer();
  const span = tracer?.startSpan('session.end', {
    attributes: {
      'session.id': activeSession.sessionId,
      'session.client_id': activeSession.clientId,
      'session.end_reason': reason,
    }
  });

  const clientId = activeSession.clientId;
  const endedAt = new Date();
  const durationMs = endedAt - activeSession.startedAt;
  console.log(`Ending session for ${clientId}, reason: ${reason}`);

  // Record session duration
  sessionDurationHistogram?.record(durationMs / 1000, { reason });
  sessionsEndedCounter?.add(1, { reason });
  span?.setAttribute('session.duration_seconds', durationMs / 1000);

  // Kill ttyd process
  if (activeSession.ttydProcess) {
    try {
      activeSession.ttydProcess.kill('SIGTERM');
    } catch (err) {
      console.error('Error killing ttyd:', err.message);
    }
  }

  // Clear session token
  clearSessionToken(activeSession.sessionToken);

  // Record invite usage if applicable
  if (activeSession.inviteToken) {
    await recordInviteUsage(redis, activeSession, endedAt, reason, config.AUDIT_RETENTION_DAYS);
  }

  // Notify client to clear cookie
  const clientWs = findClientWs(clientId);
  if (clientWs) {
    clientWs.send(JSON.stringify({
      type: 'session_ended',
      reason: reason,
      clear_session_cookie: true
    }));

    const client = state.clients.get(clientWs);
    if (client) {
      client.state = 'connected';
      client.sessionToken = null;
    }
  }

  // Clean up Redis
  await redis.del(`session:${clientId}`);

  state.setActiveSession(null);
  span?.end();

  // Process next in queue
  processQueue();
}

module.exports = {
  generateSessionToken,
  setSessionCookie,
  clearSessionToken,
  findClientWs,
  startSession,
  endSession
};
