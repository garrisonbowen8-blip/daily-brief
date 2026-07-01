#!/usr/bin/env node
// One-time Google OAuth flow. Run with: node scripts/google-auth.js
// Saves tokens to config.json so refresh.js can use them going forward.

const { google } = require('googleapis');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('config.json not found. Run: bash scripts/setup.sh');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function saveTokens(tokens) {
  const cfg = loadConfig();
  cfg.google.tokens = tokens;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

async function main() {
  const cfg = loadConfig();
  const { clientId, clientSecret } = cfg.google;

  if (!clientId || clientId.includes('YOUR_CLIENT_ID')) {
    console.error('Fill in google.clientId and google.clientSecret in config.json first.');
    process.exit(1);
  }

  const REDIRECT_PORT = 3456;
  const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });

  console.log('\nOpening browser for Google authorization...');
  console.log('If the browser does not open, visit this URL:\n');
  console.log(authUrl);
  console.log();

  try {
    const platform = process.platform;
    if (platform === 'darwin') execSync(`open "${authUrl}"`);
    else if (platform === 'linux') execSync(`xdg-open "${authUrl}"`);
    else execSync(`start "" "${authUrl}"`);
  } catch (_) {}

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      const code = url.searchParams.get('code');
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>Authorization complete. You can close this tab.</h2>');
        server.close();
        resolve(code);
      } else {
        res.writeHead(400);
        res.end('Missing code parameter.');
        server.close();
        reject(new Error('No code received'));
      }
    });
    server.listen(REDIRECT_PORT, () => {
      console.log(`Waiting for Google to redirect to localhost:${REDIRECT_PORT}...`);
    });
    server.on('error', reject);
  });

  const { tokens } = await oauth2Client.getToken(code);
  saveTokens(tokens);

  console.log('\nGoogle authorization complete. Tokens saved to config.json.');
  console.log('Run `npm run refresh` to generate your first brief.\n');
}

main().catch(err => { console.error(err.message); process.exit(1); });
