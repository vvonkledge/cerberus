#!/usr/bin/env bash
set -euo pipefail

# Siana Hook Installer
# Installs Claude Code hooks that forward events to the Siana observability server.

# ── Resolve Siana repo root ──────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIANA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Defaults ─────────────────────────────────────────────────────────────────
SERVER_URL=""
GLOBAL=false
PROJECT_DIR="$(pwd)"

# ── Parse arguments ──────────────────────────────────────────────────────────
usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Install Siana hooks into a Claude Code project's settings.json.

Options:
  --server-url URL    Set the Siana server URL (updates SIANA_SERVER_URL)
  --global            Install to ~/.claude/settings.json (user-level)
  --project-dir DIR   Target project directory (default: current directory)
  -h, --help          Show this help message

Examples:
  # Install hooks for the current project
  ./hooks/install.sh

  # Install hooks globally
  ./hooks/install.sh --global

  # Install with a remote server
  ./hooks/install.sh --server-url https://siana.example.com

  # Install into a specific project
  ./hooks/install.sh --project-dir /path/to/my/project
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-url)
      SERVER_URL="$2"
      shift 2
      ;;
    --global)
      GLOBAL=true
      shift
      ;;
    --project-dir)
      PROJECT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Error: Unknown option '$1'" >&2
      echo "Run '$(basename "$0") --help' for usage." >&2
      exit 1
      ;;
  esac
done

# ── Check dependencies ───────────────────────────────────────────────────────
if ! command -v jq &>/dev/null; then
  echo "Error: 'jq' is required but not installed." >&2
  echo "" >&2
  echo "Install it with one of:" >&2
  echo "  macOS:   brew install jq" >&2
  echo "  Ubuntu:  sudo apt-get install jq" >&2
  echo "  Fedora:  sudo dnf install jq" >&2
  echo "  Arch:    sudo pacman -S jq" >&2
  exit 1
fi

# ── Determine target settings file ──────────────────────────────────────────
if $GLOBAL; then
  TARGET_DIR="$HOME/.claude"
else
  TARGET_DIR="$PROJECT_DIR/.claude"
fi
TARGET_FILE="$TARGET_DIR/settings.json"

# ── Validate template exists ────────────────────────────────────────────────
TEMPLATE="$SIANA_DIR/hooks/examples/settings.json"
if [[ ! -f "$TEMPLATE" ]]; then
  echo "Error: Template not found at $TEMPLATE" >&2
  exit 1
fi

# ── Validate send_event.py exists ───────────────────────────────────────────
if [[ ! -f "$SIANA_DIR/hooks/send_event.py" ]]; then
  echo "Error: send_event.py not found at $SIANA_DIR/hooks/send_event.py" >&2
  exit 1
fi

# ── Build the new hooks JSON ────────────────────────────────────────────────
# Replace {{SIANA_DIR}} placeholder with the actual absolute path
SIANA_HOOKS=$(sed "s|{{SIANA_DIR}}|$SIANA_DIR|g" "$TEMPLATE")

# If --server-url was provided, append it to every command
if [[ -n "$SERVER_URL" ]]; then
  SIANA_HOOKS=$(echo "$SIANA_HOOKS" | sed "s|--event-type \([A-Za-z]*\)\"|--event-type \1 --server-url $SERVER_URL\"|g")
fi

# Extract just the hooks object from the template
NEW_HOOKS=$(echo "$SIANA_HOOKS" | jq '.hooks')

# ── Merge or create settings.json ───────────────────────────────────────────
mkdir -p "$TARGET_DIR"

if [[ -f "$TARGET_FILE" ]]; then
  # File exists — merge hooks into existing settings
  EXISTING=$(cat "$TARGET_FILE")

  # Check if existing file has a hooks object
  if echo "$EXISTING" | jq -e '.hooks' &>/dev/null; then
    # Merge: for each hook type, concatenate the arrays
    MERGED=$(echo "$EXISTING" | jq --argjson new_hooks "$NEW_HOOKS" '
      .hooks as $existing_hooks |
      .hooks = ($existing_hooks | to_entries | reduce .[] as $entry (
        {};
        . + {($entry.key): $entry.value}
      )) |
      .hooks = (reduce ($new_hooks | to_entries[]) as $new_entry (
        .hooks;
        if .[$new_entry.key] then
          # Filter out any existing Siana hooks (by checking for send_event.py)
          .[$new_entry.key] = ([.[$new_entry.key][] | select(.hooks | all(.command | test("send_event\\.py") | not))] + $new_entry.value)
        else
          .[$new_entry.key] = $new_entry.value
        end
      ))
    ')
    echo "$MERGED" | jq '.' > "$TARGET_FILE"
    echo "Merged Siana hooks into existing $TARGET_FILE"
  else
    # File exists but has no hooks — add the hooks key
    echo "$EXISTING" | jq --argjson new_hooks "$NEW_HOOKS" '. + {hooks: $new_hooks}' > "$TARGET_FILE"
    echo "Added hooks to existing $TARGET_FILE"
  fi
else
  # No existing file — write fresh
  echo "$SIANA_HOOKS" | jq '.' > "$TARGET_FILE"
  echo "Created $TARGET_FILE"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
EVENT_COUNT=$(echo "$NEW_HOOKS" | jq 'keys | length')

echo ""
echo "=== Siana Hook Installation Complete ==="
echo ""
echo "  Siana directory:  $SIANA_DIR"
echo "  Settings file:    $TARGET_FILE"
echo "  Event types:      $EVENT_COUNT hooks installed"
if [[ -n "$SERVER_URL" ]]; then
  echo "  Server URL:       $SERVER_URL"
else
  echo "  Server URL:       \$SIANA_SERVER_URL or http://localhost:8787 (default)"
fi
echo ""
echo "Installed event hooks:"
echo "$NEW_HOOKS" | jq -r 'keys[]' | while read -r event; do
  echo "  - $event"
done
echo ""
echo "To test, start a Claude Code session and check your Siana dashboard."
