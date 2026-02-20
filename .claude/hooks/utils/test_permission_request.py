"""Tests for the permission_request hook's server integration."""

import json
import io
import os
import unittest
from unittest.mock import patch, MagicMock


# Import the module under test (hooks/permission_request.py)
# We need to add the parent directory to sys.path since it's not a package.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import permission_request


class TestEventDataConstruction(unittest.TestCase):
    """Tests for the event_data construction in main()."""

    def _run_main_capture_post_event(self, input_data, env=None):
        """Run main() and capture what was passed to post_event.

        Returns (event_data_arg, exit_code).
        """
        stdin_data = json.dumps(input_data)
        captured_event_data = {}

        def fake_post_event(server_url, event_data):
            captured_event_data.update(event_data)
            return None  # Return None so main() exits early

        with (
            patch("sys.stdin", io.StringIO(stdin_data)),
            patch.dict(os.environ, env or {}, clear=False),
            patch("permission_request.log_locally"),
            patch("permission_request.post_event", side_effect=fake_post_event),
        ):
            try:
                permission_request.main()
            except SystemExit:
                pass

        return captured_event_data

    def test_event_has_correct_hook_event_type(self):
        """Event data sets hook_event_type to PermissionRequest."""
        event_data = self._run_main_capture_post_event(
            {"session_id": "sess-1", "tool_name": "Bash"}
        )
        self.assertEqual(event_data["hook_event_type"], "PermissionRequest")

    def test_event_has_session_id(self):
        """Event data includes the session_id from input."""
        event_data = self._run_main_capture_post_event(
            {"session_id": "sess-1"}
        )
        self.assertEqual(event_data["session_id"], "sess-1")

    def test_event_includes_tool_name_when_present(self):
        """Event data includes tool_name when it's in input_data."""
        event_data = self._run_main_capture_post_event(
            {"session_id": "sess-1", "tool_name": "Bash"}
        )
        self.assertEqual(event_data["tool_name"], "Bash")

    def test_event_excludes_tool_name_when_absent(self):
        """Event data omits tool_name when it's not in input_data."""
        event_data = self._run_main_capture_post_event(
            {"session_id": "sess-1"}
        )
        self.assertNotIn("tool_name", event_data)

    def test_event_has_payload(self):
        """Event data includes the full input_data as payload."""
        input_data = {"session_id": "sess-1", "tool_name": "Write", "extra": "data"}
        event_data = self._run_main_capture_post_event(input_data)
        self.assertEqual(event_data["payload"], input_data)

    def test_event_has_timestamp(self):
        """Event data includes a millisecond timestamp."""
        event_data = self._run_main_capture_post_event(
            {"session_id": "sess-1"}
        )
        self.assertIn("timestamp", event_data)
        self.assertIsInstance(event_data["timestamp"], int)
        # Sanity: timestamp should be in milliseconds (> 1 trillion)
        self.assertGreater(event_data["timestamp"], 1_000_000_000_000)

    def test_event_has_source_app(self):
        """Event data sets source_app to claude-code."""
        event_data = self._run_main_capture_post_event(
            {"session_id": "sess-1"}
        )
        self.assertEqual(event_data["source_app"], "claude-code")


class TestLogLocally(unittest.TestCase):
    """Tests for permission_request.log_locally."""

    @patch("permission_request.ensure_session_log_dir")
    def test_creates_new_log_file(self, mock_ensure):
        """Creates a fresh log file when none exists."""
        import tempfile

        with tempfile.TemporaryDirectory() as tmpdir:
            mock_ensure.return_value = Path(tmpdir)
            log_path = Path(tmpdir) / "permission_request.json"

            permission_request.log_locally({"session_id": "s1", "foo": "bar"})

            self.assertTrue(log_path.exists())
            with open(log_path) as f:
                data = json.load(f)
            self.assertEqual(len(data), 1)
            self.assertEqual(data[0]["foo"], "bar")

    @patch("permission_request.ensure_session_log_dir")
    def test_appends_to_existing_log(self, mock_ensure):
        """Appends to an existing log file."""
        import tempfile

        with tempfile.TemporaryDirectory() as tmpdir:
            mock_ensure.return_value = Path(tmpdir)
            log_path = Path(tmpdir) / "permission_request.json"
            # Write initial entry
            with open(log_path, "w") as f:
                json.dump([{"session_id": "s1", "first": True}], f)

            permission_request.log_locally({"session_id": "s1", "second": True})

            with open(log_path) as f:
                data = json.load(f)
            self.assertEqual(len(data), 2)
            self.assertTrue(data[1]["second"])


class TestMainFlow(unittest.TestCase):
    """Integration-style tests for the main() function."""

    def _run_main(self, input_data, env=None):
        """Helper: run main() with given stdin JSON and env vars.

        Returns (exit_code, stdout_output).
        """
        stdin_data = json.dumps(input_data)

        with (
            patch("sys.stdin", io.StringIO(stdin_data)),
            patch.dict(os.environ, env or {}, clear=False),
            patch("permission_request.log_locally"),
        ):
            captured = io.StringIO()
            with patch("sys.stdout", captured):
                try:
                    permission_request.main()
                except SystemExit as e:
                    return (e.code, captured.getvalue())
        return (None, captured.getvalue())

    @patch("permission_request.wait_for_response")
    @patch("permission_request.post_event")
    def test_approve_flow(self, mock_post, mock_wait):
        """Full flow: POST event → poll → approve → hookSpecificOutput."""
        mock_post.return_value = 42
        mock_wait.return_value = {
            "decision": "approve",
            "reason": "Looks good",
        }

        exit_code, stdout = self._run_main(
            {"session_id": "s1", "tool_name": "Write"},
            {"SIANA_SERVER_URL": "http://localhost:8787"},
        )

        self.assertEqual(exit_code, 0)
        output = json.loads(stdout)
        self.assertEqual(
            output["hookSpecificOutput"]["permissionDecision"], "approve"
        )
        self.assertEqual(
            output["hookSpecificOutput"]["permissionDecisionReason"], "Looks good"
        )
        self.assertEqual(
            output["hookSpecificOutput"]["hookEventName"], "PermissionRequest"
        )

    @patch("permission_request.wait_for_response")
    @patch("permission_request.post_event")
    def test_deny_flow(self, mock_post, mock_wait):
        """Full flow: POST event → poll → deny → hookSpecificOutput."""
        mock_post.return_value = 99
        mock_wait.return_value = {
            "decision": "deny",
            "reason": "Not allowed",
        }

        exit_code, stdout = self._run_main({"session_id": "s1"})

        self.assertEqual(exit_code, 0)
        output = json.loads(stdout)
        self.assertEqual(
            output["hookSpecificOutput"]["permissionDecision"], "deny"
        )

    @patch("permission_request.post_event")
    def test_server_unreachable_exits_cleanly(self, mock_post):
        """When the server is unreachable, exit 0 with no output."""
        mock_post.return_value = None

        exit_code, stdout = self._run_main({"session_id": "s1"})

        self.assertEqual(exit_code, 0)
        self.assertEqual(stdout.strip(), "")

    @patch("permission_request.wait_for_response")
    @patch("permission_request.post_event")
    def test_timeout_exits_cleanly(self, mock_post, mock_wait):
        """When poll times out (returns None), exit 0 with no output."""
        mock_post.return_value = 42
        mock_wait.return_value = None

        exit_code, stdout = self._run_main({"session_id": "s1"})

        self.assertEqual(exit_code, 0)
        self.assertEqual(stdout.strip(), "")

    @patch("permission_request.wait_for_response")
    @patch("permission_request.post_event")
    def test_uses_custom_server_url(self, mock_post, mock_wait):
        """Respects the SIANA_SERVER_URL env var."""
        mock_post.return_value = 1
        mock_wait.return_value = {"decision": "approve"}

        self._run_main(
            {"session_id": "s1"},
            {"SIANA_SERVER_URL": "http://custom:9999"},
        )

        mock_post.assert_called_once_with("http://custom:9999", unittest.mock.ANY)
        mock_wait.assert_called_once()
        call_kwargs = mock_wait.call_args
        self.assertEqual(call_kwargs[1]["server_url"], "http://custom:9999")

    @patch("permission_request.wait_for_response")
    @patch("permission_request.post_event")
    def test_reason_defaults_to_empty_string(self, mock_post, mock_wait):
        """When response has no reason field, defaults to empty string."""
        mock_post.return_value = 1
        mock_wait.return_value = {"decision": "approve"}

        exit_code, stdout = self._run_main({"session_id": "s1"})

        output = json.loads(stdout)
        self.assertEqual(
            output["hookSpecificOutput"]["permissionDecisionReason"], ""
        )


if __name__ == "__main__":
    unittest.main()
