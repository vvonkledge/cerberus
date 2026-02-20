"""Tests for the pre_tool_use hook's server integration."""

import json
import io
import os
import unittest
from unittest.mock import patch, MagicMock

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pre_tool_use


def _make_input(tool_name="Bash", command="echo hello", tool_use_id="tu-123", session_id="sess-1"):
    """Build a typical PreToolUse input_data dict."""
    data = {
        "session_id": session_id,
        "tool_name": tool_name,
        "tool_use_id": tool_use_id,
        "hook_event_name": "PreToolUse",
        "tool_input": {"command": command},
    }
    return data


def _run_main(input_data, env=None):
    """Run pre_tool_use.main() with given stdin JSON and env vars.

    Returns (exit_code, stdout_output).
    """
    stdin_data = json.dumps(input_data)

    with (
        patch("sys.stdin", io.StringIO(stdin_data)),
        patch.dict(os.environ, env or {}, clear=False),
        patch("pre_tool_use.ensure_session_log_dir") as mock_ensure,
    ):
        # Create a temporary directory for log files
        import tempfile
        tmpdir = tempfile.mkdtemp()
        mock_ensure.return_value = Path(tmpdir)

        captured = io.StringIO()
        with patch("sys.stdout", captured):
            try:
                pre_tool_use.main()
            except SystemExit as e:
                return (e.code, captured.getvalue())
    return (None, captured.getvalue())


class TestServerIntegration(unittest.TestCase):
    """Tests for the server integration added to pre_tool_use."""

    @patch("pre_tool_use.post_event")
    def test_posts_event_to_server(self, mock_post):
        """Verifies post_event is called with correct event_data after local logging."""
        mock_post.return_value = None  # No HITL

        input_data = _make_input()
        _run_main(input_data, {"SIANA_SERVER_URL": "http://localhost:8787"})

        mock_post.assert_called_once()
        call_args = mock_post.call_args
        server_url = call_args[0][0]
        event_data = call_args[0][1]

        self.assertEqual(server_url, "http://localhost:8787")
        self.assertEqual(event_data["hook_event_type"], "PreToolUse")
        self.assertEqual(event_data["session_id"], "sess-1")
        self.assertEqual(event_data["source_app"], "claude-code")
        self.assertIn("timestamp", event_data)
        self.assertEqual(event_data["payload"], input_data)

    @patch("pre_tool_use.post_event")
    def test_includes_tool_name_in_event(self, mock_post):
        """Verifies tool_name is forwarded in event_data."""
        mock_post.return_value = None

        _run_main(_make_input(tool_name="Write"))

        event_data = mock_post.call_args[0][1]
        self.assertEqual(event_data["tool_name"], "Write")

    @patch("pre_tool_use.post_event")
    def test_includes_tool_use_id_in_event(self, mock_post):
        """Verifies tool_use_id is forwarded in event_data."""
        mock_post.return_value = None

        _run_main(_make_input(tool_use_id="tu-abc"))

        event_data = mock_post.call_args[0][1]
        self.assertEqual(event_data["tool_use_id"], "tu-abc")

    @patch("pre_tool_use.wait_for_response")
    @patch("pre_tool_use.post_event")
    def test_does_not_poll_when_hitl_disabled(self, mock_post, mock_wait):
        """When SIANA_PRETOOLUSE_HITL is not set, wait_for_response is NOT called."""
        mock_post.return_value = 42

        _run_main(_make_input())

        mock_wait.assert_not_called()

    @patch("pre_tool_use.wait_for_response")
    @patch("pre_tool_use.post_event")
    def test_polls_when_hitl_enabled(self, mock_post, mock_wait):
        """When SIANA_PRETOOLUSE_HITL=1, polls and outputs approve decision."""
        mock_post.return_value = 42
        mock_wait.return_value = {
            "decision": "approve",
            "reason": "Looks good",
        }

        exit_code, stdout = _run_main(
            _make_input(),
            {"SIANA_PRETOOLUSE_HITL": "1"},
        )

        self.assertEqual(exit_code, 0)
        mock_wait.assert_called_once()
        output = json.loads(stdout)
        self.assertEqual(output["hookSpecificOutput"]["permissionDecision"], "approve")
        self.assertEqual(output["hookSpecificOutput"]["hookEventName"], "PreToolUse")

    @patch("pre_tool_use.wait_for_response")
    @patch("pre_tool_use.post_event")
    def test_deny_via_hitl(self, mock_post, mock_wait):
        """When HITL returns deny, hookSpecificOutput has deny decision."""
        mock_post.return_value = 42
        mock_wait.return_value = {
            "decision": "deny",
            "reason": "Not allowed",
        }

        exit_code, stdout = _run_main(
            _make_input(),
            {"SIANA_PRETOOLUSE_HITL": "1"},
        )

        self.assertEqual(exit_code, 0)
        output = json.loads(stdout)
        self.assertEqual(output["hookSpecificOutput"]["permissionDecision"], "deny")
        self.assertEqual(output["hookSpecificOutput"]["permissionDecisionReason"], "Not allowed")

    @patch("pre_tool_use.post_event")
    def test_server_failure_exits_cleanly(self, mock_post):
        """When post_event returns None, exit 0 with no hookSpecificOutput."""
        mock_post.return_value = None

        exit_code, stdout = _run_main(_make_input())

        self.assertEqual(exit_code, 0)
        self.assertEqual(stdout.strip(), "")

    @patch("pre_tool_use.wait_for_response")
    @patch("pre_tool_use.post_event")
    def test_hitl_timeout_exits_cleanly(self, mock_post, mock_wait):
        """When wait_for_response returns None, exit 0 with no hookSpecificOutput."""
        mock_post.return_value = 42
        mock_wait.return_value = None

        exit_code, stdout = _run_main(
            _make_input(),
            {"SIANA_PRETOOLUSE_HITL": "1"},
        )

        self.assertEqual(exit_code, 0)
        self.assertEqual(stdout.strip(), "")

    @patch("pre_tool_use.post_event")
    def test_safety_checks_run_before_server(self, mock_post):
        """Dangerous rm commands are still blocked even when server is configured."""
        mock_post.return_value = 42

        input_data = {
            "session_id": "sess-1",
            "tool_name": "Bash",
            "tool_use_id": "tu-1",
            "hook_event_name": "PreToolUse",
            "tool_input": {"command": "rm -rf /"},
        }

        exit_code, stdout = _run_main(
            input_data,
            {"SIANA_SERVER_URL": "http://localhost:8787"},
        )

        self.assertEqual(exit_code, 0)
        output = json.loads(stdout)
        self.assertEqual(output["hookSpecificOutput"]["permissionDecision"], "deny")
        # Safety block should happen BEFORE server integration
        mock_post.assert_not_called()


if __name__ == "__main__":
    unittest.main()
