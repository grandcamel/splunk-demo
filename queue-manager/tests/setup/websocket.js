/**
 * WebSocket test setup - creates server with WebSocket support for testing.
 */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cookieParser = require('cookie-parser');

const state = require('../../services/state');
const healthRoutes = require('../../routes/health');
const sessionRoutes = require('../../routes/session');
const websocketHandlers = require('../../handlers/websocket');

/**
 * Create a test server with WebSocket support.
 * @param {Object} mockRedis - Mock Redis client
 * @returns {Object} { server, wss, app, port }
 */
function createTestServer(mockRedis) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/api/ws' });

  // Middleware
  app.use(express.json());
  app.use(cookieParser());

  // Register routes
  healthRoutes.register(app);
  sessionRoutes.register(app, mockRedis);

  // Set up WebSocket handlers
  websocketHandlers.setup(wss, mockRedis);

  return { server, wss, app };
}

/**
 * Start the test server on a random available port.
 * @param {http.Server} server - HTTP server instance
 * @returns {Promise<number>} The port number
 */
function startServer(server) {
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      resolve(port);
    });
  });
}

/**
 * Stop the test server.
 * @param {http.Server} server - HTTP server instance
 * @param {WebSocketServer} wss - WebSocket server instance
 * @returns {Promise<void>}
 */
function stopServer(server, wss) {
  return new Promise((resolve) => {
    wss.close(() => {
      server.close(() => {
        resolve();
      });
    });
  });
}

/**
 * Reset state between tests.
 */
function resetState() {
  state.queue.length = 0;
  state.clients.clear();
  state.sessionTokens.clear();
  state.pendingSessionTokens.clear();
  state.setActiveSession(null);
  state.clearDisconnectGraceTimeout();
}

module.exports = { createTestServer, startServer, stopServer, resetState };
