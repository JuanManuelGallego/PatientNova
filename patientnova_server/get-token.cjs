const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open'); 
require('dotenv').config();

const credentials = {
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uri: 'http://localhost:3000'
};

const oauth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uri
);

const SCOPES = [ 'https://www.googleapis.com/auth/meetings.space.created' ];

async function main() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('\n1. Open this URL in your browser:\n', authUrl);

  const server = http.createServer(async (req, res) => {
    console.log(`Received request: ${req.url}`);

    try {
      if (req.url.includes('code=')) {
        const fullUrl = `http://localhost:3000${req.url}`;
        const qs = new url.URL(fullUrl).searchParams;
        const code = qs.get('code');

        console.log('Code received! Exchanging for tokens...');

        const { tokens } = await oauth2Client.getToken(code);

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Success! Check your terminal for the Refresh Token.');

        console.log('\n--- YOUR REFRESH TOKEN ---');
        console.log(tokens.refresh_token);
        console.log('---------------------------\n');

        process.exit(0); 
      } else {
        res.end('Waiting for code...');
      }
    } catch (e) {
      console.error('Error exchanging code:', e.message);
      res.end('Error occurred. Check terminal.');
    }
  }).listen(3000);
}

main();