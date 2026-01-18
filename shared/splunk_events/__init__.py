"""Shared Splunk event generation library."""

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
from .generators import (
    generate_devops_event,
    generate_sre_event,
    generate_support_event,
    generate_business_event,
    generate_main_event,
    generate_event,
    GENERATORS,
)
from .hec_client import (
    send_to_hec,
    wait_for_splunk,
    HECClient,
)

__all__ = [
    # Templates
    "SERVICES",
    "REPOSITORIES",
    "ENVIRONMENTS",
    "ERROR_TYPES",
    "ENDPOINTS",
    "PAGES",
    "FEATURES",
    "CUSTOMER_TIERS",
    "REGIONS",
    "HOSTS",
    # Generators
    "generate_devops_event",
    "generate_sre_event",
    "generate_support_event",
    "generate_business_event",
    "generate_main_event",
    "generate_event",
    "GENERATORS",
    # HEC Client
    "send_to_hec",
    "wait_for_splunk",
    "HECClient",
]
