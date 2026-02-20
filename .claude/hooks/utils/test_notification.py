"""Tests for the notification hook's server integration."""

import json
import io
import os
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path

# Import the module under test (hooks/notification.py)
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import notification


class TestEventDataConstruction(unittest.TestCase):
    """Tests for the event_data construction in main()."""

    def _run_main_capture_post_event(self, input_data, env=None, argv=None):
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
            patch("sys.argv", argv or ["notification.py"]),
            patch.dict(os.environ, env or {}, clear=False),
            patch("notification.post_event", side_effect=fake_post_event),
            patch("notification.ensure_session_log_dir") as mock_dir,
        ):
            mock_dir.return_value = Path(tempfile.mkdtemp())
            try:
                notification.main()
            except SystemExit:
                pass

        return captured_event_data

    def test_event_has_correct_hook_event_type(self):
        """Event data sets hook_event_type to Notification."""
        event_data = self._run_main_capture_post_event(
            {"session_id": "sess-1", "message": "hello"}
        )
        self.assertEqual(event_data["hook_event_type"], "Notification")

    def test_event_has_session_id(self):
        """Event data includes the session_id from input."""
        event_data = self._run_main_capture_post_event(
            {"session_id": "sess-42"}
        )
        self.assertEqual(event_data["session_id"], "sess-42")

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
        input_data = {"session_id": "sess-1", "message": "test", "title": "t"}
        event_data = self._run_main_capture_post_event(input_data)
        self.assertEqual(event_data["payload"], input_data)

    def test_event_sent_regardless_of_notify_flag(self):
        """Server forwarding happens even without --notify flag."""
        event_data = self._run_main_capture_post_event(
            {"session_id": "sess-1"},
            argv=["notification.py"],  # no --notify
        )
        self.assertEqual(event_data["hook_event_type"], "Notification")


class TestServerUnreachable(unittest.TestCase):
    """Tests for graceful handling when the server is down."""

    def _run_main(self, input_data, argv=None):
        """Run main() with post_event returning None. Returns exit code."""
        stdin_data = json.dumps(input_data)

        with (
            patch("sys.stdin", io.StringIO(stdin_data)),
            patch("sys.argv", argv or ["notification.py"]),
            patch("notification.post_event", return_value=None),
            patch("notification.ensure_session_log_dir") as mock_dir,
        ):
            mock_dir.return_value = Path(tempfile.mkdtemp())
            try:
                notification.main()
            except SystemExit as e:
                return e.code
        return None

    def test_exits_cleanly_when_server_unreachable(self):
        """Hook exits with code 0 when server is unreachable."""
        exit_code = self._run_main({"session_id": "sess-1"})
        self.assertEqual(exit_code, 0)

    def test_local_log_still_written_when_server_down(self):
        """Local log file is written even when post_event returns None."""
        input_data = {"session_id": "sess-1", "message": "hello"}
        stdin_data = json.dumps(input_data)

        with tempfile.TemporaryDirectory() as tmpdir:
            with (
                patch("sys.stdin", io.StringIO(stdin_data)),
                patch("sys.argv", ["notification.py"]),
                patch("notification.post_event", return_value=None),
                patch("notification.ensure_session_log_dir") as mock_dir,
            ):
                mock_dir.return_value = Path(tmpdir)
                try:
                    notification.main()
                except SystemExit:
                    pass

            log_path = Path(tmpdir) / "notification.json"
            self.assertTrue(log_path.exists())
            with open(log_path) as f:
                data = json.load(f)
            self.assertEqual(len(data), 1)

    def test_tts_still_called_when_server_down(self):
        """TTS announce still runs when server is unreachable and --notify is set."""
        input_data = {
            "session_id": "sess-1",
            "notification_type": "permission_prompt",
        }
        stdin_data = json.dumps(input_data)

        with (
            patch("sys.stdin", io.StringIO(stdin_data)),
            patch("sys.argv", ["notification.py", "--notify"]),
            patch("notification.post_event", return_value=None),
            patch("notification.ensure_session_log_dir") as mock_dir,
            patch("notification.announce_notification") as mock_tts,
        ):
            mock_dir.return_value = Path(tempfile.mkdtemp())
            try:
                notification.main()
            except SystemExit:
                pass

            mock_tts.assert_called_once()


if __name__ == "__main__":
    unittest.main()
