"""
Shared utility for POSTing events to the Siana server.

Usage:
    from utils.post_event import post_event

    event_id = post_event("http://localhost:8787", {
        "source_app": "claude-code",
        "session_id": "sess-1",
        "hook_event_type": "PreToolUse",
        "timestamp": 1700000000000,
        "payload": {...},
    })
"""

import json
import sys
import urllib.request
import urllib.error
from typing import Optional


def post_event(server_url: str, event_data: dict) -> Optional[int]:
    """POST event data to the Siana server's /events endpoint.

    Args:
        server_url: Base URL (e.g. "http://localhost:8787")
        event_data: Complete event dict ready to send

    Returns:
        The server-assigned event ID on success, or None on failure.
    """
    url = f"{server_url.rstrip('/')}/events"
    body = json.dumps(event_data).encode("utf-8")

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
        print(f"Failed to send event to {url}: {exc}", file=sys.stderr)

    return None
