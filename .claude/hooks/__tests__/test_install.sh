#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIANA_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
INSTALL_SCRIPT="$SIANA_DIR/hooks/install.sh"

PASS=0
FAIL=0

run_test() {
  local name="$1"
  local result="$2"
  if [[ "$result" == "0" ]]; then
    echo "  PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $name"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Siana Install Script Tests ==="
echo ""

# ── Test 1: Fresh install creates valid settings.json ────────────────────────
TMP=$(mktemp -d)
bash "$INSTALL_SCRIPT" --project-dir "$TMP" > /dev/null 2>&1
result=1
if [[ -f "$TMP/.claude/settings.json" ]] && jq empty "$TMP/.claude/settings.json" 2>/dev/null; then
  result=0
fi
run_test "Fresh install creates valid settings.json" "$result"
rm -rf "$TMP"

# ── Test 2: All 12 event types present ───────────────────────────────────────
TMP=$(mktemp -d)
bash "$INSTALL_SCRIPT" --project-dir "$TMP" > /dev/null 2>&1
EXPECTED_EVENTS="PreToolUse PostToolUse PostToolUseFailure PermissionRequest SessionStart SessionEnd SubagentStart SubagentStop Notification PreCompact Stop UserPromptSubmit"
result=0
for event in $EXPECTED_EVENTS; do
  if ! jq -e ".hooks.${event}" "$TMP/.claude/settings.json" > /dev/null 2>&1; then
    result=1
    break
  fi
done
EVENT_COUNT=$(jq '.hooks | keys | length' "$TMP/.claude/settings.json")
if [[ "$EVENT_COUNT" -ne 12 ]]; then
  result=1
fi
run_test "All 12 event types present" "$result"
rm -rf "$TMP"

# ── Test 3: Absolute paths resolved (no {{SIANA_DIR}} placeholders) ──────────
TMP=$(mktemp -d)
bash "$INSTALL_SCRIPT" --project-dir "$TMP" > /dev/null 2>&1
result=0
if grep -q '{{SIANA_DIR}}' "$TMP/.claude/settings.json"; then
  result=1
fi
run_test "Absolute paths resolved" "$result"
rm -rf "$TMP"

# ── Test 4: Paths point to real send_event.py ────────────────────────────────
TMP=$(mktemp -d)
bash "$INSTALL_SCRIPT" --project-dir "$TMP" > /dev/null 2>&1
SEND_PATH=$(jq -r '.hooks.PreToolUse[0].hooks[0].command' "$TMP/.claude/settings.json" | grep -oE '/[^ ]+send_event\.py')
result=1
if [[ -f "$SEND_PATH" ]]; then
  result=0
fi
run_test "Paths point to real send_event.py" "$result"
rm -rf "$TMP"

# ── Test 5: --server-url flag appended ───────────────────────────────────────
TMP=$(mktemp -d)
bash "$INSTALL_SCRIPT" --project-dir "$TMP" --server-url "https://test.example.com" > /dev/null 2>&1
result=0
if ! grep -q 'https://test.example.com' "$TMP/.claude/settings.json"; then
  result=1
fi
run_test "--server-url flag appended" "$result"
rm -rf "$TMP"

# ── Test 6: Merge preserves existing hooks ───────────────────────────────────
TMP=$(mktemp -d)
mkdir -p "$TMP/.claude"
cat > "$TMP/.claude/settings.json" <<'EXISTING'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo custom-hook"
          }
        ]
      }
    ]
  }
}
EXISTING
bash "$INSTALL_SCRIPT" --project-dir "$TMP" > /dev/null 2>&1
result=0
# Check custom hook preserved
if ! jq -e '.hooks.PreToolUse[] | select(.hooks[].command == "echo custom-hook")' "$TMP/.claude/settings.json" > /dev/null 2>&1; then
  result=1
fi
# Check Siana hooks added
if ! jq -e '.hooks.PreToolUse[] | select(.hooks[].command | test("send_event\\.py"))' "$TMP/.claude/settings.json" > /dev/null 2>&1; then
  result=1
fi
# Check other event types also present
if ! jq -e '.hooks.Stop' "$TMP/.claude/settings.json" > /dev/null 2>&1; then
  result=1
fi
run_test "Merge preserves existing hooks" "$result"
rm -rf "$TMP"

# ── Test 7: Merge preserves other settings ───────────────────────────────────
TMP=$(mktemp -d)
mkdir -p "$TMP/.claude"
cat > "$TMP/.claude/settings.json" <<'EXISTING'
{
  "allowedTools": ["Bash"],
  "hooks": {}
}
EXISTING
bash "$INSTALL_SCRIPT" --project-dir "$TMP" > /dev/null 2>&1
result=0
if ! jq -e '.allowedTools' "$TMP/.claude/settings.json" > /dev/null 2>&1; then
  result=1
fi
ALLOWED=$(jq -r '.allowedTools[0]' "$TMP/.claude/settings.json")
if [[ "$ALLOWED" != "Bash" ]]; then
  result=1
fi
run_test "Merge preserves other settings" "$result"
rm -rf "$TMP"

# ── Test 8: Idempotent install ───────────────────────────────────────────────
TMP=$(mktemp -d)
bash "$INSTALL_SCRIPT" --project-dir "$TMP" > /dev/null 2>&1
bash "$INSTALL_SCRIPT" --project-dir "$TMP" > /dev/null 2>&1
result=0
for event in PreToolUse PostToolUse Stop UserPromptSubmit; do
  COUNT=$(jq "[.hooks.${event}[] | .hooks[] | select(.command | contains(\"send_event.py\"))] | length" "$TMP/.claude/settings.json")
  if [[ "$COUNT" -ne 1 ]]; then
    result=1
    break
  fi
done
run_test "Idempotent install" "$result"
rm -rf "$TMP"

# ── Test 9: Stop and UserPromptSubmit have no matcher ────────────────────────
TMP=$(mktemp -d)
bash "$INSTALL_SCRIPT" --project-dir "$TMP" > /dev/null 2>&1
result=0
for event in Stop UserPromptSubmit; do
  if jq -e ".hooks.${event}[0].matcher" "$TMP/.claude/settings.json" > /dev/null 2>&1; then
    result=1
    break
  fi
done
run_test "Stop and UserPromptSubmit have no matcher" "$result"
rm -rf "$TMP"

# ── Test 10: Other event types have matcher ──────────────────────────────────
TMP=$(mktemp -d)
bash "$INSTALL_SCRIPT" --project-dir "$TMP" > /dev/null 2>&1
MATCHER_EVENTS="PreToolUse PostToolUse PostToolUseFailure PermissionRequest SessionStart SessionEnd SubagentStart SubagentStop Notification PreCompact"
result=0
for event in $MATCHER_EVENTS; do
  MATCHER=$(jq -r ".hooks.${event}[0].matcher" "$TMP/.claude/settings.json" 2>/dev/null)
  if [[ "$MATCHER" != ".*" ]]; then
    result=1
    break
  fi
done
run_test "Other event types have matcher" "$result"
rm -rf "$TMP"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "Results: $PASS passed, $FAIL failed"
exit $FAIL
