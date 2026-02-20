#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from utils.constants import ensure_session_log_dir
from utils.post_event import post_event


def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)

        # Extract session_id
        session_id = input_data.get('session_id', 'unknown')

        # Ensure session log directory exists
        log_dir = ensure_session_log_dir(session_id)
        log_path = log_dir / 'subagent_start.json'

        # Read existing log data or initialize empty list
        if log_path.exists():
            with open(log_path, 'r') as f:
                try:
                    log_data = json.load(f)
                except (json.JSONDecodeError, ValueError):
                    log_data = []
        else:
            log_data = []

        # Append new data
        log_data.append(input_data)

        # Write back to file with formatting
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2)

        # Forward event to Siana server (fire-and-forget)
        try:
            server_url = os.environ.get("SIANA_SERVER_URL", "http://localhost:8787")
            event_data = {
                "source_app": "claude-code",
                "session_id": session_id,
                "hook_event_type": "SubagentStart",
                "timestamp": int(datetime.now().timestamp() * 1000),
                "payload": input_data,
            }
            post_event(server_url, event_data)
        except Exception:
            pass  # server forwarding is best-effort

        sys.exit(0)

    except json.JSONDecodeError:
        # Handle JSON decode errors gracefully
        sys.exit(0)
    except Exception:
        # Exit cleanly on any other error
        sys.exit(0)


if __name__ == '__main__':
    main()
