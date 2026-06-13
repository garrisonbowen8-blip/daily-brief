#!/bin/bash
# JARVIS launcher — double-click this file in Finder to open Mission Control.
# Starts the server if it isn't running, then opens Chrome to the dashboard.

cd "$(dirname "$0")"

PORT=3000

if curl -s -o /dev/null --max-time 2 "http://localhost:$PORT"; then
  echo "JARVIS already online."
else
  echo "Bringing JARVIS online..."
  # free the port if a stale server is wedged on it
  lsof -ti:"$PORT" | xargs kill 2>/dev/null
  sleep 1
  nohup npm run dev > /tmp/jarvis-server.log 2>&1 &
  # wait for the server to come up (first boot after an update takes longest)
  for i in $(seq 1 60); do
    sleep 1
    if curl -s -o /dev/null --max-time 2 "http://localhost:$PORT"; then
      break
    fi
  done
fi

open -a "Google Chrome" "http://localhost:$PORT" 2>/dev/null || open "http://localhost:$PORT"

# Surface the address your phone can use on the same Wi-Fi
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo ""
echo "JARVIS at your service on this Mac."
if [ -n "$LAN_IP" ]; then
  echo "On your phone (same Wi-Fi), open:  http://$LAN_IP:$PORT"
  echo "Then Share -> Add to Home Screen to install it as an app."
fi
echo "You can close this window."
