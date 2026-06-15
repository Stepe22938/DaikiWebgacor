const path = require('node:path');
const fs = require('node:fs');

const rootEnvPath = path.resolve(__dirname, '../.env');
let env = {};
if (fs.existsSync(rootEnvPath)) {
  const content = fs.readFileSync(rootEnvPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  }
}

const clientId = env.SPOTIFY_CLIENT_ID;
const clientSecret = env.SPOTIFY_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Error: Credentials not found in .env');
  process.exit(1);
}

async function test() {
  try {
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) {
      console.error('Failed to get token:', res.status, await res.text());
      return;
    }
    const data = await res.json();
    const token = data.access_token;
    console.log('Token successfully fetched.');

    // 1. Test standard search query "Global Charts"
    console.log('Testing search query "Global Charts"...');
    const searchRes = await fetch("https://api.spotify.com/v1/search?q=Global%20Charts&type=track&limit=10", {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Search "Global Charts" status:', searchRes.status);
    const searchBody = await searchRes.json();
    console.log('Search "Global Charts" tracks count:', searchBody.tracks?.items?.length);
    if (!searchRes.ok) {
      console.log('Search error detail:', searchBody);
    }

    // 2. Test query "tag:new"
    console.log('Testing search query "tag:new"...');
    const newRes = await fetch("https://api.spotify.com/v1/search?q=tag:new&type=track&limit=10", {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Search "tag:new" status:', newRes.status);
    const newBody = await newRes.json();
    console.log('Search "tag:new" tracks count:', newBody.tracks?.items?.length);
    if (!newRes.ok) {
      console.log('Search "tag:new" error detail:', newBody);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
