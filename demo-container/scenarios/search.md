# Search Basics

Learn the fundamentals of searching with Splunk Assistant Skills.

## Natural Language Search

You don't need to know SPL to search. Try:

```
Show me the 10 most recent errors
```

```
Count events by sourcetype
```

```
What happened in the last 5 minutes?
```

## Understanding Indexes

Data is organized into indexes by persona:

| Index | Contents |
|-------|----------|
| `demo_devops` | CI/CD, containers, deployments |
| `demo_sre` | Errors, latency, health checks |
| `demo_support` | Sessions, tickets, user errors |
| `demo_business` | KPIs, compliance, capacity |
| `demo_main` | General application logs |

## Basic SPL Patterns

### Time-bounded Search

```spl
index=demo_sre earliest=-1h latest=now
| head 100
```

### Field Selection

```spl
index=demo_sre
| fields _time, service, error_type, message
| head 50
```

### Statistics

```spl
index=demo_sre sourcetype=app:errors
| stats count by service
| sort -count
```

### Time Charts

```spl
index=demo_sre sourcetype=app:errors
| timechart span=5m count by service
```

## Search Modes

The CLI supports three search modes:

### Oneshot (Quick)
```bash
splunk-as search oneshot "index=demo_sre | head 10"
```

### Normal (Async)
```bash
splunk-as search normal "index=demo_sre | stats count" --wait
```

### Blocking (Sync)
```bash
splunk-as search blocking "index=demo_sre | head 10" --timeout 60
```

## CLI Quick Reference

```bash
# Search
splunk-as search oneshot "your query here"

# Job management
splunk-as job list
splunk-as job status <sid>

# Metadata
splunk-as metadata indexes
splunk-as metadata sourcetypes --index demo_sre

# Export results
splunk-as export results <sid> --output-file results.csv
```

## Getting Help

Ask Claude for help with:

```
How do I search for errors containing "timeout"?
```

```
Write a query to find the top 10 slowest endpoints
```

```
Explain what this SPL query does: index=demo_sre | stats avg(duration_ms) by service
```
