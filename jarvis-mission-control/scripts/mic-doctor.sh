#!/bin/bash
# ATLAS Mic Doctor — figures out WHY Chrome says "no microphone found"
# (NotFoundError) by checking the Mac's audio system underneath Chrome.
#
# Run it with:  npm run micfix     (from jarvis-mission-control/)
#
# It answers the one question that splits the problem in half:
#   Does macOS itself see a microphone?
#     NO  -> CoreAudio/OS problem  -> restart coreaudiod, then reboot
#     YES -> Chrome problem        -> permission toggle / full quit / device pick

set -u

CYAN=$'\033[36m'; GREEN=$'\033[32m'; RED=$'\033[31m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; RESET=$'\033[0m'

hr() { printf '%s\n' "${DIM}────────────────────────────────────────────────────────${RESET}"; }

echo ""
echo "${CYAN}${BOLD}  ATLAS MIC DOCTOR${RESET}"
hr

if [[ "$(uname)" != "Darwin" ]]; then
  echo "${RED}This script is for macOS (it inspects CoreAudio). Run it on your Mac.${RESET}"
  exit 1
fi

# ── 1. Is the CoreAudio daemon alive? ─────────────────────────────────────
if pgrep -x coreaudiod >/dev/null 2>&1; then
  echo "  coreaudiod (macOS audio engine) ......... ${GREEN}running ✅${RESET}"
  COREAUDIO_OK=1
else
  echo "  coreaudiod (macOS audio engine) ......... ${RED}NOT RUNNING ❌${RESET}"
  COREAUDIO_OK=0
fi

# ── 2. Does macOS see any audio INPUT device? ─────────────────────────────
echo "  scanning audio hardware (takes a few seconds)…"
AUDIO_REPORT="$(system_profiler SPAudioDataType 2>/dev/null)"

# Devices with input channels are microphones (built-in mic, AirPods, USB mics).
INPUT_DEVICES="$(printf '%s\n' "$AUDIO_REPORT" | awk '
  /^        [A-Za-z0-9]/ { name=$0; sub(/^ +/, "", name); sub(/:$/, "", name) }
  /Input Channels: [1-9]/ { print name }
' | sort -u)"

INPUT_COUNT=0
if [[ -n "$INPUT_DEVICES" ]]; then
  INPUT_COUNT=$(printf '%s\n' "$INPUT_DEVICES" | grep -c .)
fi

if [[ "$INPUT_COUNT" -gt 0 ]]; then
  echo "  microphones macOS can see ............... ${GREEN}${INPUT_COUNT} ✅${RESET}"
  printf '%s\n' "$INPUT_DEVICES" | while IFS= read -r dev; do
    echo "      ${DIM}• ${dev}${RESET}"
  done
else
  echo "  microphones macOS can see ............... ${RED}NONE ❌${RESET}"
fi

hr
echo ""

# ── Verdict ───────────────────────────────────────────────────────────────
if [[ "$INPUT_COUNT" -eq 0 || "$COREAUDIO_OK" -eq 0 ]]; then
  echo "${RED}${BOLD}  VERDICT: macOS itself can't see a microphone.${RESET}"
  echo "  This is NOT a Chrome or ATLAS problem — the Mac's audio engine is stuck."
  echo ""
  echo "  ${BOLD}Fix, in order (stop when the mic comes back):${RESET}"
  echo ""
  echo "  1. Restart the audio engine (asks for your Mac password):"
  echo "     ${CYAN}sudo killall coreaudiod${RESET}"
  echo "     Wait 5 seconds, then run this doctor again: ${CYAN}npm run micfix${RESET}"
  echo ""
  echo "  2. Still nothing? Check System Settings → Sound → Input."
  echo "     Open it with: ${CYAN}open \"x-apple.systempreferences:com.apple.Sound-Settings.extension\"${RESET}"
  echo "     If the device list is EMPTY there, restart your Mac ( → Restart)."
  echo ""
  echo "  3. Still empty after a restart? Unplug ALL USB/Thunderbolt docks,"
  echo "     hubs and external displays, then restart again — a dock that"
  echo "     exposes a broken audio device can knock out the whole input list."
else
  echo "${GREEN}${BOLD}  VERDICT: macOS sees your microphone fine.${RESET}"
  echo "  The problem is Chrome not being allowed to use it (or holding a stale device)."
  echo ""
  echo "  ${BOLD}Fix, in order (stop when /mictest turns green):${RESET}"
  echo ""
  echo "  1. Give Chrome mic permission at the macOS level:"
  echo "     ${CYAN}open \"x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone\"${RESET}"
  echo "     → make sure the ${BOLD}Google Chrome${RESET} toggle is ON."
  echo ""
  echo "  2. FULLY quit Chrome — ⌘Q, not just closing the window —"
  echo "     then reopen it. (Chrome only re-reads that toggle on launch.)"
  echo ""
  echo "  3. In Chrome, open ${CYAN}chrome://settings/content/microphone${RESET}"
  echo "     → set the dropdown to your real mic (e.g. 'MacBook Pro Microphone')."
  echo "     A stale/disconnected device stuck here causes exactly this error."
  echo ""
  echo "  4. Retest: ${CYAN}http://localhost:3000/mictest${RESET} → 'Test microphone'."
  echo ""
  echo "  5. Still failing only in Chrome? Try the same page in Safari."
  echo "     If Safari works, Chrome's profile is corrupted — in Chrome go to"
  echo "     chrome://settings/reset and 'Restore settings to original defaults'."
fi

echo ""
hr
echo "${DIM}  When done, verify at http://localhost:3000/mictest — the level bar"
echo "  should jump green when you speak.${RESET}"
echo ""
