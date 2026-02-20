#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

"""
PermissionRequest hook: sends the event to the Siana server, waits for the
user's approve/deny decision from the dashboard, and outputs it as
hookSpecificOutput so Claude Code acts on it.

Falls back cleanly if the server is unreachable or the user doesn't respond
within the timeout. Local logging is preserved regardless.
"""

import json
import os
import sys
from datetime import datetime

from utils.constants import ensure_session_log_dir
from utils.post_event import post_event
from utils.wait_response import wait_for_response, format_hook_output

# How long to wait for a human decision (seconds)
RESPONSE_TIMEOUT = int(os.environ.get("SIANA_RESPONSE_TIMEOUT", "120"))
POLL_INTERVAL = 1.0


def log_locally(input_data):
    """Append the event to the local session log (preserves existing behaviour)."""
    session_id = input_data.get("session_id", "unknown")
    log_dir = ensure_session_log_dir(session_id)
    log_path = log_dir / "permission_request.json"

    log_data = []
    if log_path.exists():
        try:
            with open(log_path, "r") as f:
                log_data = json.load(f)
        except (json.JSONDecodeError, ValueError):
            log_data = []

    log_data.append(input_data)

    with open(log_path, "w") as f:
        json.dump(log_data, f, indent=2)


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    # Always log locally first
    try:
        log_locally(input_data)
    except Exception:
        pass  # local logging is best-effort

    server_url = os.environ.get("SIANA_SERVER_URL", "http://localhost:8787")

    # Build event data and send to the Siana server
    event_data = {
        "source_app": "claude-code",
        "session_id": input_data.get("session_id", "unknown"),
        "hook_event_type": "PermissionRequest",
        "timestamp": int(datetime.now().timestamp() * 1000),
        "payload": input_data,
    }

    if "tool_name" in input_data:
        event_data["tool_name"] = input_data["tool_name"]

    event_id = post_event(server_url, event_data)

    if event_id is None:
        # Server unreachable — exit silently so Claude Code proceeds normally
        sys.exit(0)

    # Poll for the user's decision from the dashboard
    result = wait_for_response(
        server_url=server_url,
        event_id=event_id,
        timeout=RESPONSE_TIMEOUT,
        poll_interval=POLL_INTERVAL,
    )

    if result and "decision" in result:
        output = format_hook_output(
            hook_event_name="PermissionRequest",
            decision=result["decision"],
            reason=result.get("reason") or "",
        )
        print(json.dumps(output))

    # If no result (timeout), exit silently — Claude Code falls back to its default
    sys.exit(0)


if __name__ == "__main__":
    main()
