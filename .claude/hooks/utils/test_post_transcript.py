"""Tests for the post_transcript shared utility."""

import json
import os
import tempfile
import unittest
from unittest.mock import patch, MagicMock
import urllib.error

from utils.post_transcript import parse_transcript, post_transcript


def make_mock_urlopen_response(status, body):
    """Create a mock HTTP response with given status and JSON body."""
    mock = MagicMock()
    mock.status = status
    mock.read.return_value = json.dumps(body).encode()
    mock.__enter__ = lambda s: s
    mock.__exit__ = MagicMock(return_value=False)
    return mock


def write_jsonl(path, entries):
    """Write a list of dicts as JSONL to a file."""
    with open(path, "w") as f:
        for entry in entries:
            f.write(json.dumps(entry) + "\n")


class TestParseTranscript(unittest.TestCase):

    def test_extracts_user_and_assistant_turns(self):
        """Extracts user and assistant text messages from valid JSONL."""
        entries = [
            {
                "type": "user",
                "message": {
                    "role": "user",
                    "content": [{"type": "text", "text": "Hello"}],
                },
            },
            {
                "type": "assistant",
                "message": {
                    "role": "assistant",
                    "content": [{"type": "text", "text": "Hi there"}],
                    "model": "claude-sonnet-4-20250514",
                },
            },
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            for entry in entries:
                f.write(json.dumps(entry) + "\n")
            path = f.name

        try:
            messages = parse_transcript(path)
            self.assertEqual(len(messages), 2)
            self.assertEqual(messages[0], {"role": "user", "content": "Hello"})
            self.assertEqual(messages[1], {"role": "assistant", "content": "Hi there"})
        finally:
            os.unlink(path)

    def test_skips_tool_use_and_tool_result(self):
        """Skips entries with type tool_use or tool_result."""
        entries = [
            {
                "type": "user",
                "message": {
                    "role": "user",
                    "content": [{"type": "text", "text": "Do something"}],
                },
            },
            {"type": "tool_use", "tool": "Read", "input": {"path": "/foo"}},
            {"type": "tool_result", "output": "file contents"},
            {
                "type": "assistant",
                "message": {
                    "role": "assistant",
                    "content": [{"type": "text", "text": "Done"}],
                },
            },
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            for entry in entries:
                f.write(json.dumps(entry) + "\n")
            path = f.name

        try:
            messages = parse_transcript(path)
            self.assertEqual(len(messages), 2)
            self.assertEqual(messages[0]["role"], "user")
            self.assertEqual(messages[1]["role"], "assistant")
        finally:
            os.unlink(path)

    def test_joins_multi_block_content_arrays(self):
        """Joins multiple text blocks in content arrays with newlines."""
        entries = [
            {
                "type": "assistant",
                "message": {
                    "role": "assistant",
                    "content": [
                        {"type": "text", "text": "First paragraph"},
                        {"type": "text", "text": "Second paragraph"},
                    ],
                },
            },
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            for entry in entries:
                f.write(json.dumps(entry) + "\n")
            path = f.name

        try:
            messages = parse_transcript(path)
            self.assertEqual(len(messages), 1)
            self.assertEqual(
                messages[0]["content"], "First paragraph\nSecond paragraph"
            )
        finally:
            os.unlink(path)

    def test_handles_string_content(self):
        """Handles content that is a plain string instead of an array."""
        entries = [
            {
                "type": "user",
                "message": {"role": "user", "content": "plain string content"},
            },
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            for entry in entries:
                f.write(json.dumps(entry) + "\n")
            path = f.name

        try:
            messages = parse_transcript(path)
            self.assertEqual(len(messages), 1)
            self.assertEqual(messages[0]["content"], "plain string content")
        finally:
            os.unlink(path)

    def test_skips_non_text_blocks_in_content_array(self):
        """Skips non-text blocks (like tool_use) in content arrays."""
        entries = [
            {
                "type": "assistant",
                "message": {
                    "role": "assistant",
                    "content": [
                        {"type": "text", "text": "Let me check"},
                        {"type": "tool_use", "id": "t1", "name": "Read"},
                    ],
                },
            },
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            for entry in entries:
                f.write(json.dumps(entry) + "\n")
            path = f.name

        try:
            messages = parse_transcript(path)
            self.assertEqual(len(messages), 1)
            self.assertEqual(messages[0]["content"], "Let me check")
        finally:
            os.unlink(path)

    def test_skips_entries_with_empty_text_content(self):
        """Skips entries where all text blocks are empty."""
        entries = [
            {
                "type": "assistant",
                "message": {
                    "role": "assistant",
                    "content": [{"type": "tool_use", "id": "t1", "name": "Read"}],
                },
            },
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            for entry in entries:
                f.write(json.dumps(entry) + "\n")
            path = f.name

        try:
            messages = parse_transcript(path)
            self.assertEqual(len(messages), 0)
        finally:
            os.unlink(path)

    def test_returns_empty_list_for_missing_file(self):
        """Returns empty list when the transcript file does not exist."""
        messages = parse_transcript("/nonexistent/path/transcript.jsonl")
        self.assertEqual(messages, [])

    def test_returns_empty_list_for_empty_file(self):
        """Returns empty list for an empty transcript file."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            path = f.name

        try:
            messages = parse_transcript(path)
            self.assertEqual(messages, [])
        finally:
            os.unlink(path)

    def test_skips_malformed_json_lines(self):
        """Skips lines with invalid JSON and continues parsing."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write('{"type":"user","message":{"role":"user","content":"hello"}}\n')
            f.write("this is not json\n")
            f.write('{"type":"assistant","message":{"role":"assistant","content":"hi"}}\n')
            path = f.name

        try:
            messages = parse_transcript(path)
            self.assertEqual(len(messages), 2)
            self.assertEqual(messages[0]["content"], "hello")
            self.assertEqual(messages[1]["content"], "hi")
        finally:
            os.unlink(path)


class TestPostTranscript(unittest.TestCase):

    @patch("utils.post_transcript.urllib.request.urlopen")
    def test_returns_transcript_id_on_201(self, mock_urlopen):
        """Returns the server-assigned transcript ID on a 201 response."""
        mock_urlopen.return_value = make_mock_urlopen_response(201, {"id": 99})

        result = post_transcript(
            "http://localhost:8787",
            "sess-1",
            [{"role": "user", "content": "hello"}],
        )
        self.assertEqual(result, 99)

    @patch("utils.post_transcript.urllib.request.urlopen")
    def test_sends_correct_url(self, mock_urlopen):
        """Verifies the request URL ends with /transcripts."""
        mock_urlopen.return_value = make_mock_urlopen_response(201, {"id": 1})

        post_transcript("http://localhost:8787", "sess-1", [])

        req = mock_urlopen.call_args[0][0]
        self.assertTrue(req.full_url.endswith("/transcripts"))

    @patch("utils.post_transcript.urllib.request.urlopen")
    def test_sends_correct_body(self, mock_urlopen):
        """Verifies the request body contains session_id and messages."""
        mock_urlopen.return_value = make_mock_urlopen_response(201, {"id": 1})

        messages = [{"role": "user", "content": "hello"}]
        post_transcript("http://localhost:8787", "sess-1", messages)

        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data.decode())
        self.assertEqual(body["session_id"], "sess-1")
        self.assertEqual(body["messages"], messages)

    @patch("utils.post_transcript.urllib.request.urlopen")
    def test_sends_correct_headers(self, mock_urlopen):
        """Verifies Content-Type and User-Agent headers are set."""
        mock_urlopen.return_value = make_mock_urlopen_response(201, {"id": 1})

        post_transcript("http://localhost:8787", "sess-1", [])

        req = mock_urlopen.call_args[0][0]
        self.assertEqual(req.get_header("Content-type"), "application/json")
        self.assertEqual(req.get_header("User-agent"), "Claude-Code-Hook/1.0")

    @patch("utils.post_transcript.urllib.request.urlopen")
    def test_returns_none_on_connection_error(self, mock_urlopen):
        """Returns None when the server is unreachable."""
        mock_urlopen.side_effect = urllib.error.URLError("Connection refused")

        result = post_transcript("http://localhost:8787", "sess-1", [])
        self.assertIsNone(result)

    @patch("utils.post_transcript.urllib.request.urlopen")
    def test_returns_none_on_http_error(self, mock_urlopen):
        """Returns None on a non-success HTTP status."""
        mock_urlopen.side_effect = urllib.error.HTTPError(
            url="http://localhost:8787/transcripts",
            code=500,
            msg="Internal Server Error",
            hdrs=None,
            fp=None,
        )

        result = post_transcript("http://localhost:8787", "sess-1", [])
        self.assertIsNone(result)

    @patch("utils.post_transcript.urllib.request.urlopen")
    def test_strips_trailing_slash_from_url(self, mock_urlopen):
        """Strips trailing slash from server URL before appending path."""
        mock_urlopen.return_value = make_mock_urlopen_response(201, {"id": 1})

        post_transcript("http://localhost:8787/", "sess-1", [])

        req = mock_urlopen.call_args[0][0]
        self.assertEqual(req.full_url, "http://localhost:8787/transcripts")


if __name__ == "__main__":
    unittest.main()
