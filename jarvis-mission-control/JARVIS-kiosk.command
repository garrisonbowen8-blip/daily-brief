#!/bin/bash

# J.A.R.V.I.S. Kiosk Launcher
# Opens localhost:3000 in full kiosk mode (no tabs, no address bar, no chrome)
# To exit kiosk mode: press Escape

URL="http://localhost:3000"

# Check if Chrome is installed
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ ! -f "$CHROME" ]; then
  echo "Google Chrome not found at default path."
  echo "Looking for Chromium or Brave…"

  if [ -f "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" ]; then
    CHROME="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  elif [ -f "/Applications/Chromium.app/Contents/MacOS/Chromium" ]; then
    CHROME="/Applications/Chromium.app/Contents/MacOS/Chromium"
  else
    echo "No compatible browser found. Install Google Chrome and try again."
    exit 1
  fi
fi

echo "Launching J.A.R.V.I.S. in kiosk mode…"
echo "Press Escape to exit."

# Kill any running Chrome so --kiosk takes effect on a fresh instance
pkill -x "Google Chrome" 2>/dev/null
pkill -x "Brave Browser" 2>/dev/null
sleep 1

# Kill any existing dev server and wipe the Turbopack cache to prevent corruption errors
JARVIS_DIR="$(dirname "$0")"
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1
echo "Clearing build cache…"
find "$JARVIS_DIR/.next" -type f -delete 2>/dev/null
find "$JARVIS_DIR/.next" -type d -empty -delete 2>/dev/null

# Start a fresh dev server
echo "Starting JARVIS server…"
nohup npm --prefix "$JARVIS_DIR" run dev > /tmp/jarvis-server.log 2>&1 &

# Wait for server to be ready
for i in $(seq 1 30); do
  sleep 1
  if curl -s -o /dev/null --max-time 1 "$URL"; then
    echo "JARVIS online."
    break
  fi
done

# Display 3 (4K external): x=4952, 1920x1080 logical
# Pre-grant microphone permission for localhost in the kiosk profile
PROFILE_DIR=/tmp/jarvis-kiosk-profile
mkdir -p "$PROFILE_DIR/Default"
cat > "$PROFILE_DIR/Default/Preferences" <<'JSON'
{
  "profile": { "default_content_setting_values": { "media_stream_mic": 1 } },
  "content_settings": {
    "exceptions": {
      "media_stream_mic": {
        "http://localhost:3000,*": { "setting": 1 },
        "http://localhost:3001,*": { "setting": 1 },
        "http://localhost:3002,*": { "setting": 1 }
      }
    }
  }
}
JSON

"$CHROME" \
  --kiosk \
  --no-first-run \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --user-data-dir="$PROFILE_DIR" \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --window-position=4952,360 \
  --window-size=1920,1080 \
  "$URL"
