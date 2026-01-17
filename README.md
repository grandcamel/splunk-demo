# Splunk Assistant Skills Demo

Interactive demo environment for [Splunk Assistant Skills](https://github.com/your-org/splunk-assistant-skills) - a Claude Code plugin for natural language Splunk automation.

## Overview

This demo provides a fully-configured Splunk Enterprise instance with realistic log data, enabling users to explore Splunk queries through natural language via Claude Code.

### Features

- **Splunk Enterprise** with Free License (500MB/day)
- **Pre-seeded Data** - 7 days of historical logs (~350K events)
- **Real-time Log Generator** - Continuous event stream with anomaly injection
- **Multiple Personas** - DevOps, SRE, Support, Management scenarios
- **Live Alerts** - Pre-configured alerts with webhook visualization
- **Full Web UI Access** - Direct access to Splunk Web
- **Observability Stack** - Grafana, Loki, Tempo for demo infrastructure monitoring

## Quick Start

### Prerequisites

- Docker and Docker Compose
- 8GB+ RAM available
- Ports 8080 (nginx), 8000 (Splunk), 3000 (Grafana) available

### Start the Demo

```bash
# Clone the repository
git clone https://github.com/your-org/splunk-demo.git
cd splunk-demo

# Start in development mode (with exposed ports)
make dev

# Or production mode
make prod
```

### Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Landing Page | http://localhost:8080 | Invite token |
| Splunk Web | http://localhost:8000 | admin / DemoPass123! |
| Grafana | http://localhost:3000 | admin / admin |
| Webhooks | http://localhost:8080/webhooks/ | - |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          Nginx (8080)                            │
│    Landing Page │ Splunk Web │ Grafana │ Webhooks │ Terminal     │
└────────┬─────────────┬───────────┬─────────┬──────────┬──────────┘
         │             │           │         │          │
         ▼             ▼           ▼         ▼          ▼
┌─────────────┐  ┌───────────┐  ┌────────┐ ┌─────────┐ ┌───────────┐
│Queue Manager│  │  Splunk   │  │Grafana │ │Webhook  │ │Demo       │
│  (Redis)    │  │Enterprise │  │        │ │Catcher  │ │Container  │
└─────────────┘  │  (8089)   │  └────────┘ └─────────┘ │(ttyd)     │
                 │  (8088)   │                         └───────────┘
                 └─────┬─────┘
                       │ HEC
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │   Seed   │  │   Log    │  │  Alerts  │
   │   Data   │  │Generator │  │  (cron)  │
   └──────────┘  └──────────┘  └──────────┘
```

## Data Model

### Indexes

| Index | Purpose | Sourcetypes |
|-------|---------|-------------|
| `demo_devops` | CI/CD, containers, infrastructure | cicd:pipeline, container:docker, container:k8s, deploy:events, infra:terraform |
| `demo_sre` | Errors, latency, health | app:errors, metrics:latency, health:checks, incident:events, slo:tracking |
| `demo_support` | Sessions, tickets, user errors | session:trace, ticket:events, error:user, feature:usage |
| `demo_business` | KPIs, compliance, capacity | kpi:revenue, kpi:conversion, compliance:audit, capacity:metrics, sla:tracking |
| `demo_main` | General application logs | app:logs |

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

## Scenario Guides

The demo includes guided scenarios for each persona:

- `/scenarios/devops.md` - CI/CD pipelines, deployments, containers
- `/scenarios/sre.md` - Error investigation, latency, health checks
- `/scenarios/support.md` - Customer sessions, tickets, feature usage
- `/scenarios/management.md` - KPIs, compliance, capacity planning
- `/scenarios/search.md` - SPL basics and CLI reference

Access via the landing page or directly at `http://localhost:8080/scenarios/`.

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
# Splunk credentials
SPLUNK_PASSWORD=DemoPass123!
SPLUNK_HEC_TOKEN=demo-hec-token-12345

# Demo access tokens
INVITE_TOKENS=your-token-here

# Data generation
EVENTS_PER_MINUTE=60
ANOMALY_RATE=0.05
```

### Generate Invite Token

```bash
make generate-token
```

## Commands

```bash
# Build and start
make dev              # Development mode (exposed ports)
make prod             # Production mode

# Management
make status           # Show service status
make health           # Check service health
make logs             # Follow logs
make restart          # Restart services
make down             # Stop services

# Splunk
make splunk-shell     # Open Splunk CLI
make splunk-logs      # Follow Splunk logs
make splunk-restart   # Restart Splunk

# Data
make seed             # Re-run seed data loader
make reseed           # Clear indexes and re-seed

# Cleanup
make clean            # Remove containers and volumes
```

## Development

### Project Structure

```
splunk-demo/
├── docker-compose.yml      # Main orchestration
├── docker-compose.dev.yml  # Development overrides
├── Makefile               # Commands
├── demo-container/        # Interactive Claude terminal
├── landing-page/          # Web UI
├── log-generator/         # Real-time event generator
├── seed-data/             # Historical data seeder
├── queue-manager/         # Session management
├── webhook-catcher/       # Alert webhook viewer
├── nginx/                 # Reverse proxy config
├── splunk/               # Splunk app configuration
│   └── apps/demo_app/    # Indexes, inputs, saved searches
└── observability/        # Grafana, Loki, Tempo, Mimir
```

### Building Images

```bash
make build            # Build all images
make build-demo       # Build demo container only
make build-generator  # Build log generator only
```

### Adding Custom Data

1. Modify `log-generator/generator.py` to add new event types
2. Update `splunk/apps/demo_app/default/props.conf` for field extractions
3. Add saved searches in `savedsearches.conf`
4. Rebuild: `make build-generator && make restart`

## Troubleshooting

### Splunk Not Starting

```bash
# Check logs
make splunk-logs

# Restart Splunk
make splunk-restart

# Verify health
curl -k https://localhost:8089/services/server/health
```

### No Data in Indexes

```bash
# Check HEC is working
curl -k https://localhost:8088/services/collector/health

# Manually run seed data
make seed

# Check log generator
docker logs splunk-demo-log-generator-1
```

### Memory Issues

Splunk requires significant memory. Increase Docker memory limit to 8GB+.

```bash
# Check Docker resources
docker system info | grep Memory
```

## License

This demo is provided for evaluation purposes. Splunk Enterprise Free License allows 500MB/day indexing.

## Related Projects

- [Splunk Assistant Skills](../plugins/splunk-assistant-skills/) - Claude Code plugin
- [splunk-assistant-skills-lib](https://pypi.org/project/splunk-assistant-skills-lib/) - Python library
