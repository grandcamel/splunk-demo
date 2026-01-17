# DevOps Engineer Scenarios

Welcome! This scenario helps you explore CI/CD pipelines, deployments, and infrastructure monitoring.

## Getting Started

Try these prompts to explore DevOps data:

### Pipeline Analysis

```
Show me all failed CI/CD pipelines in the last 24 hours
```

```
Which repository has the most build failures this week?
```

### Deployment Tracking

```
What was deployed to production yesterday?
```

```
Show deployment frequency by environment over the past 7 days
```

### Container Health

```
Find containers with high restart counts
```

```
Show Docker container logs with errors
```

### Infrastructure Changes

```
Show recent Terraform changes across all environments
```

## Key Index

- `demo_devops` - CI/CD, containers, infrastructure

## Sourcetypes

| Sourcetype | Description |
|------------|-------------|
| `cicd:pipeline` | Jenkins, GitHub Actions pipeline events |
| `container:docker` | Docker container logs |
| `container:k8s` | Kubernetes events |
| `deploy:events` | Deployment tracking |
| `infra:terraform` | Infrastructure changes |

## Useful SPL Patterns

```spl
# Failed pipelines by repository
index=demo_devops sourcetype=cicd:pipeline status=failure
| stats count by repository
| sort -count

# Deployment timeline
index=demo_devops sourcetype=deploy:events
| timechart span=1h count by environment

# Container restart analysis
index=demo_devops sourcetype=container:docker
| stats sum(restart_count) as restarts by container_name
| where restarts > 0
```

## Pre-Built Searches

Use these saved searches for quick analysis:

- **DevOps - Failed Pipelines Today**
- **DevOps - Deployment Frequency**
- **DevOps - Container Restarts**
