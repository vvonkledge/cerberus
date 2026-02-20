"""
Shared utility for parsing transcripts and POSTing them to the Siana server.

Usage:
    from utils.post_transcript import parse_transcript, post_transcript

    messages = parse_transcript("/path/to/transcript.jsonl")
    transcript_id = post_transcript("http://localhost:8787", "sess-1", messages)
"""

import json
import sys
import urllib.request
import urllib.error
from typing import Optional


def parse_transcript(transcript_path: str) -> list[dict]:
    """Read JSONL transcript, extract user/assistant text messages.

    Returns list of {"role": "user"|"assistant", "content": "..."} dicts.
    Skips tool_use, tool_result, and any entries without text content.
    For content arrays, join all text blocks with newlines.
    """
    messages = []

    try:
        with open(transcript_path, "r") as f:
            lines = f.readlines()
    except (OSError, IOError):
        return messages

    for line in lines:
        line = line.strip()
        if not line:
            continue

        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue

        entry_type = entry.get("type")
        if entry_type not in ("user", "assistant"):
            continue

        message = entry.get("message")
        if not isinstance(message, dict):
            continue

        content_raw = message.get("content")
        if content_raw is None:
            continue

        # Extract text content
        if isinstance(content_raw, str):
            text = content_raw
        elif isinstance(content_raw, list):
            text_parts = [
                block.get("text", "")
                for block in content_raw
                if isinstance(block, dict) and block.get("type") == "text"
            ]
            text = "\n".join(text_parts)
        else:
            continue

        if not text:
            continue

        role = message.get("role", entry_type)
        messages.append({"role": role, "content": text})

    return messages


def post_transcript(
    server_url: str, session_id: str, messages: list[dict]
) -> Optional[int]:
    """POST transcript messages to the Siana server's /transcripts endpoint.

    Args:
        server_url: Base URL (e.g. "http://localhost:8787")
        session_id: Claude session ID
        messages: List of {"role": ..., "content": ...} dicts

    Returns:
        The server-assigned transcript ID on success, or None on failure.
    """
    url = f"{server_url.rstrip('/')}/transcripts"
    body = json.dumps({"session_id": session_id, "messages": messages}).encode("utf-8")

    try:
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Claude-Code-Hook/1.0",
            },
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status in (200, 201):
                result = json.loads(resp.read().decode())
                return result.get("id")
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, Exception) as exc:
        print(f"Failed to send transcript to {url}: {exc}", file=sys.stderr)

    return None
