"""Event generators for different Splunk indexes.

All generators have a unified signature:
    generate_*_event(timestamp=None, is_anomaly=None, anomaly_rate=0.05)

- timestamp: Event timestamp (defaults to current time)
- is_anomaly: Force anomaly state (defaults to random based on anomaly_rate)
- anomaly_rate: Probability of anomaly when is_anomaly is None
"""

import random
import time
from datetime import datetime
from typing import Any

from faker import Faker

from .templates import (
    SERVICES,
    REPOSITORIES,
    ENVIRONMENTS,
    ERROR_TYPES,
    ENDPOINTS,
    PAGES,
    FEATURES,
    CUSTOMER_TIERS,
    REGIONS,
    HOSTS,
)

fake = Faker()


def _resolve_params(
    timestamp: float | None,
    is_anomaly: bool | None,
    anomaly_rate: float
) -> tuple[float, bool]:
    """Resolve optional parameters to concrete values."""
    if timestamp is None:
        timestamp = time.time()
    if is_anomaly is None:
        is_anomaly = random.random() < anomaly_rate
    return timestamp, is_anomaly


def generate_devops_event(
    timestamp: float | None = None,
    is_anomaly: bool | None = None,
    anomaly_rate: float = 0.05
) -> dict[str, Any]:
    """Generate DevOps-related events (CI/CD, containers, deployments)."""
    timestamp, is_anomaly = _resolve_params(timestamp, is_anomaly, anomaly_rate)
    event_type = random.choice(["cicd:pipeline", "container:docker", "container:k8s", "deploy:events", "infra:terraform"])

    if event_type == "cicd:pipeline":
        status = "failure" if is_anomaly else random.choice(["success", "success", "success", "running"])
        return {
            "index": "demo_devops",
            "sourcetype": "cicd:pipeline",
            "time": timestamp,
            "event": {
                "repository": random.choice(REPOSITORIES),
                "branch": random.choice(["main", "develop", f"feature/{fake.slug()}"]),
                "pipeline_id": f"pipeline-{fake.uuid4()[:8]}",
                "stage": random.choice(["build", "test", "deploy", "security-scan"]),
                "status": status,
                "duration_ms": random.randint(5000, 300000) if status != "running" else None,
                "triggered_by": fake.user_name(),
                "commit_sha": fake.sha1()[:7],
                "message": fake.sentence() if status == "failure" else None
            }
        }

    elif event_type == "container:docker":
        restart_count = random.randint(5, 20) if is_anomaly else random.randint(0, 2)
        return {
            "index": "demo_devops",
            "sourcetype": "container:docker",
            "time": timestamp,
            "event": {
                "container_name": f"{random.choice(SERVICES)}-{random.randint(1,5)}",
                "container_id": fake.uuid4()[:12],
                "image": f"company/{random.choice(SERVICES)}:v{random.randint(1,3)}.{random.randint(0,9)}.{random.randint(0,99)}",
                "status": random.choice(["running", "running", "running", "exited", "restarting"]),
                "restart_count": restart_count,
                "cpu_percent": round(random.uniform(5, 95 if is_anomaly else 60), 1),
                "memory_percent": round(random.uniform(10, 95 if is_anomaly else 70), 1),
                "host": random.choice(HOSTS)
            }
        }

    elif event_type == "container:k8s":
        return {
            "index": "demo_devops",
            "sourcetype": "container:k8s",
            "time": timestamp,
            "event": {
                "namespace": random.choice(["default", "production", "staging", "monitoring"]),
                "pod_name": f"{random.choice(SERVICES)}-{fake.uuid4()[:8]}",
                "event_type": random.choice(["Normal", "Normal", "Normal", "Warning"]),
                "reason": random.choice(["Pulled", "Created", "Started", "Scheduled", "BackOff", "FailedMount"]),
                "message": fake.sentence(),
                "node": f"node-{random.randint(1, 5)}"
            }
        }

    elif event_type == "deploy:events":
        return {
            "index": "demo_devops",
            "sourcetype": "deploy:events",
            "time": timestamp,
            "event": {
                "service": random.choice(SERVICES),
                "environment": random.choice(ENVIRONMENTS),
                "version": f"v{random.randint(1,3)}.{random.randint(0,9)}.{random.randint(0,99)}",
                "status": "failed" if is_anomaly else random.choice(["success", "success", "success", "in_progress"]),
                "deployed_by": fake.user_name(),
                "deployment_id": f"deploy-{fake.uuid4()[:8]}",
                "rollback": is_anomaly and random.random() < 0.5,
                "duration_s": random.randint(30, 600)
            }
        }

    else:  # infra:terraform
        return {
            "index": "demo_devops",
            "sourcetype": "infra:terraform",
            "time": timestamp,
            "event": {
                "workspace": random.choice(ENVIRONMENTS),
                "action": random.choice(["apply", "plan", "destroy"]),
                "resource_type": random.choice(["aws_instance", "aws_rds_instance", "aws_s3_bucket", "aws_lambda_function"]),
                "resource_name": fake.slug(),
                "changes": {
                    "add": random.randint(0, 5),
                    "change": random.randint(0, 10),
                    "destroy": random.randint(0, 2)
                },
                "initiated_by": fake.user_name()
            }
        }


def generate_sre_event(
    timestamp: float | None = None,
    is_anomaly: bool | None = None,
    anomaly_rate: float = 0.05
) -> dict[str, Any]:
    """Generate SRE-related events (errors, latency, health checks)."""
    timestamp, is_anomaly = _resolve_params(timestamp, is_anomaly, anomaly_rate)
    event_type = random.choice(["app:errors", "metrics:latency", "health:checks", "incident:events", "slo:tracking"])

    if event_type == "app:errors":
        service = random.choice(SERVICES)
        return {
            "index": "demo_sre",
            "sourcetype": "app:errors",
            "time": timestamp,
            "event": {
                "service": service,
                "error_type": random.choice(ERROR_TYPES),
                "severity": "critical" if is_anomaly else random.choice(["warning", "error", "error"]),
                "message": fake.sentence(),
                "stack_trace": f"at {service}.Handler.process({service}.java:{random.randint(50, 500)})\n  at {service}.Service.execute({service}.java:{random.randint(50, 500)})" if random.random() < 0.3 else None,
                "trace_id": f"trace-{fake.uuid4()[:16]}",
                "span_id": f"span-{fake.uuid4()[:8]}",
                "host": random.choice(HOSTS),
                "endpoint": random.choice(ENDPOINTS)
            }
        }

    elif event_type == "metrics:latency":
        base_latency = random.randint(10, 200)
        return {
            "index": "demo_sre",
            "sourcetype": "metrics:latency",
            "time": timestamp,
            "event": {
                "service": random.choice(SERVICES),
                "endpoint": random.choice(ENDPOINTS),
                "method": random.choice(["GET", "GET", "GET", "POST", "PUT", "DELETE"]),
                "status_code": random.choice([500, 502, 503]) if is_anomaly else random.choice([200, 200, 200, 201, 204, 400, 404]),
                "duration_ms": base_latency * random.randint(5, 20) if is_anomaly else base_latency,
                "host": random.choice(HOSTS),
                "trace_id": f"trace-{fake.uuid4()[:16]}"
            }
        }

    elif event_type == "health:checks":
        return {
            "index": "demo_sre",
            "sourcetype": "health:checks",
            "time": timestamp,
            "event": {
                "service": random.choice(SERVICES),
                "check_type": random.choice(["liveness", "readiness", "startup"]),
                "status": "unhealthy" if is_anomaly else "healthy",
                "response_time_ms": random.randint(100, 5000) if is_anomaly else random.randint(1, 100),
                "consecutive_failures": random.randint(3, 10) if is_anomaly else 0,
                "host": random.choice(HOSTS)
            }
        }

    elif event_type == "incident:events":
        return {
            "index": "demo_sre",
            "sourcetype": "incident:events",
            "time": timestamp,
            "event": {
                "incident_id": f"INC-{random.randint(1000, 9999)}",
                "severity": random.choice(["P1", "P2", "P3", "P4"]),
                "status": random.choice(["triggered", "acknowledged", "resolved"]),
                "title": f"High {random.choice(['error rate', 'latency', 'CPU usage', 'memory usage'])} on {random.choice(SERVICES)}",
                "service": random.choice(SERVICES),
                "assigned_to": fake.user_name(),
                "duration_min": random.randint(5, 120)
            }
        }

    else:  # slo:tracking
        target = 99.9
        return {
            "index": "demo_sre",
            "sourcetype": "slo:tracking",
            "time": timestamp,
            "event": {
                "service": random.choice(SERVICES),
                "slo_name": random.choice(["availability", "latency_p99", "error_rate"]),
                "target": target,
                "actual": round(target - random.uniform(1, 5), 2) if is_anomaly else round(target + random.uniform(-0.5, 0.5), 2),
                "budget_remaining_percent": round(random.uniform(0, 30), 1) if is_anomaly else round(random.uniform(50, 100), 1),
                "window": "30d"
            }
        }


def generate_support_event(
    timestamp: float | None = None,
    is_anomaly: bool | None = None,
    anomaly_rate: float = 0.05
) -> dict[str, Any]:
    """Generate Support-related events (sessions, tickets, user errors)."""
    timestamp, is_anomaly = _resolve_params(timestamp, is_anomaly, anomaly_rate)
    event_type = random.choice(["session:trace", "ticket:events", "error:user", "feature:usage"])

    customer_id = f"cust_{random.randint(100, 999)}"
    session_id = f"sess_{fake.uuid4()[:12]}"

    if event_type == "session:trace":
        return {
            "index": "demo_support",
            "sourcetype": "session:trace",
            "time": timestamp,
            "event": {
                "session_id": session_id,
                "user_id": customer_id,
                "customer_tier": random.choice(CUSTOMER_TIERS),
                "page": random.choice(PAGES),
                "action": random.choice(["view", "click", "scroll", "form_submit", "search"]),
                "element": fake.slug() if random.random() < 0.5 else None,
                "duration_ms": random.randint(100, 30000),
                "referrer": random.choice(PAGES + [None]),
                "device": random.choice(["desktop", "mobile", "tablet"]),
                "browser": random.choice(["Chrome", "Firefox", "Safari", "Edge"])
            }
        }

    elif event_type == "ticket:events":
        return {
            "index": "demo_support",
            "sourcetype": "ticket:events",
            "time": timestamp,
            "event": {
                "ticket_id": f"TKT-{random.randint(10000, 99999)}",
                "customer_id": customer_id,
                "customer_tier": random.choice(CUSTOMER_TIERS),
                "status": random.choice(["new", "open", "pending", "resolved", "closed"]),
                "priority": random.choice(["low", "medium", "high", "urgent"]),
                "category": random.choice(["billing", "technical", "account", "feature_request", "bug_report"]),
                "subject": fake.sentence(),
                "assigned_to": fake.user_name() if random.random() < 0.7 else None,
                "response_time_min": random.randint(5, 480)
            }
        }

    elif event_type == "error:user":
        return {
            "index": "demo_support",
            "sourcetype": "error:user",
            "time": timestamp,
            "event": {
                "session_id": session_id,
                "user_id": customer_id,
                "customer_tier": random.choice(CUSTOMER_TIERS),
                "error_code": random.choice(["E001", "E002", "E003", "E004", "E005"]),
                "error_message": random.choice([
                    "Payment processing failed",
                    "Session expired",
                    "Invalid input",
                    "Feature not available",
                    "Service temporarily unavailable"
                ]),
                "page": random.choice(PAGES),
                "is_blocking": is_anomaly,
                "retry_count": random.randint(0, 5)
            }
        }

    else:  # feature:usage
        return {
            "index": "demo_support",
            "sourcetype": "feature:usage",
            "time": timestamp,
            "event": {
                "user_id": customer_id,
                "customer_tier": random.choice(CUSTOMER_TIERS),
                "feature": random.choice(FEATURES),
                "action": random.choice(["enabled", "disabled", "used"]),
                "success": random.random() > 0.1,
                "session_id": session_id
            }
        }


def generate_business_event(
    timestamp: float | None = None,
    is_anomaly: bool | None = None,
    anomaly_rate: float = 0.05
) -> dict[str, Any]:
    """Generate Business/Management events (KPIs, compliance, capacity)."""
    timestamp, is_anomaly = _resolve_params(timestamp, is_anomaly, anomaly_rate)
    event_type = random.choice(["kpi:revenue", "kpi:conversion", "compliance:audit", "capacity:metrics", "sla:tracking"])

    if event_type == "kpi:revenue":
        region = random.choice(REGIONS)
        base_value = random.randint(10000, 100000)
        return {
            "index": "demo_business",
            "sourcetype": "kpi:revenue",
            "time": timestamp,
            "event": {
                "region": region,
                "product_line": random.choice(["enterprise", "professional", "starter", "add-ons"]),
                "period": datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d"),
                "value": base_value,
                "target": int(base_value * random.uniform(0.9, 1.1)),
                "currency": "USD",
                "transaction_count": random.randint(50, 500)
            }
        }

    elif event_type == "kpi:conversion":
        return {
            "index": "demo_business",
            "sourcetype": "kpi:conversion",
            "time": timestamp,
            "event": {
                "funnel_stage": random.choice(["visit", "signup", "trial", "purchase", "renewal"]),
                "source": random.choice(["organic", "paid", "referral", "direct", "social"]),
                "count": random.randint(100, 10000),
                "conversion_rate": round(random.uniform(0.5, 15.0), 2),
                "period": datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")
            }
        }

    elif event_type == "compliance:audit":
        return {
            "index": "demo_business",
            "sourcetype": "compliance:audit",
            "time": timestamp,
            "event": {
                "user": fake.user_name(),
                "action": random.choice(["login", "logout", "config_change", "data_export", "user_create", "permission_change"]),
                "resource": random.choice(["system_config", "user_data", "reports", "api_keys", "integrations"]),
                "ip_address": fake.ipv4(),
                "user_agent": fake.user_agent(),
                "result": random.choice(["success", "success", "success", "denied", "failed"]),
                "details": fake.sentence()
            }
        }

    elif event_type == "capacity:metrics":
        return {
            "index": "demo_business",
            "sourcetype": "capacity:metrics",
            "time": timestamp,
            "event": {
                "host": random.choice(HOSTS),
                "region": random.choice(REGIONS),
                "cpu_percent": round(random.uniform(70, 95) if is_anomaly else random.uniform(20, 60), 1),
                "memory_percent": round(random.uniform(75, 95) if is_anomaly else random.uniform(30, 65), 1),
                "disk_percent": round(random.uniform(80, 98) if is_anomaly else random.uniform(40, 70), 1),
                "network_in_mbps": round(random.uniform(50, 200), 1),
                "network_out_mbps": round(random.uniform(30, 150), 1),
                "active_connections": random.randint(100, 5000)
            }
        }

    else:  # sla:tracking
        return {
            "index": "demo_business",
            "sourcetype": "sla:tracking",
            "time": timestamp,
            "event": {
                "service": random.choice(SERVICES),
                "customer_tier": random.choice(["enterprise", "premium"]),
                "sla_type": random.choice(["uptime", "response_time", "resolution_time"]),
                "target": 99.9,
                "actual": round(99.9 - random.uniform(0.5, 3.0), 2) if is_anomaly else round(random.uniform(99.5, 100.0), 2),
                "breached": is_anomaly,
                "period": datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")
            }
        }


def generate_main_event(
    timestamp: float | None = None,
    is_anomaly: bool | None = None,
    anomaly_rate: float = 0.05
) -> dict[str, Any]:
    """Generate general application log events."""
    timestamp, is_anomaly = _resolve_params(timestamp, is_anomaly, anomaly_rate)
    levels = ["DEBUG", "INFO", "INFO", "INFO", "WARN", "ERROR"]

    return {
        "index": "demo_main",
        "sourcetype": "app:logs",
        "time": timestamp,
        "event": {
            "level": "ERROR" if is_anomaly else random.choice(levels),
            "service": random.choice(SERVICES),
            "message": fake.sentence(),
            "logger": f"com.company.{random.choice(SERVICES).replace('-', '.')}.{fake.word().capitalize()}",
            "thread": f"thread-{random.randint(1, 20)}",
            "host": random.choice(HOSTS),
            "trace_id": f"trace-{fake.uuid4()[:16]}" if random.random() < 0.3 else None
        }
    }


# Generator dispatch table with weights
GENERATORS = [
    (generate_devops_event, 0.20),
    (generate_sre_event, 0.25),
    (generate_support_event, 0.25),
    (generate_business_event, 0.15),
    (generate_main_event, 0.15),
]


def generate_event(
    timestamp: float | None = None,
    is_anomaly: bool | None = None,
    anomaly_rate: float = 0.05
) -> dict[str, Any]:
    """Generate a random event using weighted selection."""
    r = random.random()
    cumulative = 0
    for generator, weight in GENERATORS:
        cumulative += weight
        if r < cumulative:
            return generator(timestamp, is_anomaly, anomaly_rate)
    return generate_main_event(timestamp, is_anomaly, anomaly_rate)
