#!/usr/bin/env bash
# Standalone launchd plist installer for the daily JARVIS voice briefing (Mac only).
# Usage: bash scripts/install-voice.sh
#
# Reads scheduleTime from config.json and (re)installs the launchd plist.
# Run this any time you want to change the briefing time without re-running setup.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/config.json"

if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "Voice scheduling via launchd is Mac-only. Skipping."
  exit 0
fi

if [ ! -f "$CONFIG" ]; then
  echo "config.json not found at $CONFIG"
  echo "Run bash scripts/setup.sh first, or copy config.example.json to config.json and fill it in."
  exit 1
fi

if [ ! -f "$ROOT/daily-brief-voice.sh" ]; then
  echo "daily-brief-voice.sh not found in project root."
  exit 1
fi

VOICE_ENABLED=$(python3 -c "import json; c=json.load(open('$CONFIG')); print('1' if c.get('voice', {}).get('enabled') else '0')" 2>/dev/null || echo "0")

if [ "$VOICE_ENABLED" != "1" ]; then
  echo "Voice is disabled in config.json (voice.enabled = false)."
  echo "Set voice.enabled to true, then run this script again."
  exit 0
fi

SCHEDULE_TIME=$(python3 -c "import json; c=json.load(open('$CONFIG')); print(c.get('voice', {}).get('scheduleTime', '08:45'))" 2>/dev/null || echo "08:45")
IFS=':' read -r HOUR MIN <<< "$SCHEDULE_TIME"

PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/com.dailybrief.refresh.plist"

mkdir -p "$PLIST_DIR"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>         <string>com.dailybrief.refresh</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$ROOT/daily-brief-voice.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>   <integer>$((10#$HOUR))</integer>
    <key>Minute</key> <integer>$((10#$MIN))</integer>
  </dict>
  <key>StandardOutPath</key> <string>$HOME/.daily-brief.log</string>
  <key>StandardErrorPath</key><string>$HOME/.daily-brief.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
</dict>
</plist>
PLIST

launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "Voice briefing scheduled at $SCHEDULE_TIME daily."
echo "Plist: $PLIST_PATH"
echo "Log:   $HOME/.daily-brief.log"
echo ""
echo "To change the time: edit voice.scheduleTime in config.json, then run this script again."
