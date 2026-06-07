#!/usr/bin/env node
// Reads today's completed checklist items from Supabase and writes a dated
// Obsidian note under Daily Log/YYYY-MM-DD.md. Safe to run repeatedly — it
// overwrites the same file so the note always reflects current state.

const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

const VAULT_PATH = '/Users/garrisonbowen/Documents/Obsidian';
const LOG_DIR    = path.join(VAULT_PATH, 'Daily Log');
const ROOT       = path.join(__dirname, '..');
const BRIEF_DATA = path.join(ROOT, 'daily-brief-data.js');

const SUPA_URL = 'https://woqtddskdbwmoygyeucg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvcXRkZHNrZGJ3bW95Z3lldWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzY2NzIsImV4cCI6MjA4ODE1MjY3Mn0.9Hq8TZ45shdAkOnB87GXx0dDSC7O9TnI-ljdBpjYMo4';
const supa     = createClient(SUPA_URL, SUPA_KEY);

const now   = new Date();
const TODAY = now.toISOString().split('T')[0]; // YYYY-MM-DD
const DATE_LONG = now.toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

// Load priorities from brief data (fallback if Supabase state missing)
function loadBriefPriorities() {
  try {
    const code = fs.readFileSync(BRIEF_DATA, 'utf8');
    const window = {};
    eval(code);
    return (window.briefData?.priorities || []).map(t => ({ text: t, done: false }));
  } catch { return []; }
}

async function sync() {
  // Pull checklist state from Supabase
  const { data, error } = await supa
    .from('brief_state')
    .select('state')
    .eq('date', TODAY)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  // Parse checklist — fall back to all-incomplete priorities if no state yet
  let checklist = loadBriefPriorities();
  if (data?.state?.briefChecklist_v1) {
    try {
      checklist = JSON.parse(data.state.briefChecklist_v1);
    } catch { /* keep fallback */ }
  }

  const completed = checklist.filter(c => c.done);
  const pending   = checklist.filter(c => !c.done);

  // Build the Obsidian note
  const lines = [
    '---',
    `date: ${TODAY}`,
    `tags: [daily-log]`,
    '---',
    '',
    `# ${DATE_LONG}`,
    '',
    `## Completed (${completed.length})`,
  ];

  if (completed.length > 0) {
    completed.forEach(c => lines.push(`- [x] ${c.text}`));
  } else {
    lines.push('- *(nothing checked off yet)*');
  }

  lines.push('');
  lines.push(`## Still Pending (${pending.length})`);
  if (pending.length > 0) {
    pending.forEach(c => lines.push(`- [ ] ${c.text}`));
  } else {
    lines.push('- *(all done)*');
  }

  lines.push('');
  lines.push(`---`);
  lines.push(`*Last synced: ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}*`);

  // Write to Obsidian
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const notePath = path.join(LOG_DIR, `${TODAY}.md`);
  fs.writeFileSync(notePath, lines.join('\n'));

  console.log(`[sync-obsidian] ${TODAY} — ${completed.length} done, ${pending.length} pending → ${notePath}`);
}

sync().catch(err => { console.error(err); process.exit(1); });
