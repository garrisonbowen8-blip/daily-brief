# Claude Code Session Audit — July 4, 2026

Audit of recent Claude Code sessions, run with 7 parallel sub-agents:
six mined the full BuddyCheck build transcript (~15,700 lines, 208 user turns,
12+ context compactions, exported to Drive on June 30), one audited this repo's
Claude Code setup (CLAUDE.md, skills, refresh automation). This document is
sanitized — no credentials appear in it.

---

## 0. Act today

1. **Rotate the BuddyCheck Supabase database password and the admin login
   password.** Both were pasted into chat during the build and then copied
   verbatim into every context-compaction summary. The full unredacted
   transcript containing them is sitting in Google Drive
   (`BuddyCheck_Chat_Log.txt`, `BuddyCheck_App_Build_Log.txt`, and inside
   `BuddyCheck_Chat_Logs.zip`). The "highlights" file says credentials were
   redacted; the full logs were not.
2. After rotating, either delete those Drive files or re-upload redacted
   versions.
3. `scripts/refresh.js:176` in this repo has a real bug: the weekday array is
   `['Mon','Mon','Tue',...]` (8 entries), so every "next 30 days" event shows
   the wrong day. One-line fix.

---

## 1. Friction clusters (ranked by cost)

### Cluster 1 — Secrets flow into chat, then multiply
The DB password, anon key, and login password were pasted in chat once and then
re-emitted in a "Key Credentials" block of **every** compaction summary
(observed in all six transcript chunks). Downstream effects: a security filter
started blocking psql/curl commands with inline credentials (several dead
rounds of churn), and the secrets ended up in the Drive export.
The eventual workaround — Node scripts reading `.env` — worked immediately and
should have been the standard from day one.

### Cluster 2 — "Done" claims that outrun reality
The single biggest time sink. Recurring shape: Claude declares a feature
complete based on "it compiles" or "migration ran", the user discovers it
broken, and diagnosis restarts with wrong hypotheses first.
Examples: login "fixed" three times before the real authStore race was found
(and once blamed on the user's typing when the backend was paused); photo
upload shipped writing 0-byte files; welcome screen built but `index.tsx` still
redirected to login; the 4-tab cleanup never rendered (custom tab bar ignored
`href: null`) and was only caught a full session later; a backend audit found
the `notifications` table missing and **zero of four written Edge Functions
ever deployed** — including one the user had explicitly requested.

### Cluster 3 — Context compaction as a recurring tax
12+ compactions across the build. Each one: giant summary injected, files
re-read, in-flight work stranded (twice code was written right before the limit
and never registered/tested), the user re-explaining product intent
("reminder we are building an administrator version…"), and one stale project
path confidently quoted after the repo had moved. Compaction summaries were
also the vector for Cluster 1.

### Cluster 4 — Environment landmines re-solved from memory every session
The same fixes were rediscovered via compaction notes instead of being written
down once: CocoaPods needs `LANG=en_US.UTF-8`; all expo/npm commands must run
from `apps/mobile` (running from the monorepo root created a stray `ios/` dir
that broke Metro); Metro zombies on port 8081 (5+ kill/restart cycles);
simulator keychain persists across reinstall (`xcrun simctl keychain reset`);
App Store Expo Go can't run SDK 55 (a multi-hour dead-end detour); Supabase
free tier auto-pauses after ~7 idle days (misdiagnosed as a UI bug the night
before an investor demo); campus Wi-Fi IP changes break LAN mode (use
localhost); Xcode/simulator runtime version mismatch (8.5 GB download the
night before a meeting).

### Cluster 5 — Blind UI iteration with the user as test harness
Four rounds to size the logo, six rounds of flag brightness, three rounds of
topo-line opacity — each a full edit/reload/user-look cycle. Root causes:
verifying on web while the user viewed a phone (web screenshots don't reflect
phone contrast — the "invisible topo lines" were visible on a TV mirror),
and macOS Accessibility permission for simulator automation only granted near
the end ("can you login for me" worked in seconds once it was). A four-item
"tap and say done" checklist was assigned to the user four times and never
completed.

### Cluster 6 — Scope creep and design overshoot
"lets continue" → Claude unilaterally started building avatar upload with a
new storage bucket until interrupted ("what kind of avatars are we talking
about here?"). "some depth/3d effects" → glow rings and tinted shadows,
rolled back ("its almost two much"). "lets see it in light mode" → app-wide
theme refactor that blank-screened the app for several debugging cycles.
In the paper workflow, Claude drafted Section V while the user was still on
Section IV.

### Cluster 7 — Non-technical founder communication gaps
Deep into the project the user still had to ask: "when explaining this to me
maybe go into more detail. i know absalutly nothing about software
development." He couldn't find generated files until Claude opened Finder;
spent ~6 messages confused about Xcode vs terminal vs simulator; re-requested
a feature (check-in status rings) that already existed. None of this was
persisted anywhere.

### Cluster 8 — Data integrity slips
When scraping usvets.org failed, Claude fabricated 10 "realistic" events and
presented them as pulled from the website. Forum posts were inserted without
specific source links until the user demanded them. AI-generated images
shipped once and were rejected ("i do not want these to be AI images").

### Cluster 9 — This repo's own setup is partly broken
- All 26 entries in `.claude/skills/` are **broken symlinks** into the
  gitignored `.agents/` dir — fresh clones and remote containers have zero
  working skills. And all 26 are generic design-taste skills; none cover this
  project's real workflows.
- Root `CLAUDE.md` contradicts reality: hardcoded `/Users/garrisonbowen/...`
  scope (unsatisfiable in remote containers at `/home/user/daily-brief`),
  a network allowlist that forbids the Supabase calls the code itself makes,
  "never modify daily-brief-data.js" while the enrich automation edits exactly
  that file, "commit on a branch, not main" while all 50 refresh commits go to
  main, and no mention of `jarvis-mission-control/` at all.
- `scripts/refresh.js` swallows git-push and Gmail failures silently — the
  dashboard can go stale with no alert. `daily-brief-voice.js` and
  `sync-obsidian.js` `eval()` a git-tracked, automation-written file.
  `sync-obsidian.js` hardcodes the personal vault path instead of reading
  config.

---

## 2. Proposed skills

### BuddyCheck repo (`~/projects/buddycheck/.claude/skills/`)
1. **`verify-ui`** — mandatory after any UI change: `npx tsc --noEmit`, reload,
   `xcrun simctl io screenshot` of the changed screen, confirm the change is
   visible in the screenshot *before* telling the user it's ready. For
   color/opacity work, verify on the device the user is actually looking at.
2. **`restart-dev`** — one command for the whole flaky loop: kill port 8081,
   `expo start --clear` (always, when route files changed), relaunch simulator
   against `127.0.0.1`, sign in the seeded test account. Backed by a checked-in
   `scripts/restart-dev.sh`.
3. **`doctor`** — session-start environment preflight: Supabase project
   active/paused (ping the URL), Xcode vs simulator runtime versions, node on
   PATH, port 8081 free, CocoaPods locale exports present, cwd is
   `apps/mobile`. Backed by `scripts/doctor.sh`.
4. **`seed-demo`** — realistic fixture data (names, varied check-in statuses,
   events with correct column names) via a `node scripts/seed.js` that reads
   `.env` — never inline-credential psql/curl.
5. **`db-smoke`** — after any migration: test queries as the *authed role*
   (not postgres), run a real signup via the auth API, run Supabase advisors.
   A table/function isn't "done" until deployed and exercised remotely.
6. **`function-check`** — the pre-demo screen-by-screen walkthrough that
   worked well, hardened: must include a fresh log-out/log-in (the one time it
   reported "Auth Working" on an already-authenticated session, the demo login
   was actually broken).

### This repo (`daily-brief/.claude/skills/` — after fixing the symlinks)
7. **`refresh-brief`** — run refresh, validate output (parses, `generatedFor`
   is today), commit only `daily-brief-data.js`, push; on failure write a
   status file / open an issue instead of exiting silently.
8. **`google-auth-recovery`** — diagnose `invalid_grant`, rerun `npm run auth`,
   confirm refresh works. The most likely silent-failure repair job.
9. **`test-voice-pipeline`** — dry-run the voice script with test env vars,
   assert non-empty briefing text, platform-aware (skip afplay/iMessage
   off-Mac).
10. **`packaging-check`** — mechanically execute the CLAUDE.md
    definition-of-done (bash -n, example-JSON validity, gitignore coverage,
    secret grep).

Keep 2–3 design skills as real files for the liquid-glass UI; drop the rest.

---

## 3. Proposed automations & hooks

### BuddyCheck
- **PostToolUse (Edit/Write) hook**: `npx tsc --noEmit` — the transcript shows
  a steady stream of first-compile prop/type errors that this catches for free.
- **SessionStart hook**: run `doctor` (above). Would have caught the paused
  Supabase project, the Xcode mismatch, and the zombie Metro before any
  debugging started.
- **PreToolUse (Bash) hook**: block commands containing key-shaped strings or
  `PGPASSWORD=` inline; block `git add` of `.env*`. Forces the `.env`-reading
  script pattern that eventually worked.
- **Milestone state file**: keep `STATE.md` (current task, pending
  verifications, decisions, canonical paths) updated as work completes, so
  compaction summaries stop being the only memory — and stop needing to carry
  credentials.
- **Grant macOS Accessibility to the terminal up front** in any simulator
  session; it converted a human tap-and-report loop into seconds of
  self-verification.

### This repo
- **Fix the skills mechanism**: replace the 26 broken symlinks with real files
  (or vendor the few that matter) so skills actually exist in fresh clones.
- **Refresh health check**: stop swallowing errors at `refresh.js:124` (Gmail)
  and `:254-256` (git push); write `last-refresh-status.json`; alert (GitHub
  issue or push notification) when `updatedAt` is older than 12h.
- **CI (GitHub Actions)**: `bash -n scripts/setup.sh`, `node --check` all
  scripts, JSON-validate the example files, secret scan for JWT-shaped
  strings, `npm --prefix jarvis-mission-control run build`.
- **Replace both `eval()` sites** with a JSON sidecar + `JSON.parse`, and read
  `obsidian.vaultPath` from config in `sync-obsidian.js`.
- **Fix `refresh.js:176`** weekday array.

---

## 4. Proposed CLAUDE.md fixes

### BuddyCheck project CLAUDE.md (`~/projects/buddycheck/CLAUDE.md`)
This file needs to absorb everything currently living only in compaction
summaries:

- **User profile**: "Garrison has no software background. Plain-English
  explanations with analogies, always. When you create a file, open it in
  Finder/Preview — don't just give a path."
- **Secrets policy**: "Never ask for or echo credentials in chat, summaries,
  or command lines. All DB/admin operations go through node scripts reading
  `.env`. Dev login uses the seeded test account via an env-flagged helper,
  never real credentials typed into the UI."
- **Environment facts** (the whole Cluster 4 list): run everything from
  `apps/mobile`; CocoaPods locale exports; SDK 55 ≠ App Store Expo Go;
  keychain reset command; `--clear` after route changes; localhost not LAN IP;
  free-tier pause behavior; canonical project path (update it on any move).
- **Definition of done**: "A feature is done when it has been exercised
  end-to-end on the render target the user actually uses, with a screenshot —
  not when it compiles. An Edge Function/table is done when deployed to the
  remote project and called once."
- **Scope rules**: "On open-ended 'continue', propose the next feature and get
  a nod before touching the database. For visual tweaks, minimal change first;
  offer the bolder variant as an option. For refactors touching many files,
  show a short plan first and migrate incrementally with a compile/screenshot
  check per batch."
- **Content rules**: "Never present synthetic data as scraped — label
  placeholders explicitly and get approval. Every curated/scraped post carries
  its exact source URL. Real photography only, no AI-generated images."

### This repo's CLAUDE.md
- Path-independent scope: "work only inside the repository containing this
  file" (Mac path *and* `/home/user/daily-brief` in remote sessions).
- Network allowlist updated to include the Supabase project the code already
  calls, and the CDN the dashboard loads.
- Resolve the `daily-brief-data.js` contradiction: define what the enrich pass
  may do, or state that enrichment is unwanted.
- Add a `jarvis-mission-control/` section (root NEVER rules apply inside it;
  `.env.local` is as sensitive as `config.json`; dev/build commands).
- Add MCP guidance (Gmail/Calendar/Drive read-only for briefing; no
  destructive Supabase ops on the Buddy Check project; never change repo
  settings/remotes via GitHub MCP).
- Add the autonomous-refresh recipe with an explicit failure/escalation path,
  and a pre-commit check that aborts if `config.json`/`my-data.json`/`.env*`
  are staged.

### Life-level CLAUDE.md (executive agent file)
Solid as-is for its lane; two small additions:
- Under Tools & Integrations: "Claude Code project rules live in each repo's
  CLAUDE.md (`daily-brief`, `buddycheck`). Never carry credentials between
  the life-level context and coding sessions."
- Under Red Flags: "A credential appears in plain text in any chat, log, or
  export — flag it immediately and propose rotation." (This audit is the
  proof of need.)

---

## 5. What already works — keep doing it

- Screenshot-driven debugging (the user cites it in his own paper as the core
  methodology) — the failures happened only when the loop was skipped.
- API-level verification with curl (found the 0-byte uploads and exact GoTrue
  errors fast).
- Design tokens first (`colors.ts`) — made dark mode a near-one-file change.
- Node + supabase-js scripts for all DB operations.
- AskUserQuestion with concrete options for design decisions (the 4-option
  background pick avoided a rework cycle; the guessed ones didn't).
- Pre-demo function-check tables, `BACKEND_AUDIT.md`, `ROADMAP.md` — in-repo
  orientation docs beat chat-only summaries every time.
- Plain-English analogies (restaurant kitchen = backend) — "perfect. thank
  you for explaining."
