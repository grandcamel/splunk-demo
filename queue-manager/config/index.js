/**
 * Configuration constants for the queue manager.
 */

module.exports = {
  // Server
  PORT: process.env.PORT || 3000,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Session
  SESSION_TIMEOUT_MINUTES: parseInt(process.env.SESSION_TIMEOUT_MINUTES, 10) || 60,
  MAX_QUEUE_SIZE: parseInt(process.env.MAX_QUEUE_SIZE, 10) || 10,
  AVERAGE_SESSION_MINUTES: 45,
  TTYD_PORT: 7681,
  DISCONNECT_GRACE_MS: 10000,
  AUDIT_RETENTION_DAYS: 30,
  SESSION_SECRET: process.env.SESSION_SECRET || 'change-me-in-production',

  // Session environment files (for secure credential passing)
  SESSION_ENV_HOST_PATH: process.env.SESSION_ENV_HOST_PATH || '/tmp/session-env',
  SESSION_ENV_CONTAINER_PATH: '/run/session-env',

  // Security
  BASE_URL: process.env.BASE_URL || 'http://localhost:8080',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || process.env.BASE_URL || 'http://localhost:8080',

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 60 * 1000,  // 1 minute window
  RATE_LIMIT_MAX_CONNECTIONS: 10,    // Max connections per IP per window

  // Invite brute-force protection
  INVITE_RATE_LIMIT_WINDOW_MS: 60 * 60 * 1000,  // 1 hour window
  INVITE_RATE_LIMIT_MAX_ATTEMPTS: 10,            // Max failed attempts per IP per hour

  // Splunk
  SPLUNK_URL: process.env.SPLUNK_URL || 'https://splunk:8089',
  SPLUNK_WEB_URL: process.env.SPLUNK_WEB_URL || 'http://splunk:8000',
  SPLUNK_USERNAME: process.env.SPLUNK_USERNAME || 'admin',
  SPLUNK_PASSWORD: process.env.SPLUNK_PASSWORD || 'DemoPass123!',

  // Claude authentication
  CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',

  // Scenarios
  SCENARIOS_PATH: '/opt/demo-container/scenarios',
  SCENARIO_NAMES: {
    'devops': { file: 'devops.md', title: 'DevOps Engineer', icon: '🔧' },
    'sre': { file: 'sre.md', title: 'SRE / On-Call', icon: '🚨' },
    'support': { file: 'support.md', title: 'Support Engineer', icon: '🎧' },
    'management': { file: 'management.md', title: 'Management', icon: '📊' },
    'search': { file: 'search.md', title: 'Search Basics', icon: '🔍' },
    'alert': { file: 'alert.md', title: 'Alert Management', icon: '🔔' },
    'job': { file: 'job.md', title: 'Job Management', icon: '⚙️' },
    'export': { file: 'export.md', title: 'Data Export', icon: '📥' }
  }
};
