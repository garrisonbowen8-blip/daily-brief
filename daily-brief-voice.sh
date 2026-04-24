#!/bin/bash
# Daily brief — spoken morning briefing. Fired by launchd at the scheduled time.
# Uses ElevenLabs API (JARVIS-style voice). Falls back to macOS `say` if the API fails.
# Phrasing logic lives in daily-brief-voice.js. History tracked to avoid repetition.

set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

# ── Locate project root relative to this script ───────────────────────────
BRIEF_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$BRIEF_DIR/config.json"
DATA="$BRIEF_DIR/daily-brief-data.js"
JS_SCRIPT="$BRIEF_DIR/daily-brief-voice.js"
HISTORY_FILE="$HOME/.daily-brief-history.json"
AUDIO_OUT="/tmp/daily-brief-$(date +%Y%m%d).mp3"
LOG="/tmp/daily-brief-voice.log"

FALLBACK_VOICE="Daniel"
FALLBACK_RATE=180

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

# ── Load credentials from config.json ─────────────────────────────────────
if [ ! -f "$CONFIG" ]; then
  say -v "$FALLBACK_VOICE" -r "$FALLBACK_RATE" "Config file not found, sir. Run setup first."
  exit 1
fi

API_KEY=$(python3 -c "import json; c=json.load(open('$CONFIG')); print(c['elevenlabs']['apiKey'])" 2>/dev/null || echo "")
VOICE_ID=$(python3 -c "import json; c=json.load(open('$CONFIG')); print(c['elevenlabs']['voiceId'])" 2>/dev/null || echo "")
MODEL=$(python3 -c "import json; c=json.load(open('$CONFIG')); print(c['elevenlabs']['model'])" 2>/dev/null || echo "eleven_turbo_v2_5")
PHONE=$(python3 -c "import json; c=json.load(open('$CONFIG')); print(c['voice']['imessage'].get('phone',''))" 2>/dev/null || echo "")
IMSG_ENABLED=$(python3 -c "import json; c=json.load(open('$CONFIG')); print('1' if c['voice']['imessage'].get('enabled') else '0')" 2>/dev/null || echo "0")

if [ ! -f "$DATA" ]; then
  say -v "$FALLBACK_VOICE" -r "$FALLBACK_RATE" "I can't find the daily brief data file, sir."
  exit 1
fi
if [ ! -f "$JS_SCRIPT" ]; then
  say -v "$FALLBACK_VOICE" -r "$FALLBACK_RATE" "The voice script is missing, sir."
  exit 1
fi

TEXT=$(DATA_FILE="$DATA" HISTORY_FILE="$HISTORY_FILE" /usr/bin/env node "$JS_SCRIPT" 2>>"$LOG" || echo "Morning briefing had trouble parsing today's data, sir.")
log "Briefing text: $TEXT"

USE_ELEVENLABS=0
if [ -n "$API_KEY" ] && [ -n "$VOICE_ID" ]; then
  USE_ELEVENLABS=1
else
  log "No ElevenLabs credentials — using fallback voice"
fi

if [ "$USE_ELEVENLABS" = "1" ]; then
  ESCAPED_TEXT=$(printf '%s' "$TEXT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
  PAYLOAD="{\"text\":$ESCAPED_TEXT,\"model_id\":\"$MODEL\",\"voice_settings\":{\"stability\":0.45,\"similarity_boost\":0.8,\"style\":0.35,\"use_speaker_boost\":true}}"

  HTTP_CODE=$(curl -s -o "$AUDIO_OUT" -w "%{http_code}" \
    --max-time 45 \
    -X POST "https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID" \
    -H "xi-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" || echo "000")

  if [ "$HTTP_CODE" = "200" ] && [ -s "$AUDIO_OUT" ]; then
    if file "$AUDIO_OUT" | grep -q "Audio"; then
      log "ElevenLabs succeeded — playing $AUDIO_OUT"
      PLAYED=0
      for ATTEMPT in 1 2 3; do
        if /usr/bin/afplay "$AUDIO_OUT" 2>/dev/null; then
          PLAYED=1; break
        fi
        log "afplay attempt $ATTEMPT failed — retrying in 5s"
        sleep 5
      done
      if [ "$PLAYED" = "0" ]; then
        log "afplay failed after 3 attempts — falling back to say"
        /usr/bin/say -v "$FALLBACK_VOICE" -r "$FALLBACK_RATE" "$TEXT"
      fi

      if [ "$IMSG_ENABLED" = "1" ] && [ -n "$PHONE" ]; then
        IMSG_RESULT=$(osascript <<APPLESCRIPT 2>&1
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "$PHONE" of targetService
    set theFile to POSIX file "$AUDIO_OUT" as alias
    send theFile to targetBuddy
end tell
APPLESCRIPT
        ) && log "iMessage sent to $PHONE" || log "iMessage failed: $IMSG_RESULT"
      fi

      exit 0
    else
      log "ElevenLabs returned 200 but not audio — falling back"
    fi
  else
    log "ElevenLabs failed (HTTP $HTTP_CODE) — falling back"
  fi
fi

log "Using fallback voice: $FALLBACK_VOICE"
/usr/bin/say -v "$FALLBACK_VOICE" -r "$FALLBACK_RATE" "$TEXT"
