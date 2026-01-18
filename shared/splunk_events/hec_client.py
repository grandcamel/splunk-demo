"""Splunk HTTP Event Collector (HEC) client."""

import json
import os
import time
from typing import Any

import requests


class HECClient:
    """Client for sending events to Splunk HEC."""

    def __init__(
        self,
        url: str | None = None,
        token: str | None = None,
        verify_ssl: bool | None = None,
        default_host: str = "splunk-events",
        timeout: int = 30
    ):
        self.url = url or os.environ.get("SPLUNK_HEC_URL", "https://splunk:8088")
        self.token = token or os.environ.get("SPLUNK_HEC_TOKEN", "demo-hec-token-12345")
        if verify_ssl is None:
            verify_ssl = os.environ.get("VERIFY_SSL", "false").lower() == "true"
        self.verify_ssl = verify_ssl
        self.default_host = default_host
        self.timeout = timeout

    def send(self, events: list[dict[str, Any]]) -> bool:
        """Send events to Splunk HEC.

        Args:
            events: List of event dicts with keys: index, sourcetype, time, event

        Returns:
            True if successful, False otherwise
        """
        url = f"{self.url}/services/collector/event"
        headers = {
            "Authorization": f"Splunk {self.token}",
            "Content-Type": "application/json"
        }

        payload = ""
        for event_data in events:
            hec_event = {
                "index": event_data["index"],
                "sourcetype": event_data["sourcetype"],
                "time": event_data.get("time", time.time()),
                "host": event_data["event"].get("host", self.default_host),
                "event": event_data["event"]
            }
            payload += json.dumps(hec_event) + "\n"

        try:
            response = requests.post(
                url,
                headers=headers,
                data=payload,
                verify=self.verify_ssl,
                timeout=self.timeout
            )
            if response.status_code != 200:
                print(f"HEC error: {response.status_code} - {response.text}")
                return False
            return True
        except requests.exceptions.RequestException as e:
            print(f"HEC connection error: {e}")
            return False

    def wait_until_ready(self, max_retries: int = 120, retry_interval: int = 5) -> bool:
        """Wait for Splunk HEC to be available.

        Args:
            max_retries: Maximum number of retries
            retry_interval: Seconds between retries

        Returns:
            True if HEC is ready, False if timeout
        """
        print("Waiting for Splunk HEC to be available...")
        retries = 0

        while retries < max_retries:
            try:
                response = requests.get(
                    f"{self.url}/services/collector/health",
                    headers={"Authorization": f"Splunk {self.token}"},
                    verify=self.verify_ssl,
                    timeout=5
                )
                if response.status_code == 200:
                    print("Splunk HEC is ready!")
                    return True
            except requests.exceptions.RequestException:
                pass
            retries += 1
            if retries % 12 == 0:
                print(f"  Still waiting... ({retries * retry_interval}s)")
            time.sleep(retry_interval)

        print(f"ERROR: Splunk HEC not available after {max_retries * retry_interval}s")
        return False


# Module-level convenience functions using default client
_default_client: HECClient | None = None


def _get_default_client() -> HECClient:
    global _default_client
    if _default_client is None:
        _default_client = HECClient()
    return _default_client


def send_to_hec(events: list[dict[str, Any]]) -> bool:
    """Send events to Splunk HEC using default client."""
    return _get_default_client().send(events)


def wait_for_splunk(max_retries: int = 120, retry_interval: int = 5) -> bool:
    """Wait for Splunk HEC using default client."""
    return _get_default_client().wait_until_ready(max_retries, retry_interval)
