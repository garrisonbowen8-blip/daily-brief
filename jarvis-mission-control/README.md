# JARVIS Mission Control

Single-screen personal mission control: dark, dense, terminal-meets-cockpit.
Next.js (App Router) + TypeScript + Tailwind. Everything is real where a data
source exists; everything else is a clearly-labeled `STUB` / `LOCKED` tile.

## What's real

| Panel | Source | Route |
|---|---|---|
| System vitals | `os` + `systeminformation`, polled every 2 s | `/api/system` |
| Daily Brief | Calendar + Gmail + training plan, ranked priorities, spoken aloud | `/api/brief` |
| Voice | Web Speech API (push-to-talk + "Hey JARVIS") → ElevenLabs proxy, browser-TTS fallback | `/api/tts`, `/api/command` |
| Today | Google Calendar (next 3 events + "free until") | `/api/calendar` |
| Inbox | Gmail (unread, needs-reply, urgent) | `/api/gmail` |
| Drive | 5 most recently modified files | `/api/drive` |
| Buddy Check pulse | Supabase, read-only counts (verified vets, check-ins 24 h, threads, matches) | `/api/supabase` |
| Obsidian | Reads the vault folder directly (recent notes, open tasks, canvases) | `/api/obsidian` |
| Porter Metrics | Remote-MCP wiring; shows **not connected** until creds are set | `/api/porter` |

Stubs (status chip says so): Microsoft 365, Canva, Indeed, Credit Karma
(sensitive — manual unlock), PubMed, Blotato (`// TODO: connect Blotato`),
agents panel, task queue, notifications, quick actions.

Every connector route degrades to `{ connected: false, reason }` — a dead
connector shows "not connected" on its tile, never crashes the dashboard.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in what you have; everything is optional
npm run dev                  # http://localhost:3000
```

- **Google** — reuses `../config.json` from the daily-brief setup
  (`scripts/setup.sh` + `npm run auth` in the parent repo).
- **ElevenLabs** — `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` in `.env.local`.
  Missing → browser TTS with an "add ElevenLabs key" note.
- **Supabase** — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server-side
  only; queries are read-only head counts).
- **Obsidian** — `OBSIDIAN_VAULT_PATH=/path/to/vault`.

Secrets live in `.env.local`, which is covered by `.gitignore` (`.env*`)
from the first commit.
