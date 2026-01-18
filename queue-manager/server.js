/**
 * Splunk Demo Queue Manager
 *
 * Manages single-user demo sessions with queue/waitlist functionality.
 * Supports invite-based access control with detailed session tracking.
 *
 * WebSocket Protocol:
 *   Client -> Server:
 *     { type: "join_queue", inviteToken?: "token" }
 *     { type: "leave_queue" }
 *     { type: "heartbeat" }
 *
 *   Server -> Client:
 *     { type: "queue_position", position: N, estimated_wait: "X minutes", queue_size: N }
 *     { type: "session_starting", terminal_url: "/terminal" }
 *     { type: "session_active", expires_at: "ISO timestamp" }
 *     { type: "session_warning", minutes_remaining: 5 }
 *     { type: "session_ended", reason: "timeout" | "disconnected" | "error" }
 *     { type: "invite_invalid", reason: "not_found" | "expired" | "used" | "revoked", message: "..." }
 *     { type: "error", message: "..." }
 */

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const Redis = require('ioredis');
const cookieParser = require('cookie-parser');

// Configuration and services
const config = require('./config');
const { initMetrics } = require('./config/metrics');
const state = require('./services/state');
const { processQueue } = require('./services/queue');
const { endSession } = require('./services/session');

// Routes
const healthRoutes = require('./routes/health');
const sessionRoutes = require('./routes/session');
const scenarioRoutes = require('./routes/scenarios');

// Handlers
const websocketHandlers = require('./handlers/websocket');

// Initialize services
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/api/ws' });
const redis = new Redis(config.REDIS_URL);

// Initialize metrics
initMetrics(
  () => state.queue.length,
  () => state.getActiveSession() ? 1 : 0
);

// Middleware
app.use(express.json());
app.use(cookieParser());

// Register routes
healthRoutes.register(app);
sessionRoutes.register(app, redis);
scenarioRoutes.register(app);

// Set up WebSocket handlers
websocketHandlers.setup(wss, redis);

// Start server
server.listen(config.PORT, () => {
  console.log(`Queue manager listening on port ${config.PORT}`);
  console.log(`Session timeout: ${config.SESSION_TIMEOUT_MINUTES} minutes`);
  console.log(`Max queue size: ${config.MAX_QUEUE_SIZE}`);
  console.log(`Splunk URL: ${config.SPLUNK_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');

  // Clear grace period timeout
  state.clearDisconnectGraceTimeout();

  if (state.getActiveSession()) {
    await endSession(redis, 'shutdown', () => processQueue(redis));
  }

  wss.close();
  server.close();
  redis.quit();

  process.exit(0);
});
