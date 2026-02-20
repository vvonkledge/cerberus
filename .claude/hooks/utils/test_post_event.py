"""Tests for the post_event shared utility."""

import json
import unittest
from unittest.mock import patch, MagicMock
import urllib.error

from utils.post_event import post_event


def make_mock_urlopen_response(status, body):
    """Create a mock HTTP response with given status and JSON body."""
    mock = MagicMock()
    mock.status = status
    mock.read.return_value = json.dumps(body).encode()
    mock.__enter__ = lambda s: s
    mock.__exit__ = MagicMock(return_value=False)
    return mock


class TestPostEvent(unittest.TestCase):

    @patch("utils.post_event.urllib.request.urlopen")
    def test_returns_event_id_on_201(self, mock_urlopen):
        """Returns the server-assigned event ID on a 201 response."""
        mock_urlopen.return_value = make_mock_urlopen_response(201, {"id": 42})

        result = post_event("http://localhost:8787", {"source_app": "claude-code"})
        self.assertEqual(result, 42)

    @patch("utils.post_event.urllib.request.urlopen")
    def test_returns_event_id_on_200(self, mock_urlopen):
        """Returns the server-assigned event ID on a 200 response."""
        mock_urlopen.return_value = make_mock_urlopen_response(200, {"id": 7})

        result = post_event("http://localhost:8787", {"source_app": "claude-code"})
        self.assertEqual(result, 7)

    @patch("utils.post_event.urllib.request.urlopen")
    def test_returns_none_on_connection_error(self, mock_urlopen):
        """Returns None when the server is unreachable."""
        mock_urlopen.side_effect = urllib.error.URLError("Connection refused")

        result = post_event("http://localhost:8787", {"source_app": "claude-code"})
        self.assertIsNone(result)

    @patch("utils.post_event.urllib.request.urlopen")
    def test_returns_none_on_http_error(self, mock_urlopen):
        """Returns None on a non-success HTTP status."""
        mock_urlopen.side_effect = urllib.error.HTTPError(
            url="http://localhost:8787/events",
            code=500,
            msg="Internal Server Error",
            hdrs=None,
            fp=None,
        )

        result = post_event("http://localhost:8787", {"source_app": "claude-code"})
        self.assertIsNone(result)

    @patch("utils.post_event.urllib.request.urlopen")
    def test_sends_correct_url(self, mock_urlopen):
        """Verifies the request URL ends with /events."""
        mock_urlopen.return_value = make_mock_urlopen_response(201, {"id": 1})

        post_event("http://localhost:8787", {"key": "val"})

        req = mock_urlopen.call_args[0][0]
        self.assertTrue(req.full_url.endswith("/events"))

    @patch("utils.post_event.urllib.request.urlopen")
    def test_sends_json_body(self, mock_urlopen):
        """Verifies the request body matches the input event_data."""
        mock_urlopen.return_value = make_mock_urlopen_response(201, {"id": 1})

        event_data = {"source_app": "claude-code", "session_id": "s1"}
        post_event("http://localhost:8787", event_data)

        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data.decode())
        self.assertEqual(body, event_data)

    @patch("utils.post_event.urllib.request.urlopen")
    def test_sends_correct_headers(self, mock_urlopen):
        """Verifies Content-Type and User-Agent headers are set."""
        mock_urlopen.return_value = make_mock_urlopen_response(201, {"id": 1})

        post_event("http://localhost:8787", {"key": "val"})

        req = mock_urlopen.call_args[0][0]
        self.assertEqual(req.get_header("Content-type"), "application/json")
        self.assertEqual(req.get_header("User-agent"), "Claude-Code-Hook/1.0")


if __name__ == "__main__":
    unittest.main()
