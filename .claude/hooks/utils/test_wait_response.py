"""Tests for wait_response utility."""

import json
import unittest
from unittest.mock import patch, MagicMock, call
import urllib.error

from utils.wait_response import wait_for_response, format_hook_output


def make_mock_response(status, body):
    """Create a mock HTTP response with given status and JSON body."""
    mock = MagicMock()
    mock.status = status
    mock.read.return_value = json.dumps(body).encode()
    mock.__enter__ = lambda s: s
    mock.__exit__ = MagicMock(return_value=False)
    return mock


class TestWaitForResponse(unittest.TestCase):

    @patch("utils.wait_response.time.sleep")
    @patch("utils.wait_response.urllib.request.urlopen")
    def test_returns_response_on_200(self, mock_urlopen, mock_sleep):
        """Returns the response dict immediately on a 200 response."""
        response_body = {
            "response": {
                "decision": "approve",
                "reason": "Looks good",
                "respondedAt": "2026-01-01T00:00:00Z",
            }
        }
        mock_urlopen.return_value = make_mock_response(200, response_body)

        result = wait_for_response(
            server_url="http://localhost:8787",
            event_id=42,
            timeout=10,
        )

        self.assertEqual(result, response_body["response"])
        mock_sleep.assert_not_called()

    @patch("utils.wait_response.time.time")
    @patch("utils.wait_response.time.sleep")
    @patch("utils.wait_response.urllib.request.urlopen")
    def test_retries_on_404_then_returns(self, mock_urlopen, mock_sleep, mock_time):
        """Retries on 404 and returns response when it eventually appears."""
        # Simulate time progression: start=0, then 1, 2 for loop checks, plus calls inside
        mock_time.side_effect = [0, 0.5, 1.0, 1.5, 2.0]

        response_body = {
            "response": {
                "decision": "deny",
                "reason": "Not allowed",
                "respondedAt": "2026-01-01T00:00:00Z",
            }
        }

        # First two calls: 404, third call: 200
        mock_urlopen.side_effect = [
            urllib.error.HTTPError(
                url="http://localhost:8787/events/42/respond",
                code=404,
                msg="Not Found",
                hdrs=None,
                fp=None,
            ),
            urllib.error.HTTPError(
                url="http://localhost:8787/events/42/respond",
                code=404,
                msg="Not Found",
                hdrs=None,
                fp=None,
            ),
            make_mock_response(200, response_body),
        ]

        result = wait_for_response(
            server_url="http://localhost:8787",
            event_id=42,
            timeout=120,
            poll_interval=1.0,
        )

        self.assertEqual(result, response_body["response"])
        self.assertEqual(mock_sleep.call_count, 2)

    @patch("utils.wait_response.time.time")
    @patch("utils.wait_response.time.sleep")
    @patch("utils.wait_response.urllib.request.urlopen")
    def test_returns_none_on_timeout(self, mock_urlopen, mock_sleep, mock_time):
        """Returns None when timeout elapses without a 200 response."""
        # First call returns 0 (start), subsequent calls exceed timeout
        mock_time.side_effect = [0, 0.5, 200]

        mock_urlopen.side_effect = urllib.error.HTTPError(
            url="http://localhost:8787/events/1/respond",
            code=404,
            msg="Not Found",
            hdrs=None,
            fp=None,
        )

        result = wait_for_response(
            server_url="http://localhost:8787",
            event_id=1,
            timeout=5,
            poll_interval=1.0,
        )

        self.assertIsNone(result)

    @patch("utils.wait_response.time.time")
    @patch("utils.wait_response.time.sleep")
    @patch("utils.wait_response.urllib.request.urlopen")
    def test_handles_connection_errors_gracefully(self, mock_urlopen, mock_sleep, mock_time):
        """Retries on connection errors instead of crashing."""
        mock_time.side_effect = [0, 0.5, 1.0, 1.5, 2.0]

        response_body = {
            "response": {
                "decision": "approve",
                "reason": "",
                "respondedAt": "2026-01-01T00:00:00Z",
            }
        }

        # First call: connection refused, second call: success
        mock_urlopen.side_effect = [
            urllib.error.URLError("Connection refused"),
            make_mock_response(200, response_body),
        ]

        result = wait_for_response(
            server_url="http://localhost:8787",
            event_id=10,
            timeout=120,
            poll_interval=1.0,
        )

        self.assertEqual(result, response_body["response"])
        self.assertEqual(mock_sleep.call_count, 1)

    @patch("utils.wait_response.time.time")
    @patch("utils.wait_response.time.sleep")
    @patch("utils.wait_response.urllib.request.urlopen")
    def test_handles_unexpected_http_status(self, mock_urlopen, mock_sleep, mock_time):
        """Logs and retries on unexpected HTTP status codes."""
        mock_time.side_effect = [0, 0.5, 1.0, 1.5]

        response_body = {
            "response": {"decision": "approve", "reason": "", "respondedAt": "2026-01-01T00:00:00Z"}
        }

        mock_urlopen.side_effect = [
            urllib.error.HTTPError(
                url="http://localhost:8787/events/5/respond",
                code=500,
                msg="Internal Server Error",
                hdrs=None,
                fp=None,
            ),
            make_mock_response(200, response_body),
        ]

        result = wait_for_response(
            server_url="http://localhost:8787",
            event_id=5,
            timeout=120,
        )

        self.assertEqual(result, response_body["response"])


class TestFormatHookOutput(unittest.TestCase):

    def test_returns_correct_structure(self):
        """format_hook_output returns the expected hookSpecificOutput dict."""
        result = format_hook_output(
            hook_event_name="PreToolUse",
            decision="approve",
            reason="User approved",
        )

        self.assertEqual(result, {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "approve",
                "permissionDecisionReason": "User approved",
            }
        })

    def test_default_empty_reason(self):
        """format_hook_output defaults reason to empty string."""
        result = format_hook_output(
            hook_event_name="PostToolUse",
            decision="deny",
        )

        self.assertEqual(
            result["hookSpecificOutput"]["permissionDecisionReason"], ""
        )


if __name__ == "__main__":
    unittest.main()
