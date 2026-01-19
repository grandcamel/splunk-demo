# CLAUDE.md

This file provides guidance to Claude Code when working with the splunk-demo project.

## Project Overview

Live demo system for [Splunk Assistant Skills](https://github.com/grandcamel/Splunk-Assistant-Skills) plugin. Web-based terminal access via ttyd with queue/waitlist for single-user sessions against a pre-configured Splunk Enterprise instance.

```
splunk-demo/
├── docker-compose.yml          # Production orchestration
├── docker-compose.dev.yml      # Development overrides
├── Makefile                    # Build/run commands
├── shared/                     # Python package for event generation
│   ├── splunk_events/          # Event generators, HEC client
│   └── tests/                  # pytest tests
├── queue-manager/              # Node.js WebSocket server
│   └── tests/                  # Jest tests
├── demo-container/             # Claude + Splunk plugin container
├── landing-page/               # Static HTML frontend
├── nginx/                      # Reverse proxy configuration
├── log-generator/              # Real-time event generation
├── seed-data/                  # Historical data seeder
├── splunk/apps/demo_app/       # Splunk indexes, inputs, saved searches
├── observability/              # LGTM stack (Grafana, Loki, Tempo)
├── scripts/                    # Maintenance scripts
└── secrets/                    # Credentials (.gitignored)
```

## Quick Start

```bash
# Start local development
make dev

# Access points (development)
# Landing Page:  http://localhost:18080
# Splunk Web:    http://localhost:8000  (admin / DemoPass123!)
# Grafana:       http://localhost:13000
# Webhooks:      http://localhost:8081

# Stop environment
make dev-down
```

## Key Services

| Service | Dev Port | Purpose |
|---------|----------|---------|
| nginx | 18080 | Reverse proxy, landing page |
| splunk | 8000, 8088, 8089 | Web UI, HEC, Management API |
| queue-manager | 3000 | Session management, invites |
| demo-container | 7681 | Claude terminal (ttyd, spawned per session) |
| redis | 16379 | Session state, queue, invite tokens |
| lgtm | 13000, 13100, etc. | Grafana, Loki, Tempo (LGTM stack) |
| log-generator | - | Real-time event generation |
| seed-loader | - | Historical data seeder (runs once) |
| webhook-catcher | 8081 | Alert webhook testing |

## Demo Data

### Indexes

| Index | Purpose | Sourcetypes |
|-------|---------|-------------|
| `demo_devops` | CI/CD, containers | cicd:pipeline, container:docker, deploy:events |
| `demo_sre` | Errors, latency | app:errors, metrics:latency, health:checks |
| `demo_support` | Sessions, tickets | session:trace, error:user, feature:usage |
| `demo_business` | KPIs, compliance | kpi:revenue, compliance:audit, capacity:metrics |
| `demo_main` | General logs | app:logs |

### Sample Queries

```spl
# DevOps: Failed pipelines
index=demo_devops sourcetype=cicd:pipeline status=failure
| stats count by repository | sort -count

# SRE: P99 latency by endpoint
index=demo_sre sourcetype=metrics:latency
| stats perc99(duration_ms) as p99 by endpoint
| where p99 > 500

# Support: Customer session trace
index=demo_support sourcetype=session:trace user_id="cust_456"
| sort _time | table _time page action duration_ms

# Business: Daily revenue by region
index=demo_business sourcetype=kpi:revenue
| timechart span=1d sum(value) as revenue by region
```

## Common Operations

| Task | Command |
|------|---------|
| Start local dev | `make dev` |
| Stop local dev | `make dev-down` |
| View logs | `make logs` |
| Generate invite | `make invite-local` |
| Shell into queue-manager | `make shell-queue` |
| Shell into demo container | `make shell-demo` |
| Rebuild containers | `make build` |
| Run all tests | `make test` |

## Architecture

```
nginx --> queue-manager --> ttyd --> demo-container
              |               |           |
           redis          LGTM stack   Splunk
              |
        log-generator
        seed-loader
```

**Endpoints**: `/` landing page, `/terminal` WebSocket, `/api/*` queue manager, `/grafana/` dashboards

## Testing

Unit tests exist for the core components. Always run tests after making changes.

### Test Locations

| Component | Framework | Path | Run Command |
|-----------|-----------|------|-------------|
| shared (Python) | pytest | `shared/tests/` | `cd shared && python -m pytest -v tests/` |
| queue-manager (Node.js) | Jest | `queue-manager/tests/` | `cd queue-manager && npm test` |

### What's Tested

**Python (`shared/splunk_events/`)**:
- `generators.py` - Event structure, anomaly logic, `_resolve_params`, all generator functions
- `hec_client.py` - HECClient init, send, payload format, wait_until_ready, retry logic

**Node.js (`queue-manager/`)**:
- `services/state.js` - State getters/setters, Maps, queue array
- `services/session.js` - Token generation, `findClientWs`, `clearSessionToken`
- `services/invite.js` - Token validation, rejoin logic, usage recording
- `services/queue.js` - Queue position, leave queue, broadcast updates
- `routes/health.js` - Health and status endpoints

### Test Conventions

- Mock external dependencies (Redis, requests, metrics)
- Reset state before each test
- Use deterministic mocks for random/crypto when needed
- Test both success and error paths

### Pre-commit Hooks

Pre-commit hooks run automatically before each commit to catch issues early.

```bash
# Install pre-commit (once)
pip install pre-commit

# Install hooks (once per repo clone)
pre-commit install

# Run manually on all files
pre-commit run --all-files
```

**Hooks configured:**
- Trailing whitespace, end-of-file fixer, YAML/JSON validation
- Ruff linting for Python (`shared/`)
- pytest for Python changes
- Jest for Node.js changes

## Gotchas

### Splunk Docker Configuration

| Issue | Solution |
|-------|----------|
| License not accepted error | Add both `SPLUNK_START_ARGS="--accept-license"` AND `SPLUNK_GENERAL_TERMS="--accept-sgt-current-at-splunk-com"` |
| Image version not found | Use `splunk/splunk:latest` instead of specific versions like `9.1.0` |
| Volume mount permission errors | Don't use `:ro` flag on app directories - Splunk needs to chown them |
| Health check failures | Use `http://localhost:8000/en-US/account/login` instead of management API with auth |
| HEC SSL verification | Use `verify=False` when connecting to HEC over HTTPS in Docker |

### Docker Compose Configuration

| Issue | Solution |
|-------|----------|
| Port 80/443 already allocated | Use alternative ports (18080 for dev) |
| Port 6379 (Redis) in use | Use 16379 or check what's using the port |
| Port 3000 (Grafana) in use | Use 13000 in docker-compose.dev.yml |
| Port 4317/4318 (OTLP) in use | Use 14317/14318 in docker-compose.dev.yml |
| Network not found | Use internal bridge network, not external |
| npm ci fails (no lockfile) | Use `npm install --omit=dev` instead |
| Config file is directory | Docker creates directories for missing mount sources - create actual files first |

### General Demo Patterns

- **Claude auth via OAuth token**: Uses `CLAUDE_CODE_OAUTH_TOKEN` env var. On macOS, Makefile auto-retrieves from Keychain if not set.
- **Secrets location**: Store in `secrets/.env` (gitignored). For production, use `.env` in project root.
- **Rebuild after changes**: Container caches scenarios. Run `make build` after editing prompt files.
- **Nginx locations.include**: Named `.include` (not `.conf`) to prevent auto-inclusion at http context.
- **LGTM provisioning path**: Mount dashboards to `/otel-lgtm/grafana/conf/provisioning/dashboards/`, NOT `/etc/grafana/provisioning/`.

## Configuration

### Environment Variables

Set in `secrets/.env`:

```bash
# Splunk
SPLUNK_PASSWORD=DemoPass123!
SPLUNK_HEC_TOKEN=demo-hec-token-12345

# Claude Authentication (one required)
CLAUDE_CODE_OAUTH_TOKEN=...  # or
ANTHROPIC_API_KEY=...

# Session Management
SESSION_TIMEOUT_MINUTES=60
MAX_QUEUE_SIZE=10
SESSION_SECRET=change-me-in-production
```

### Secure Token Storage (macOS)

```bash
security add-generic-password -a "$USER" -s "CLAUDE_CODE_OAUTH_TOKEN" -w "<token>"
```

## Observability

### Grafana Dashboards

Access at http://localhost:13000 (dev mode)

| Dashboard | Purpose |
|-----------|---------|
| Demo Home | Nginx access logs, overview |
| (Add more as created) | - |

### Logs

```bash
# All logs
make logs

# Queue manager only
docker compose logs queue-manager -f

# Splunk container
docker compose logs splunk -f
```

## Troubleshooting

### Splunk won't start

```bash
# Check logs
docker compose logs splunk

# Verify license acceptance
grep -E "SPLUNK_START_ARGS|SPLUNK_GENERAL_TERMS" docker-compose.yml

# Check health
docker compose ps splunk
```

### HEC ingestion fails

```bash
# Verify HEC is enabled
curl -k https://localhost:8088/services/collector/health

# Test HEC endpoint
curl -k https://localhost:8088/services/collector/event \
  -H "Authorization: Splunk demo-hec-token-12345" \
  -d '{"event": "test"}'
```

### Port conflicts

```bash
# Find what's using a port
lsof -i :8080

# Common conflicts and alternatives
# 80 -> 18080
# 443 -> (remove or 18443)
# 6379 -> 16379
# 3000 -> 13000
# 4317/4318 -> 14317/14318
```

### Container won't build

```bash
# Clean rebuild
docker compose build --no-cache queue-manager

# Check for npm issues
docker compose logs queue-manager | grep -i error
```

## Shared Library

This project uses `@demo-platform/queue-manager-core` for common queue-manager functionality shared across jira-demo, confluence-demo, and splunk-demo.

### Location

```
demo-platform-shared/packages/queue-manager-core/
├── lib/
│   ├── index.js       # Main exports
│   ├── session.js     # Session token generation/validation
│   ├── rate-limit.js  # Connection and invite rate limiting
│   ├── env-file.js    # Secure environment file management
│   └── metrics.js     # OpenTelemetry metrics factory
├── test/              # Unit tests (16 tests)
└── package.json
```

### What's Shared

| Component | File | Usage |
|-----------|------|-------|
| Session tokens | `session.js` | HMAC-SHA256 token generation and validation |
| Rate limiting | `rate-limit.js` | Connection and invite brute-force protection |
| Env files | `env-file.js` | Secure credential file creation with 0600 permissions |
| Metrics | `metrics.js` | Standardized OpenTelemetry counters, histograms, gauges |

### Usage in This Project

```javascript
// config/metrics.js
const { createMetrics } = require('@demo-platform/queue-manager-core');
const metricsManager = createMetrics({ serviceName: 'splunk-demo-queue-manager', ... });

// services/session.js
const { generateSessionToken, createSessionEnvFile } = require('@demo-platform/queue-manager-core');
const token = generateSessionToken(sessionId, config.SESSION_SECRET);
const envFile = createSessionEnvFile(sessionId, envVars, { containerPath, hostPath });

// handlers/websocket.js, services/invite.js
const { createConnectionRateLimiter, createInviteRateLimiter } = require('@demo-platform/queue-manager-core');
```

### Updating the Shared Library

1. Make changes in `demo-platform-shared/packages/queue-manager-core/`
2. Run tests: `cd demo-platform-shared/packages/queue-manager-core && npm test`
3. Update all consuming projects: `npm install` in each queue-manager directory
4. Verify each project loads correctly: `node -e "require('./config'); console.log('OK')"`

### Shared Docker/Makefile Includes

Docker Compose fragments and Makefile includes are available in:

```
demo-platform-shared/
├── docker/compose-fragments/
│   ├── security-constraints.yml  # Container security anchors
│   ├── logging.yml               # Logging configuration anchors
│   └── healthcheck.yml           # Health check anchors
└── makefile-includes/
    ├── common.mk                 # Common dev/deploy targets
    ├── skill-testing.mk          # Skill test targets
    └── invites.mk                # Invite management targets
```

## Related Projects

| Project | Purpose |
|---------|---------|
| as-demo (local: `../as-demo`) | Unified platform (Confluence + JIRA + Splunk) |
| [Splunk-Assistant-Skills](https://github.com/grandcamel/Splunk-Assistant-Skills) | Source plugin |
| [splunk-assistant-skills-lib](https://pypi.org/project/splunk-assistant-skills-lib/) | Shared library |
| [jira-demo](https://github.com/grandcamel/jira-demo) | Reference implementation (JIRA) |
| [confluence-demo](https://github.com/grandcamel/confluence-demo) | Reference implementation (Confluence) |
| demo-platform-shared (local: `../demo-platform-shared`) | Shared queue-manager-core library |
