"""Tests for the subagent_start hook's server integration."""

import json
import io
import os
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

# Import the module under test (hooks/subagent_start.py)
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import subagent_start


class TestEventDataConstruction(unittest.TestCase):
    """Tests for the event_data construction in main()."""

    def _run_main_capture_post_event(self, input_data, env=None):
        """Run main() and capture what was passed to post_event.

        Returns event_data_arg dict.
        """
        stdin_data = json.dumps(input_data)
        captured_event_data = {}

        def fake_post_event(server_url, event_data):
            captured_event_data.update(event_data)
            return None

        with (
            patch("sys.stdin", io.StringIO(stdin_data)),
            patch.dict(os.environ, env or {}, clear=False),
            patch("subagent_start.post_event", side_effect=fake_post_event),
            patch("subagent_start.ensure_session_log_dir") as mock_dir,
        ):
            mock_dir.return_value = Path(tempfile.mkdtemp())
            try:
                subagent_start.main()
            except SystemExit:
                pass

        return captured_event_data

    def test_event_has_correct_hook_event_type(self):
        """Event data sets hook_event_type to SubagentStart."""
        event_data = self._run_main_capture_post_event(
            {"session_id": "sess-1"}
        )
        self.assertEqual(event_data["hook_event_type"], "SubagentStart")

    def test_event_has_session_id(self):
        """Event data includes the session_id from input."""
        event_data = self._run_main_capture_post_event(
            {"session_id": "sess-77"}
        )
        self.assertEqual(event_data["session_id"], "sess-77")

    def test_event_has_source_app(self):
        """Event data sets source_app to claude-code."""
        event_data = self._run_main_capture_post_event(
            {"session_id": "sess-1"}
        )
        self.assertEqual(event_data["source_app"], "claude-code")

    def test_event_has_timestamp(self):
        """Event data includes a millisecond timestamp."""
        event_data = self._run_main_capture_post_event(
            {"session_id": "sess-1"}
        )
        self.assertIn("timestamp", event_data)
        self.assertIsInstance(event_data["timestamp"], int)
        self.assertGreater(event_data["timestamp"], 1_000_000_000_000)

    def test_event_has_payload(self):
        """Event data includes the full input_data as payload."""
        input_data = {"session_id": "sess-1", "tool_name": "Bash", "extra": "val"}
        event_data = self._run_main_capture_post_event(input_data)
        self.assertEqual(event_data["payload"], input_data)

    def test_uses_custom_server_url(self):
        """Respects the SIANA_SERVER_URL env var."""
        captured_url = {}

        def fake_post_event(server_url, event_data):
            captured_url["url"] = server_url
            return None

        stdin_data = json.dumps({"session_id": "sess-1"})
        with (
            patch("sys.stdin", io.StringIO(stdin_data)),
            patch.dict(os.environ, {"SIANA_SERVER_URL": "http://custom:9999"}, clear=False),
            patch("subagent_start.post_event", side_effect=fake_post_event),
            patch("subagent_start.ensure_session_log_dir") as mock_dir,
        ):
            mock_dir.return_value = Path(tempfile.mkdtemp())
            try:
                subagent_start.main()
            except SystemExit:
                pass

        self.assertEqual(captured_url["url"], "http://custom:9999")


class TestServerUnreachable(unittest.TestCase):
    """Tests for graceful handling when the server is down."""

    def test_exits_cleanly_when_server_unreachable(self):
        """Hook exits with code 0 when server is unreachable."""
        stdin_data = json.dumps({"session_id": "sess-1"})

        with (
            patch("sys.stdin", io.StringIO(stdin_data)),
            patch("subagent_start.post_event", return_value=None),
            patch("subagent_start.ensure_session_log_dir") as mock_dir,
        ):
            mock_dir.return_value = Path(tempfile.mkdtemp())
            try:
                subagent_start.main()
            except SystemExit as e:
                self.assertEqual(e.code, 0)

    def test_local_log_still_written_when_server_down(self):
        """Local log file is written even when post_event returns None."""
        input_data = {"session_id": "sess-1", "tool_name": "Bash"}
        stdin_data = json.dumps(input_data)

        with tempfile.TemporaryDirectory() as tmpdir:
            with (
                patch("sys.stdin", io.StringIO(stdin_data)),
                patch("subagent_start.post_event", return_value=None),
                patch("subagent_start.ensure_session_log_dir") as mock_dir,
            ):
                mock_dir.return_value = Path(tmpdir)
                try:
                    subagent_start.main()
                except SystemExit:
                    pass

            log_path = Path(tmpdir) / "subagent_start.json"
            self.assertTrue(log_path.exists())
            with open(log_path) as f:
                data = json.load(f)
            self.assertEqual(len(data), 1)
            self.assertEqual(data[0]["session_id"], "sess-1")


if __name__ == "__main__":
    unittest.main()
