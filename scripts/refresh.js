#!/usr/bin/env node
// Fetches Google Calendar + Gmail data and writes daily-brief-data.js.
// Run manually or via launchd: node scripts/refresh.js
// Requires config.json (from setup.sh) and my-data.json (your personal data).

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const MY_DATA_PATH = path.join(ROOT, 'my-data.json');
const OUT_PATH = path.join(ROOT, 'daily-brief-data.js');

// ── Helpers ────────────────────────────────────────────────────────────────

function loadJSON(p, label) {
  if (!fs.existsSync(p)) {
    console.error(`${label} not found at ${p}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function getOAuthClient(cfg) {
  const { clientId, clientSecret, tokens } = cfg.google;
  if (!tokens) {
    console.error('No Google tokens found. Run: npm run auth');
    process.exit(1);
  }
  const client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3456');
  client.setCredentials(tokens);
  client.on('tokens', updated => {
    const fresh = loadJSON(CONFIG_PATH, 'config.json');
    fresh.google.tokens = { ...fresh.google.tokens, ...updated };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(fresh, null, 2));
  });
  return client;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12}:00 ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

// Classify event tag from title keywords
function inferTag(title) {
  const t = title.toLowerCase();
  if (/exam|final|midterm|due|deadline|submit/.test(t)) return 'critical';
  if (/interview|call|meeting|mckinsey|recruiter/.test(t)) return 'priority';
  return null;
}

// ── Google Calendar ────────────────────────────────────────────────────────

async function fetchCalendarEvents(auth, calendarId) {
  const cal = google.calendar({ version: 'v3', auth });
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const in31Days = new Date(now); in31Days.setDate(now.getDate() + 31);

  const res = await cal.events.list({
    calendarId,
    timeMin: todayStart.toISOString(),
    timeMax: in31Days.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  });

  return res.data.items || [];
}

function buildEventItem(ev) {
  const startRaw = ev.start.dateTime || ev.start.date;
  const endRaw   = ev.end?.dateTime || ev.end?.date || null;
  const isAllDay = !ev.start.dateTime;
  const title = stripHtml(ev.summary || 'Untitled');
  return {
    time: isAllDay ? 'All day' : formatTime(startRaw),
    title,
    tag: inferTag(title),
    at: isAllDay ? null : startRaw,
    end: isAllDay ? null : endRaw,
  };
}

// ── Gmail ─────────────────────────────────────────────────────────────────

async function fetchPriorityEmails(auth) {
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread is:inbox newer_than:1d',
      maxResults: 10,
    });
    const msgs = res.data.messages || [];
    const subjects = [];
    for (const msg of msgs.slice(0, 5)) {
      const detail = await gmail.users.messages.get({
        userId: 'me', id: msg.id, format: 'metadata',
        metadataHeaders: ['Subject', 'From'],
      });
      const headers = detail.data.payload.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
      const from = headers.find(h => h.name === 'From')?.value || '';
      subjects.push({ subject, from });
    }
    return subjects;
  } catch (_) {
    return [];
  }
}

// ── Build data file ────────────────────────────────────────────────────────

async function main() {
  const cfg = loadJSON(CONFIG_PATH, 'config.json');
  const myData = fs.existsSync(MY_DATA_PATH)
    ? JSON.parse(fs.readFileSync(MY_DATA_PATH, 'utf8'))
    : {};

  const auth = getOAuthClient(cfg);
  console.log('Fetching calendar events...');
  const allEvents = await fetchCalendarEvents(auth, cfg.google.calendarId || 'primary');
  console.log(`  ${allEvents.length} events found`);

  console.log('Fetching Gmail...');
  const emails = await fetchPriorityEmails(auth);
  console.log(`  ${emails.length} unread priority emails`);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  // Split events into today / this week / next 30 days
  const todayEvents = [];
  const weekEvents = [];
  const monthEvents = [];

  for (const ev of allEvents) {
    const startRaw = ev.start.dateTime || ev.start.date;
    const evDate = startRaw.slice(0, 10);
    const daysOut = daysBetween(todayStr, evDate);

    if (daysOut === 0) {
      todayEvents.push(buildEventItem(ev));
    } else if (daysOut >= 1 && daysOut <= 7) {
      const d = new Date(startRaw);
      const dayLabel = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
      const mo = d.getMonth() + 1;
      const dd = d.getDate();
      const level = inferTag(stripHtml(ev.summary || '')) === 'critical' ? 'hot'
                  : inferTag(stripHtml(ev.summary || '')) === 'priority' ? 'warn' : null;
      weekEvents.push({ date: `${dayLabel} ${mo}/${dd}`, title: stripHtml(ev.summary || ''), ...(level ? { level } : {}) });
    } else if (daysOut > 7 && daysOut <= 31) {
      const d = new Date(startRaw);
      const mo = d.getMonth() + 1;
      const dd = d.getDate();
      const level = inferTag(stripHtml(ev.summary || '')) === 'critical' ? 'hot'
                  : inferTag(stripHtml(ev.summary || '')) === 'priority' ? 'warn' : null;
      monthEvents.push({ date: `${['Mon','Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d.getDay()] } ${mo}/${dd}`, title: stripHtml(ev.summary || ''), ...(level ? { level } : {}) });
    }
  }

  // Priorities: critical today events + upcoming exams/finals with countdowns + extra from my-data
  const autoPriorities = todayEvents
    .filter(e => e.tag === 'critical' || e.tag === 'priority')
    .map(e => `${e.title}${e.time !== 'All day' ? ` — ${e.time}` : ''}`);

  // Surface upcoming exams and hard deadlines (next 30 days) with a day countdown
  const upcomingCritical = allEvents
    .filter(ev => {
      const title = stripHtml(ev.summary || '');
      if (/waitlist/i.test(title)) return false;
      const startRaw = ev.start.dateTime || ev.start.date;
      const daysOut = daysBetween(todayStr, startRaw.slice(0, 10));
      return daysOut > 0 && daysOut <= 30 && inferTag(title) === 'critical';
    })
    .sort((a, b) => new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date))
    .slice(0, 3)
    .map(ev => {
      const startRaw = ev.start.dateTime || ev.start.date;
      const daysOut = daysBetween(todayStr, startRaw.slice(0, 10));
      const d = new Date(startRaw);
      const mo = d.getMonth() + 1;
      const dd = d.getDate();
      const title = stripHtml(ev.summary || '');
      return `${title} — ${mo}/${dd} (${daysOut} day${daysOut === 1 ? '' : 's'})`;
    });

  const extraPriorities = (myData.extraPriorities || []).filter(p => !p.startsWith('_comment'));
  const priorities = [...new Set([...autoPriorities, ...upcomingCritical, ...extraPriorities])].slice(0, 6);

  // Workout — pick today's split
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = dayNames[now.getDay()];
  const workout = (myData.workout || {})[todayName] || { day: 'Rest', moves: [] };

  // Focus project, study, tips from my-data
  const focusProject = myData.focusProject || null;
  const study = myData.study || null;
  const tips = myData.tips || null;

  // Location
  const location = cfg.location || { name: 'Your City', lat: 0, lng: 0 };

  // Obsidian (optional)
  const obsidian = cfg.obsidian?.enabled ? {
    vaultPath: cfg.obsidian.vaultPath,
    inboxCount: 0,
    recentNotes: [],
  } : undefined;

  const data = {
    updatedAt: now.toISOString(),
    generatedFor: todayStr,
    today: todayEvents,
    priorities,
    week: weekEvents,
    month: monthEvents,
    workout,
    ...(focusProject ? { focusProject } : {}),
    ...(study ? { study } : {}),
    ...(tips ? { tips } : {}),
    location,
    ...(obsidian ? { obsidian } : {}),
  };

  const js = `// Auto-generated by scripts/refresh.js — ${new Date().toLocaleString()}\nwindow.briefData = ${JSON.stringify(data, null, 2)};\n`;
  fs.writeFileSync(OUT_PATH, js);
  console.log('Wrote daily-brief-data.js');

  // Git push — DISABLED by default: background auto-commits kept colliding
  // with development work (divergent branches on every pull). The data file
  // is still written locally above. To re-enable (e.g. if a deployed dashboard
  // reads this file from GitHub), set DAILY_BRIEF_GIT_PUSH=1 in the environment.
  if (process.env.DAILY_BRIEF_GIT_PUSH === '1') {
    try {
      execSync('git add daily-brief-data.js && git commit -m "chore: refresh brief data" && git push', {
        cwd: ROOT, stdio: 'inherit',
      });
      console.log('Pushed to GitHub.');
    } catch (_) {
      console.log('Git push failed or nothing to commit — data file still updated locally.');
    }
  } else {
    console.log('Data file updated locally (git auto-commit off).');
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
