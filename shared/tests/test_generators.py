"""Tests for splunk_events.generators module."""

import time
from unittest.mock import patch

import pytest

from splunk_events.generators import (
    _resolve_params,
    generate_devops_event,
    generate_sre_event,
    generate_support_event,
    generate_business_event,
    generate_main_event,
    generate_event,
    GENERATORS,
)


class TestResolveParams:
    """Tests for _resolve_params helper function."""

    def test_uses_provided_timestamp(self):
        """Should use provided timestamp instead of current time."""
        custom_ts = 1000000.0
        timestamp, _ = _resolve_params(custom_ts, None, 0.05)
        assert timestamp == custom_ts

    def test_generates_timestamp_when_none(self):
        """Should generate current timestamp when None provided."""
        before = time.time()
        timestamp, _ = _resolve_params(None, None, 0.05)
        after = time.time()
        assert before <= timestamp <= after

    def test_uses_provided_is_anomaly_true(self):
        """Should use provided is_anomaly=True."""
        _, is_anomaly = _resolve_params(None, True, 0.05)
        assert is_anomaly is True

    def test_uses_provided_is_anomaly_false(self):
        """Should use provided is_anomaly=False."""
        _, is_anomaly = _resolve_params(None, False, 0.95)
        assert is_anomaly is False

    @patch('splunk_events.generators.random.random')
    def test_generates_anomaly_based_on_rate_below(self, mock_random):
        """Should generate anomaly when random < anomaly_rate."""
        mock_random.return_value = 0.04
        _, is_anomaly = _resolve_params(None, None, 0.05)
        assert is_anomaly is True

    @patch('splunk_events.generators.random.random')
    def test_generates_anomaly_based_on_rate_above(self, mock_random):
        """Should not generate anomaly when random >= anomaly_rate."""
        mock_random.return_value = 0.06
        _, is_anomaly = _resolve_params(None, None, 0.05)
        assert is_anomaly is False


class TestEventStructure:
    """Tests for required event structure across all generators."""

    REQUIRED_KEYS = {'index', 'sourcetype', 'time', 'event'}

    def test_devops_event_has_required_keys(self):
        """DevOps events should have all required keys."""
        event = generate_devops_event()
        assert self.REQUIRED_KEYS.issubset(event.keys())

    def test_sre_event_has_required_keys(self):
        """SRE events should have all required keys."""
        event = generate_sre_event()
        assert self.REQUIRED_KEYS.issubset(event.keys())

    def test_support_event_has_required_keys(self):
        """Support events should have all required keys."""
        event = generate_support_event()
        assert self.REQUIRED_KEYS.issubset(event.keys())

    def test_business_event_has_required_keys(self):
        """Business events should have all required keys."""
        event = generate_business_event()
        assert self.REQUIRED_KEYS.issubset(event.keys())

    def test_main_event_has_required_keys(self):
        """Main events should have all required keys."""
        event = generate_main_event()
        assert self.REQUIRED_KEYS.issubset(event.keys())

    def test_generic_event_has_required_keys(self):
        """Generic generate_event should have all required keys."""
        event = generate_event()
        assert self.REQUIRED_KEYS.issubset(event.keys())

    def test_event_field_is_dict(self):
        """Event field should be a dictionary."""
        event = generate_devops_event()
        assert isinstance(event['event'], dict)

    def test_time_is_float(self):
        """Time field should be a float."""
        event = generate_devops_event()
        assert isinstance(event['time'], float)


class TestDevopsEvent:
    """Tests for generate_devops_event."""

    def test_index_is_demo_devops(self):
        """Index should be demo_devops."""
        event = generate_devops_event()
        assert event['index'] == 'demo_devops'

    def test_sourcetype_is_valid(self):
        """Sourcetype should be one of the DevOps types."""
        valid_types = {'cicd:pipeline', 'container:docker', 'container:k8s',
                       'deploy:events', 'infra:terraform'}
        event = generate_devops_event()
        assert event['sourcetype'] in valid_types

    def test_custom_timestamp_used(self):
        """Custom timestamp should be used."""
        custom_ts = 1234567890.0
        event = generate_devops_event(timestamp=custom_ts)
        assert event['time'] == custom_ts

    def test_cicd_anomaly_has_failure_status(self):
        """CI/CD anomaly should have failure status."""
        # Generate many events to hit cicd:pipeline
        for _ in range(50):
            event = generate_devops_event(is_anomaly=True)
            if event['sourcetype'] == 'cicd:pipeline':
                assert event['event']['status'] == 'failure'
                break


class TestSreEvent:
    """Tests for generate_sre_event."""

    def test_index_is_demo_sre(self):
        """Index should be demo_sre."""
        event = generate_sre_event()
        assert event['index'] == 'demo_sre'

    def test_sourcetype_is_valid(self):
        """Sourcetype should be one of the SRE types."""
        valid_types = {'app:errors', 'metrics:latency', 'health:checks',
                       'incident:events', 'slo:tracking'}
        event = generate_sre_event()
        assert event['sourcetype'] in valid_types

    def test_health_check_anomaly_is_unhealthy(self):
        """Health check anomaly should be unhealthy."""
        for _ in range(50):
            event = generate_sre_event(is_anomaly=True)
            if event['sourcetype'] == 'health:checks':
                assert event['event']['status'] == 'unhealthy'
                break

    def test_metrics_latency_anomaly_has_error_status(self):
        """Metrics latency anomaly should have error status code."""
        for _ in range(50):
            event = generate_sre_event(is_anomaly=True)
            if event['sourcetype'] == 'metrics:latency':
                assert event['event']['status_code'] in [500, 502, 503]
                break


class TestSupportEvent:
    """Tests for generate_support_event."""

    def test_index_is_demo_support(self):
        """Index should be demo_support."""
        event = generate_support_event()
        assert event['index'] == 'demo_support'

    def test_sourcetype_is_valid(self):
        """Sourcetype should be one of the Support types."""
        valid_types = {'session:trace', 'ticket:events', 'error:user', 'feature:usage'}
        event = generate_support_event()
        assert event['sourcetype'] in valid_types

    def test_error_user_anomaly_is_blocking(self):
        """Error user anomaly should be blocking."""
        for _ in range(50):
            event = generate_support_event(is_anomaly=True)
            if event['sourcetype'] == 'error:user':
                assert event['event']['is_blocking'] is True
                break


class TestBusinessEvent:
    """Tests for generate_business_event."""

    def test_index_is_demo_business(self):
        """Index should be demo_business."""
        event = generate_business_event()
        assert event['index'] == 'demo_business'

    def test_sourcetype_is_valid(self):
        """Sourcetype should be one of the Business types."""
        valid_types = {'kpi:revenue', 'kpi:conversion', 'compliance:audit',
                       'capacity:metrics', 'sla:tracking'}
        event = generate_business_event()
        assert event['sourcetype'] in valid_types

    def test_capacity_anomaly_has_high_usage(self):
        """Capacity anomaly should have high CPU/memory usage."""
        for _ in range(50):
            event = generate_business_event(is_anomaly=True)
            if event['sourcetype'] == 'capacity:metrics':
                # Anomaly should have high usage (70-95 for CPU)
                assert event['event']['cpu_percent'] >= 70
                break

    def test_sla_anomaly_is_breached(self):
        """SLA anomaly should be breached."""
        for _ in range(50):
            event = generate_business_event(is_anomaly=True)
            if event['sourcetype'] == 'sla:tracking':
                assert event['event']['breached'] is True
                break


class TestMainEvent:
    """Tests for generate_main_event."""

    def test_index_is_demo_main(self):
        """Index should be demo_main."""
        event = generate_main_event()
        assert event['index'] == 'demo_main'

    def test_sourcetype_is_app_logs(self):
        """Sourcetype should be app:logs."""
        event = generate_main_event()
        assert event['sourcetype'] == 'app:logs'

    def test_anomaly_has_error_level(self):
        """Anomaly should have ERROR level."""
        event = generate_main_event(is_anomaly=True)
        assert event['event']['level'] == 'ERROR'

    def test_normal_has_valid_level(self):
        """Normal event should have valid log level."""
        valid_levels = {'DEBUG', 'INFO', 'WARN', 'ERROR'}
        event = generate_main_event(is_anomaly=False)
        assert event['event']['level'] in valid_levels


class TestGenerateEvent:
    """Tests for generic generate_event function."""

    def test_returns_valid_event(self):
        """Should return a valid event dict."""
        event = generate_event()
        assert isinstance(event, dict)
        assert 'index' in event
        assert 'sourcetype' in event

    def test_respects_timestamp(self):
        """Should respect provided timestamp."""
        custom_ts = 1000000.0
        event = generate_event(timestamp=custom_ts)
        assert event['time'] == custom_ts

    def test_respects_is_anomaly(self):
        """Should respect provided is_anomaly."""
        # Test with main event for predictable behavior
        event = generate_main_event(is_anomaly=True)
        assert event['event']['level'] == 'ERROR'


class TestGeneratorsDispatchTable:
    """Tests for GENERATORS dispatch table."""

    def test_weights_sum_to_one(self):
        """Generator weights should sum to 1.0."""
        total = sum(weight for _, weight in GENERATORS)
        assert abs(total - 1.0) < 0.01

    def test_all_generators_callable(self):
        """All generators should be callable."""
        for generator, _ in GENERATORS:
            assert callable(generator)

    def test_all_generators_return_dict(self):
        """All generators should return a dict."""
        for generator, _ in GENERATORS:
            result = generator()
            assert isinstance(result, dict)
