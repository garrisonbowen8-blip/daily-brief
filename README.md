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

When setup runs `npm run auth`, a browser window opens asking you to sign in and grant access. After you approve, Google redirects to `http://localhost:3456` — this is a local-only callback and the page will show a "connection refused" error, which is expected. The token is captured before the redirect and saved to `config.json` automatically.

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
| `npm run refresh` | Pull latest calendar/email data and push to GitHub |
| `npm run voice` | Play the voice briefing right now (all platforms) |
| `npm run auth` | Re-authorize Google (if tokens expire) |
| `bash scripts/install-voice.sh` | (Re)install the automatic morning schedule — Mac only |

> **Note:** `npm run refresh` commits `daily-brief-data.js` and pushes to your GitHub remote. Make sure you have push access configured (`git remote -v` should show your fork).

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

## Voice briefing

The voice runs on all platforms. To play it manually at any time:

```bash
npm run voice
```

To have it run automatically every morning, follow the instructions for your operating system below.

---

### Mac — automatic scheduling

Run this once after setup:

```bash
bash scripts/install-voice.sh
```

That's it. Your Mac will play the briefing every morning at the time you set. To change the time, update `voice.scheduleTime` in `config.json` and run the script again.

Log output goes to `~/.daily-brief.log`.

---

### Windows — automatic scheduling

Windows doesn't use the same scheduling system as Mac, but you can set it up through a built-in tool called **Task Scheduler**:

1. Search for **Task Scheduler** in the Start menu and open it
2. Click **Create Basic Task** on the right side
3. Give it a name like `Daily Brief` and click Next
4. Choose **Daily**, click Next, and set your wake-up time
5. Choose **Start a program**, then set:
   - **Program:** `node`
   - **Arguments:** `scripts\voice.js`
   - **Start in:** the full path to your daily-brief folder (e.g. `C:\Users\YourName\daily-brief`)
6. Click Finish

No extra software needed — the script uses Windows' built-in audio player.

> **Note:** iMessage delivery is not available on Windows.

---

### Linux — automatic scheduling

Add a line to your system's task scheduler (called **cron**):

1. Open a terminal and run: `crontab -e`
2. Add this line at the bottom (adjust the time and folder path):

```
45 8 * * * cd /path/to/daily-brief && node scripts/voice.js >> ~/.daily-brief.log 2>&1
```

This says: "at 8:45 AM every day, go to the daily-brief folder and run the voice script." Change `45 8` to your preferred time (minute then hour, 24-hour format).

3. Save and close. The job is now active.

If audio doesn't play, install a player first:
```bash
sudo apt install mpg123
```

> **Note:** iMessage delivery is not available on Linux.

---

## Built with

- Vanilla HTML/CSS/JS — no framework, no build step
- Google Calendar API + Gmail API (via `googleapis`)
- ElevenLabs TTS
- Cloudflare Pages
