#!/usr/bin/env bash
# Daily Brief — interactive setup wizard
# Usage: bash scripts/setup.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RESET='\033[0m'

step() { echo -e "\n${CYAN}▸ $1${RESET}"; }
ok()   { echo -e "${GREEN}✓ $1${RESET}"; }
warn() { echo -e "${YELLOW}⚠ $1${RESET}"; }
ask()  { printf "${BOLD}$1${RESET} "; read -r REPLY; echo "$REPLY"; }

echo -e "\n${BOLD}Daily Brief — Setup${RESET}"
echo "This wizard creates your config.json and gets you set up in ~5 minutes."
echo "Press Ctrl-C at any time to quit."

# ── 1. Dependencies ────────────────────────────────────────────────────────
step "Checking dependencies"

if ! command -v node &>/dev/null; then
  echo "Node.js is required. Install from https://nodejs.org and run setup again."
  exit 1
fi
ok "Node $(node -v)"

if ! command -v git &>/dev/null; then
  echo "Git is required. Install from https://git-scm.com."
  exit 1
fi
ok "Git $(git --version | awk '{print $3}')"

step "Installing npm dependencies"
npm install --silent
ok "Dependencies installed"

# ── 2. Personal info ───────────────────────────────────────────────────────
step "Personal info"
USER_NAME=$(ask "Your first name (used in briefing):")
CITY=$(ask "Your city (shown on dashboard):")
LAT=$(ask "City latitude  (find at maps.google.com — right-click your city):")
LNG=$(ask "City longitude:")

# ── 3. Google OAuth setup ──────────────────────────────────────────────────
step "Google Calendar + Gmail access"
echo ""
echo "You'll need OAuth 2.0 credentials from Google Cloud Console."
echo "If you haven't done this yet, here's the quick path:"
echo ""
echo "  1. Go to: https://console.cloud.google.com/"
echo "  2. Create a new project (or use an existing one)"
echo "  3. Enable APIs: Google Calendar API + Gmail API"
echo "  4. Go to: APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID"
echo "  5. Application type: Desktop app"
echo "  6. Copy the Client ID and Client Secret"
echo ""
GMAIL=$(ask  "Your Gmail address:")
CLIENT_ID=$(ask "Google OAuth Client ID:")
CLIENT_SECRET=$(ask "Google OAuth Client Secret:")

# ── 4. ElevenLabs ─────────────────────────────────────────────────────────
step "JARVIS voice (ElevenLabs)"
echo ""
echo "Get your API key at: https://elevenlabs.io → Profile → API Keys"
echo "Get a Voice ID by adding a voice to your Voice Library, then copying its ID."
echo ""
ENABLE_VOICE=$(ask "Enable JARVIS voice briefing? (y/n):")
if [[ "$ENABLE_VOICE" =~ ^[Yy] ]]; then
  EL_KEY=$(ask   "ElevenLabs API key:")
  EL_VOICE=$(ask "ElevenLabs Voice ID:")
  BRIEFING_TIME=$(ask "Morning briefing time (24h, e.g. 08:45):")

  if [[ "$OSTYPE" == "darwin"* ]]; then
    ENABLE_IMSG=$(ask "Send briefing MP3 to your phone via iMessage? (y/n):")
    if [[ "$ENABLE_IMSG" =~ ^[Yy] ]]; then
      PHONE=$(ask "Phone number (digits only, e.g. 8005551234):")
    fi
  fi
fi

# ── 5. GitHub / Cloudflare deployment ─────────────────────────────────────
step "Deployment"
echo ""
echo "The dashboard deploys to GitHub Pages or Cloudflare Pages."
echo "If you haven't created the repo yet, do it now: https://github.com/new"
echo ""
GITHUB_REPO=$(ask "Your GitHub repo (username/repo-name):")

# ── 6. my-data.json ───────────────────────────────────────────────────────
step "Personal data file"
if [ ! -f "$ROOT/my-data.json" ]; then
  cp "$ROOT/my-data.example.json" "$ROOT/my-data.json"
  ok "Created my-data.json — edit it to set your workout split, focus project, and study block"
else
  ok "my-data.json already exists — skipping"
fi

# ── 7. Write config.json ──────────────────────────────────────────────────
step "Writing config.json"

cat > "$ROOT/config.json" <<CONFIGEOF
{
  "user": {
    "name": "$USER_NAME",
    "greeting": "sir"
  },
  "location": {
    "name": "$CITY",
    "lat": $LAT,
    "lng": $LNG
  },
  "google": {
    "clientId": "$CLIENT_ID",
    "clientSecret": "$CLIENT_SECRET",
    "calendarId": "primary",
    "gmailAddress": "$GMAIL"
  },
  "elevenlabs": {
    "apiKey": "${EL_KEY:-}",
    "voiceId": "${EL_VOICE:-}",
    "model": "eleven_turbo_v2_5",
    "stability": 0.45,
    "style": 0.35
  },
  "voice": {
    "enabled": $([ "$ENABLE_VOICE" = "y" ] || [ "$ENABLE_VOICE" = "Y" ] && echo true || echo false),
    "scheduleTime": "${BRIEFING_TIME:-08:45}",
    "imessage": {
      "enabled": $([ "${ENABLE_IMSG:-n}" = "y" ] || [ "${ENABLE_IMSG:-n}" = "Y" ] && echo true || echo false),
      "phone": "${PHONE:-}"
    }
  },
  "deployment": {
    "githubRepo": "$GITHUB_REPO"
  },
  "obsidian": {
    "enabled": false,
    "vaultPath": ""
  }
}
CONFIGEOF

chmod 600 "$ROOT/config.json"
ok "config.json written (permissions: owner-read-only)"

# ── 8. .gitignore ─────────────────────────────────────────────────────────
step "Updating .gitignore"
for ENTRY in "config.json" "my-data.json"; do
  if ! grep -q "^$ENTRY$" "$ROOT/.gitignore" 2>/dev/null; then
    echo "$ENTRY" >> "$ROOT/.gitignore"
  fi
done
ok ".gitignore updated"

# ── 9. Google OAuth token exchange ────────────────────────────────────────
step "Authorizing Google (opens browser)"
echo ""
node "$ROOT/scripts/google-auth.js"

# ── 10. launchd plist (Mac only) ──────────────────────────────────────────
if [[ "$OSTYPE" == "darwin"* ]] && [[ "$ENABLE_VOICE" =~ ^[Yy] ]]; then
  step "Setting up daily morning briefing (launchd)"

  IFS=':' read -r HOUR MIN <<< "${BRIEFING_TIME:-08:45}"
  PLIST_PATH="$HOME/Library/LaunchAgents/com.dailybrief.refresh.plist"

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
  ok "Launchd plist installed — briefing scheduled at ${BRIEFING_TIME}"
fi

# ── 11. First refresh ──────────────────────────────────────────────────────
step "Running first data refresh"
node "$ROOT/scripts/refresh.js"

echo ""
echo -e "${GREEN}${BOLD}Setup complete!${RESET}"
echo ""
echo "  Dashboard: push to GitHub and enable Cloudflare Pages or GitHub Pages"
echo "  Manual refresh: npm run refresh"
echo "  Re-authorize Google: npm run auth"
echo "  Edit personal data: my-data.json"
echo ""
