"""Tests for splunk_events.hec_client module."""

import json
import os
from unittest.mock import patch, MagicMock

import requests

from splunk_events.hec_client import HECClient, send_to_hec, wait_for_splunk


class TestHECClientInit:
    """Tests for HECClient initialization."""

    def test_default_url(self):
        """Should use default URL when not provided."""
        with patch.dict(os.environ, {}, clear=True):
            client = HECClient()
            assert client.url == "https://splunk:8088"

    def test_custom_url(self):
        """Should use custom URL when provided."""
        client = HECClient(url="https://custom:9999")
        assert client.url == "https://custom:9999"

    def test_url_from_env(self):
        """Should read URL from environment."""
        with patch.dict(os.environ, {"SPLUNK_HEC_URL": "https://env:8088"}):
            client = HECClient()
            assert client.url == "https://env:8088"

    def test_default_token(self):
        """Should use default token when not provided."""
        with patch.dict(os.environ, {}, clear=True):
            client = HECClient()
            assert client.token == "demo-hec-token-12345"

    def test_custom_token(self):
        """Should use custom token when provided."""
        client = HECClient(token="my-token")
        assert client.token == "my-token"

    def test_token_from_env(self):
        """Should read token from environment."""
        with patch.dict(os.environ, {"SPLUNK_HEC_TOKEN": "env-token"}):
            client = HECClient()
            assert client.token == "env-token"

    def test_verify_ssl_default_false(self):
        """Should default verify_ssl to False."""
        with patch.dict(os.environ, {}, clear=True):
            client = HECClient()
            assert client.verify_ssl is False

    def test_verify_ssl_custom(self):
        """Should use custom verify_ssl."""
        client = HECClient(verify_ssl=True)
        assert client.verify_ssl is True

    def test_verify_ssl_from_env_true(self):
        """Should read verify_ssl from environment (true)."""
        with patch.dict(os.environ, {"VERIFY_SSL": "true"}):
            client = HECClient()
            assert client.verify_ssl is True

    def test_verify_ssl_from_env_false(self):
        """Should read verify_ssl from environment (false)."""
        with patch.dict(os.environ, {"VERIFY_SSL": "false"}):
            client = HECClient()
            assert client.verify_ssl is False

    def test_default_host(self):
        """Should use default host."""
        client = HECClient()
        assert client.default_host == "splunk-events"

    def test_custom_default_host(self):
        """Should use custom default host."""
        client = HECClient(default_host="my-host")
        assert client.default_host == "my-host"

    def test_timeout(self):
        """Should use timeout."""
        client = HECClient(timeout=60)
        assert client.timeout == 60


class TestHECClientSend:
    """Tests for HECClient.send method."""

    @patch('splunk_events.hec_client.requests.post')
    def test_send_success(self, mock_post):
        """Should return True on successful send."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        client = HECClient(url="https://test:8088", token="test-token")
        events = [{"index": "test", "sourcetype": "test", "event": {"msg": "hello"}}]

        result = client.send(events)
        assert result is True
        mock_post.assert_called_once()

    @patch('splunk_events.hec_client.requests.post')
    def test_send_failure_status(self, mock_post):
        """Should return False on non-200 status."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Bad Request"
        mock_post.return_value = mock_response

        client = HECClient(url="https://test:8088", token="test-token")
        events = [{"index": "test", "sourcetype": "test", "event": {"msg": "hello"}}]

        result = client.send(events)
        assert result is False

    @patch('splunk_events.hec_client.requests.post')
    def test_send_request_exception(self, mock_post):
        """Should return False on request exception."""
        mock_post.side_effect = requests.exceptions.ConnectionError("Connection failed")

        client = HECClient(url="https://test:8088", token="test-token")
        events = [{"index": "test", "sourcetype": "test", "event": {"msg": "hello"}}]

        result = client.send(events)
        assert result is False

    @patch('splunk_events.hec_client.requests.post')
    def test_send_constructs_correct_url(self, mock_post):
        """Should construct correct URL."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        client = HECClient(url="https://test:8088", token="test-token")
        client.send([{"index": "test", "sourcetype": "test", "event": {}}])

        call_args = mock_post.call_args
        assert call_args[0][0] == "https://test:8088/services/collector/event"

    @patch('splunk_events.hec_client.requests.post')
    def test_send_includes_auth_header(self, mock_post):
        """Should include authorization header."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        client = HECClient(url="https://test:8088", token="my-token")
        client.send([{"index": "test", "sourcetype": "test", "event": {}}])

        call_args = mock_post.call_args
        headers = call_args[1]['headers']
        assert headers['Authorization'] == "Splunk my-token"

    @patch('splunk_events.hec_client.requests.post')
    def test_send_payload_format(self, mock_post):
        """Should format payload correctly."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        client = HECClient(url="https://test:8088", token="test-token", default_host="default-host")
        events = [
            {"index": "idx1", "sourcetype": "st1", "time": 12345.0, "event": {"msg": "hello"}},
            {"index": "idx2", "sourcetype": "st2", "event": {"host": "custom-host", "msg": "world"}},
        ]
        client.send(events)

        call_args = mock_post.call_args
        payload = call_args[1]['data']

        # Payload should be newline-separated JSON
        lines = payload.strip().split('\n')
        assert len(lines) == 2

        # Check first event
        event1 = json.loads(lines[0])
        assert event1['index'] == 'idx1'
        assert event1['sourcetype'] == 'st1'
        assert event1['time'] == 12345.0
        assert event1['host'] == 'default-host'

        # Check second event uses custom host
        event2 = json.loads(lines[1])
        assert event2['host'] == 'custom-host'

    @patch('splunk_events.hec_client.requests.post')
    def test_send_uses_verify_ssl(self, mock_post):
        """Should use verify_ssl setting."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        client = HECClient(verify_ssl=True)
        client.send([{"index": "test", "sourcetype": "test", "event": {}}])

        call_args = mock_post.call_args
        assert call_args[1]['verify'] is True


class TestHECClientWaitUntilReady:
    """Tests for HECClient.wait_until_ready method."""

    @patch('splunk_events.hec_client.time.sleep')
    @patch('splunk_events.hec_client.requests.get')
    def test_wait_success_immediate(self, mock_get, mock_sleep):
        """Should return True if HEC is ready immediately."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        client = HECClient()
        result = client.wait_until_ready(max_retries=5, retry_interval=1)

        assert result is True
        mock_sleep.assert_not_called()

    @patch('splunk_events.hec_client.time.sleep')
    @patch('splunk_events.hec_client.requests.get')
    def test_wait_success_after_retries(self, mock_get, mock_sleep):
        """Should return True after some retries."""
        mock_fail = MagicMock()
        mock_fail.status_code = 503
        mock_success = MagicMock()
        mock_success.status_code = 200

        mock_get.side_effect = [mock_fail, mock_fail, mock_success]

        client = HECClient()
        result = client.wait_until_ready(max_retries=5, retry_interval=1)

        assert result is True
        assert mock_sleep.call_count == 2

    @patch('splunk_events.hec_client.time.sleep')
    @patch('splunk_events.hec_client.requests.get')
    def test_wait_timeout(self, mock_get, mock_sleep):
        """Should return False after max retries."""
        mock_fail = MagicMock()
        mock_fail.status_code = 503
        mock_get.return_value = mock_fail

        client = HECClient()
        result = client.wait_until_ready(max_retries=3, retry_interval=1)

        assert result is False
        assert mock_sleep.call_count == 3

    @patch('splunk_events.hec_client.time.sleep')
    @patch('splunk_events.hec_client.requests.get')
    def test_wait_handles_connection_error(self, mock_get, mock_sleep):
        """Should handle connection errors during wait."""
        mock_get.side_effect = requests.exceptions.ConnectionError()

        client = HECClient()
        result = client.wait_until_ready(max_retries=2, retry_interval=1)

        assert result is False


class TestModuleLevelFunctions:
    """Tests for module-level convenience functions."""

    @patch('splunk_events.hec_client.HECClient.send')
    def test_send_to_hec(self, mock_send):
        """send_to_hec should use default client."""
        mock_send.return_value = True
        events = [{"index": "test", "sourcetype": "test", "event": {}}]

        result = send_to_hec(events)

        assert result is True
        mock_send.assert_called_once_with(events)

    @patch('splunk_events.hec_client.HECClient.wait_until_ready')
    def test_wait_for_splunk(self, mock_wait):
        """wait_for_splunk should use default client."""
        mock_wait.return_value = True

        result = wait_for_splunk(max_retries=10, retry_interval=2)

        assert result is True
        mock_wait.assert_called_once_with(10, 2)
