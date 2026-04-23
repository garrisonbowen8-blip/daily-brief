# Daily Brief

A liquid-glass personal dashboard with a JARVIS-style morning voice briefing.

- **Live calendar + email** — pulls from Google Calendar and Gmail every morning
- **JARVIS voice** — spoken briefing via ElevenLabs TTS at a time you choose
- **iMessage delivery** — MP3 sent to your phone after playback (Mac only)
- **Fully personal** — workout split, focus project, study block, prep tips all in one place
- **Deployed as a web app** — add to iPhone home screen, open on any device

---

## Setup (~5 minutes)

### Prerequisites
- [Node.js](https://nodejs.org) (v18+)
- [Git](https://git-scm.com)
- A Google account (Calendar + Gmail)
- An [ElevenLabs](https://elevenlabs.io) account (free tier works)

### Step 1 — Fork and clone

```bash
git clone https://github.com/YOUR_USERNAME/daily-brief
cd daily-brief
```

### Step 2 — Run setup

```bash
bash scripts/setup.sh
```

The wizard will ask for:
- Your name and city
- Google OAuth credentials (see below)
- Your ElevenLabs API key and Voice ID
- Your GitHub repo name (for deployment)

The wizard then opens a browser for Google authorization, runs your first data refresh, and sets up the daily morning briefing (Mac only).

### Step 3 — Personalize your data

Edit `my-data.json` to set:
- Your weekly workout split (by day name)
- Your current focus project
- Your study block
- Standing priorities

### Step 4 — Deploy

Push to GitHub and connect [Cloudflare Pages](https://pages.cloudflare.com) to your repo. Every `git push` redeploys automatically.

---

## Getting Google OAuth Credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable two APIs: **Google Calendar API** and **Gmail API**
   - APIs & Services → Library → search each one → Enable
4. Create credentials: APIs & Services → Credentials → **Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Desktop app**
5. Copy the **Client ID** and **Client Secret** — paste them when setup.sh asks

---

## Getting an ElevenLabs Voice

1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Go to **Voice Library** and clone any voice you like, or create your own with Voice Cloning
3. Copy the **Voice ID** from the voice's detail page (the string in the URL or the copy button)
4. Your **API Key** is under Profile → API Keys

---

## Daily workflow

The dashboard auto-refreshes from Google Calendar every morning before your briefing. You can also refresh manually anytime:

```bash
npm run refresh
```

---

## Commands

| Command | What it does |
|---|---|
| `bash scripts/setup.sh` | Full setup wizard (first time) |
| `npm run refresh` | Pull latest calendar/email data and push |
| `npm run auth` | Re-authorize Google (if tokens expire) |

---

## Config files

| File | Purpose | In git? |
|---|---|---|
| `config.json` | Your credentials and settings | No (gitignored) |
| `my-data.json` | Workout, focus project, study block | No (gitignored) |
| `config.example.json` | Template — copy to config.json | Yes |
| `my-data.example.json` | Template — copy to my-data.json | Yes |
| `daily-brief-data.js` | Auto-generated data file | Yes |

---

## Voice briefing (Mac only)

The morning briefing is powered by ElevenLabs and scheduled via `launchd`. If you need to change the time, edit your plist at:

```
~/Library/LaunchAgents/com.dailybrief.refresh.plist
```

Then reload it:
```bash
launchctl unload ~/Library/LaunchAgents/com.dailybrief.refresh.plist
launchctl load  ~/Library/LaunchAgents/com.dailybrief.refresh.plist
```

---

## Built with

- Vanilla HTML/CSS/JS — no framework, no build step
- Google Calendar API + Gmail API (via `googleapis`)
- ElevenLabs TTS
- Cloudflare Pages
