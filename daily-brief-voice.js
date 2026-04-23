// Daily brief — builds the spoken briefing text from daily-brief-data.js.
// Invoked by daily-brief-voice.sh. Reads env vars: DATA_FILE, HISTORY_FILE.
// All phrasing variation + personality lives here. The dashboard data stays untouched.

const fs = require('fs');
const code = fs.readFileSync(process.env.DATA_FILE, 'utf8');
const window = {};
eval(code);
const d = window.briefData || {};

const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const now = new Date();
const dayIdx = now.getDay();
const day = dayNames[dayIdx];
const month = monthNames[now.getMonth()];
const date = now.getDate();

// ============ Phrase history (avoid day-to-day repetition) ============
const HISTORY_FILE = process.env.HISTORY_FILE;
let history = {};
try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch (e) {}

function pickNoRepeat(key, arr) {
  if (!arr || arr.length === 0) return null;
  const recent = history[key] || [];
  const memory = Math.min(3, Math.max(1, Math.floor(arr.length * 0.6)));
  const exclude = recent.slice(0, memory);
  const available = arr.map((v, i) => i).filter(i => !exclude.includes(i));
  const pool = available.length > 0 ? available : arr.map((_, i) => i);
  const idx = pool[Math.floor(Math.random() * pool.length)];
  history[key] = [idx, ...(recent.filter(i => i !== idx))].slice(0, memory);
  return arr[idx];
}

// ============ Expand abbreviations for natural speech ============
function normalize(s) {
  if (!s) return "";
  let out = s.replace(/[—·]/g, ", ").replace(/\s+/g, " ");
  const subs = [
    [/\bCOGSCI\b/gi, "Cognitive Science"],
    [/\bUGBA\b/gi, "Business"],
    [/\bPOSCI\b/gi, "Political Science"],
    [/\bPSYCH\b/gi, "Psychology"],
    [/\bECON\b/gi, "Economics"],
    [/\bCOMM\b/gi, "Communications"],
    [/\bBCC Soc(iology)?\b/gi, "Berkeley City College Sociology"],
    [/\bBCC\b/g, "Berkeley City College"],
    [/\bSoc\b/g, "Sociology"],
    [/\bWk\b/gi, "Week"],
    [/\bHr\b/gi, "hour"],
    [/\bmin\b/g, "minutes"],
    [/\bvs\.?\b/gi, "versus"],
    [/\betc\.?\b/gi, "et cetera"],
    [/\be\.g\./gi, "for example"],
    [/\bi\.e\./gi, "that is"],
    [/\bw\//gi, "with"],
    [/\bw\/o\b/gi, "without"],
    [/\bSun\b/g, "Sunday"], [/\bMon\b/g, "Monday"], [/\bTue\b/g, "Tuesday"],
    [/\bWed\b/g, "Wednesday"], [/\bThu\b/g, "Thursday"], [/\bFri\b/g, "Friday"],
    [/\bSat\b/g, "Saturday"],
    [/\b(1[0-2]|0?[1-9])\/([12]?[0-9]|3[01])\b/g, (m, mo, dd) =>
      monthNames[parseInt(mo) - 1] + " " + parseInt(dd)
    ],
    [/(\d)\s*[–-]\s*(\d)/g, "$1 to $2"],
    [/(\d)\s?AM\b/g, "$1 A M"],
    [/(\d)\s?PM\b/g, "$1 P M"],
  ];
  for (const [re, rep] of subs) out = out.replace(re, rep);
  return out.replace(/\s+/g, " ").trim();
}

// ============ Phrase pools ============
const openers = [
  `Good morning, sir. It is ${day}, ${month} ${date}.`,
  `A fine ${day} morning, sir. ${month} ${date}.`,
  `Good morning. Systems are online... It is ${day}, ${month} ${date}.`,
  `At your service, sir. ${day}, ${month} ${date}.`,
  `${day} morning, sir. ${month} ${date}, as scheduled.`,
  `Good morning. Operational status, nominal. It is ${day}, ${month} ${date}.`,
  `Rise and shine, sir. ${day}, the ${date} of ${month}.`,
  `Awake, sir? Splendid. It is ${day}, ${month} ${date}.`,
  `${day}, ${month} ${date}. A pleasure, sir.`,
];

const prioLeadIns = [
  "Your priorities for today.",
  "Here is what requires your attention.",
  "Today's docket, sir.",
  "The day's objectives.",
  "On the agenda.",
  "Matters to address today.",
  "Your targets for the day.",
];

const nextLeadIns = [
  (t, time) => `Your next engagement is ${t}, at ${time}.`,
  (t, time) => `Coming up... ${t}, at ${time}.`,
  (t, time) => `First on the calendar, sir: ${t}, at ${time}.`,
  (t, time) => `Your ${time} appointment: ${t}.`,
  (t, time) => `Ahead of you at ${time}: ${t}.`,
];

const tipsLeadIns = [
  (f) => `A note, sir. Before your ${f}...`,
  (f) => `Regarding your ${f}, a few items of preparation.`,
  (f) => `Before you meet for your ${f}, sir. Consider the following.`,
  (f) => `Preparation for your ${f}, sir.`,
  (f) => `A briefing within the briefing, sir, for your ${f}.`,
];

const closers = [
  "Have a strong day, sir.",
  "The day is yours, sir.",
  "Onward, sir.",
  "Do make it count.",
  "I shall be here if you require me.",
  "Godspeed, sir.",
  "Go do something worth remembering.",
  "Try to enjoy yourself, sir. Within reason.",
  "That concludes the briefing. Execute.",
];

// ============ Workout section — what you are hitting today, with a tailored joke ============
const workoutPlans = [
  {
    match: /rest/i,
    lead: "No lifting today, sir.",
    jokes: [
      "A rest day. Try not to enjoy it too much.",
      "Recovery. The gains, they tell me, happen off the bench.",
      "Rest day. Walk somewhere. Slowly.",
      "A day without iron. Try to find meaning elsewhere.",
      "Rest, sir. The unglamorous half of the program.",
    ],
  },
  {
    match: /chest.+tri|push/i,
    lead: "In the gym today... chest and triceps.",
    jokes: [
      "Push day. Form over ego, sir.",
      "The bench press awaits. Try not to get too attached to the mirror.",
      "A classic push session. Straightforward work, sir.",
      "Chest and triceps. Do pause between sets to breathe.",
      "Push day, sir. Leave some in the tank for the triceps.",
    ],
  },
  {
    match: /back.+bi|pull/i,
    lead: "Pull day today, sir. Back and biceps.",
    jokes: [
      "Back and biceps. Your posture will thank you, eventually.",
      "Rows and pull-ups, sir. The unsung heroes.",
      "Pull day. A reminder that biceps are not the only thing back there.",
      "Back work today. Try not to make it all about the arms, sir.",
      "Pull day, sir. Do some actual rows. The curls can wait.",
    ],
  },
  {
    match: /leg/i,
    lead: "Leg day today, sir.",
    jokes: [
      "Legs. My sincerest sympathies.",
      "Leg day. You will regret it tomorrow, and rightly so.",
      "Nobody skips leg day. Certainly not you. Not today.",
      "Squats await, sir. Quad hell, as promised.",
      "Legs. The honest lift. There is nowhere to hide.",
      "Leg day, sir. Walking will be a negotiation by evening.",
    ],
  },
  {
    match: /cardio|condition|abs/i,
    lead: "Cardio and abs today, sir.",
    jokes: [
      "The price of Friday evening beers, perhaps.",
      "Cardio. A tax on cardiovascular neglect.",
      "Brief, painful, efficient. The trifecta, sir.",
      "Cardio and abs. Do try to breathe through the nose.",
      "A sprint and suffer affair, sir. Keep it honest.",
    ],
  },
  {
    match: /open|recovery|walk/i,
    lead: "An open training day, sir.",
    jokes: [
      "Use it wisely. Or wastefully. Your choice.",
      "An unscheduled day. Do something, sir. Even a walk counts.",
      "Open programming. Resist the urge to overthink it.",
    ],
  },
];

function buildWorkoutSection(wk) {
  if (!wk || !wk.day) return null;
  const plan = workoutPlans.find(p => p.match.test(wk.day));
  if (!plan) {
    return [`In the gym today, sir: ${wk.day}.`, "Make it count."];
  }
  const jokeKey = `wk:${plan.lead.slice(0, 20)}`;
  return [plan.lead, pickNoRepeat(jokeKey, plan.jokes)];
}

// ============ Build the briefing ============
let parts = [];

parts.push(pickNoRepeat("opener", openers));

const pcount = (d.priorities || []).length;
if (pcount > 0) {
  parts.push(pickNoRepeat("prioLead", prioLeadIns));
  (d.priorities || []).forEach((p, i) => {
    const prefix = i === 0 ? "First," : i === 1 ? "Second," : i === 2 ? "Third," : `Item ${i + 1}.`;
    parts.push(`${prefix} ${normalize(p)}.`);
  });
}

// Workout + joke
const wkSection = buildWorkoutSection(d.workout);
if (wkSection) {
  parts.push(...wkSection);
}

// Next event — skip if already covered by prep tips (same event, within 30 min)
const upcoming = (d.today || [])
  .filter(e => e.at && new Date(e.at) > now)
  .sort((a, b) => new Date(a.at) - new Date(b.at));

if (upcoming.length > 0) {
  const ne = upcoming[0];
  let skipNext = false;
  if (d.tips && d.tips.at && ne.at) {
    const deltaMin = Math.abs(new Date(d.tips.at) - new Date(ne.at)) / 60000;
    if (deltaMin < 30) skipNext = true;
  }
  if (!skipNext) {
    const at = new Date(ne.at);
    const h12 = ((at.getHours() + 11) % 12) + 1;
    const mm = at.getMinutes();
    const ampm = at.getHours() >= 12 ? "P M" : "A M";
    const tStr = mm === 0 ? `${h12} ${ampm}` : `${h12} ${mm.toString().padStart(2, "0")} ${ampm}`;
    parts.push(pickNoRepeat("nextLead", nextLeadIns)(normalize(ne.title), tStr));
  }
}

if (d.tips && d.tips.items && d.tips.items.length > 0) {
  parts.push(pickNoRepeat("tipsLead", tipsLeadIns)(d.tips.for ? normalize(d.tips.for) : "upcoming engagement"));
  d.tips.items.slice(0, 2).forEach(t => parts.push(`${normalize(t)}.`));
}

// Auth-token / stale-data warning — fires if refresh has not run in >8h
if (d.updatedAt) {
  const hoursAgo = (now.getTime() - new Date(d.updatedAt).getTime()) / 3600000;
  if (hoursAgo > 18) {
    parts.push(`A technical note, sir. The dashboard has not refreshed in ${Math.round(hoursAgo)} hours. The Google authentication tokens have likely expired. Run npm run auth to re-authorize.`);
  } else if (hoursAgo > 8) {
    parts.push(`A minor note, sir. The dashboard data is ${Math.round(hoursAgo)} hours old. If this persists, check the Google authentication.`);
  }
}

parts.push(pickNoRepeat("closer", closers));

try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2)); } catch (e) {}

process.stdout.write(parts.join(" "));
