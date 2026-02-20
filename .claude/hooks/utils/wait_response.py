"""
Utility for polling the Siana API to wait for a user response to an event.

Usage:
    from utils.wait_response import wait_for_response, format_hook_output

    result = wait_for_response(
        server_url="http://localhost:8787",
        event_id=42,
        timeout=120,
        poll_interval=1.0,
    )

    if result:
        output = format_hook_output(
            hook_event_name="PreToolUse",
            decision=result["decision"],
            reason=result.get("reason", ""),
        )
        print(json.dumps(output))
"""

import json
import sys
import time
import urllib.request
import urllib.error
from typing import Optional, Dict, Any


def wait_for_response(
    server_url: str,
    event_id: int,
    timeout: int = 120,
    poll_interval: float = 1.0,
) -> Optional[Dict[str, Any]]:
    """
    Poll the Siana API waiting for a user response to an event.

    Args:
        server_url: Base URL of the Siana server (e.g. "http://localhost:8787")
        event_id: The event ID to poll for a response
        timeout: Maximum seconds to wait before giving up
        poll_interval: Seconds between poll attempts

    Returns:
        The response dict on success, or None if timeout elapsed
    """
    url = f"{server_url.rstrip('/')}/events/{event_id}/respond"
    start_time = time.time()

    while time.time() - start_time < timeout:
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    body = json.loads(resp.read().decode())
                    return body.get("response")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                # No response yet, keep polling
                pass
            else:
                print(
                    f"Unexpected HTTP {e.code} polling {url}",
                    file=sys.stderr,
                )
        except (urllib.error.URLError, OSError) as e:
            # Connection refused, server not running, network error, etc.
            print(
                f"Connection error polling {url}: {e}",
                file=sys.stderr,
            )
        except Exception as e:
            print(
                f"Error polling {url}: {e}",
                file=sys.stderr,
            )

        time.sleep(poll_interval)

    return None


def format_hook_output(
    hook_event_name: str,
    decision: str,
    reason: str = "",
) -> Dict[str, Any]:
    """
    Format a response as hookSpecificOutput JSON for Claude Code.

    Args:
        hook_event_name: The hook event name (e.g. "PreToolUse")
        decision: The permission decision ("approve" or "deny")
        reason: Optional reason for the decision

    Returns:
        Dict with hookSpecificOutput structure
    """
    return {
        "hookSpecificOutput": {
            "hookEventName": hook_event_name,
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }
    }
