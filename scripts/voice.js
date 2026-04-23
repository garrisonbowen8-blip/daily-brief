#!/usr/bin/env node
// Cross-platform voice runner — Mac, Windows, and Linux.
// Reads config.json, generates the briefing, calls ElevenLabs, plays the MP3.
// Usage: node scripts/voice.js   (or: npm run voice)

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawnSync, execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const DATA_PATH = path.join(ROOT, 'daily-brief-data.js');
const VOICE_JS = path.join(ROOT, 'daily-brief-voice.js');
const HISTORY_FILE = path.join(os.homedir(), '.daily-brief-history.json');
const AUDIO_OUT = path.join(os.tmpdir(), `daily-brief-${new Date().toISOString().slice(0, 10)}.mp3`);

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('config.json not found. Run setup first: bash scripts/setup.sh');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function getBriefingText() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error('daily-brief-data.js not found. Run: npm run refresh');
    process.exit(1);
  }
  const result = spawnSync(process.execPath, [VOICE_JS], {
    env: { ...process.env, DATA_FILE: DATA_PATH, HISTORY_FILE },
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  return (result.stdout || '').trim() || 'Good morning. Briefing data unavailable.';
}

function fetchAudio(apiKey, voiceId, model, voiceSettings, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ text, model_id: model, voice_settings: voiceSettings });
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`ElevenLabs API returned ${res.statusCode}. Check your API key and Voice ID.`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function playAudio(filePath) {
  const platform = os.platform();

  if (platform === 'darwin') {
    // Mac — built-in audio player
    execSync(`afplay "${filePath}"`);

  } else if (platform === 'win32') {
    // Windows — use PowerShell's built-in WPF media player (no extra install needed)
    // Polls until the audio finishes rather than using a fixed sleep
    const ps = [
      'Add-Type -AssemblyName PresentationCore',
      `$m = New-Object System.Windows.Media.MediaPlayer`,
      `$m.Open([uri]'file:///${filePath.replace(/\\/g, '/')}')`,
      '$m.Play()',
      'while (-not $m.NaturalDuration.HasTimeSpan) { Start-Sleep -Milliseconds 200 }',
      '$wait = [int]$m.NaturalDuration.TimeSpan.TotalSeconds + 2',
      'Start-Sleep -Seconds $wait',
      '$m.Close()',
    ].join('; ');
    execSync(`powershell -Command "${ps}"`, { timeout: 300000 });

  } else {
    // Linux — try common audio players in order
    const players = [
      `mpg123 "${filePath}"`,
      `mpv --no-video "${filePath}"`,
      `ffplay -nodisp -autoexit "${filePath}"`,
      `mplayer "${filePath}"`,
    ];
    for (const cmd of players) {
      try { execSync(cmd, { stdio: 'inherit' }); return; } catch (_) {}
    }
    console.log('No audio player found. Install one: sudo apt install mpg123');
  }
}

async function main() {
  const cfg = loadConfig();

  if (!cfg.voice?.enabled) {
    console.log('Voice is disabled. Set voice.enabled to true in config.json.');
    return;
  }

  const el = cfg.elevenlabs || {};
  if (!el.apiKey || !el.voiceId) {
    console.error('ElevenLabs credentials missing in config.json (elevenlabs.apiKey and elevenlabs.voiceId).');
    process.exit(1);
  }

  console.log('Building briefing text...');
  const text = getBriefingText();

  console.log('Calling ElevenLabs...');
  const audio = await fetchAudio(el.apiKey, el.voiceId, el.model || 'eleven_turbo_v2_5', {
    stability: el.stability ?? 0.45,
    similarity_boost: 0.8,
    style: el.style ?? 0.35,
    use_speaker_boost: true,
  }, text);

  fs.writeFileSync(AUDIO_OUT, audio);
  console.log('Playing briefing...');
  playAudio(AUDIO_OUT);
  console.log('Done.');
}

main().catch(err => { console.error(err.message); process.exit(1); });
