// Tiny stand-in for Brevo's transactional email API, for the self-contained e2e stack only.
// The Server sends real requests to it (`BREVO_API_BASE_URL=http://localhost:4010`), so the OTP
// flow runs end to end with no product bypass. Specs read the latest code per address from
// `GET /__test/latest-code?email=`. Binds to localhost; never run it anywhere else.
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_BREVO_PORT ?? 4010);
const latest = new Map(); // lowercased address -> { subject, textContent }
let sent = 0;

function reply(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

    if (req.method === 'GET' && url.pathname === '/health') return reply(res, 200, { ok: true });

    if (req.method === 'GET' && url.pathname === '/__test/latest-code') {
        const message = latest.get((url.searchParams.get('email') ?? '').trim().toLowerCase());
        const code = message?.textContent.match(/^\s*(\d{6})\s*$/m)?.[ 1 ];
        return code ? reply(res, 200, { code, subject: message.subject }) : reply(res, 404, { error: 'no code' });
    }

    if (req.method === 'POST' && url.pathname === '/smtp/email') {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            try {
                const payload = JSON.parse(raw);
                for (const { email } of payload.to ?? []) {
                    latest.set(String(email).toLowerCase(), { subject: payload.subject, textContent: payload.textContent ?? '' });
                }
                sent += 1;
                console.log(`mock-brevo: accepted email #${sent}`); // never log addresses or codes
                reply(res, 201, { messageId: `<mock-${sent}@mock-brevo.local>` });
            } catch {
                reply(res, 400, { code: 'bad_request', message: 'invalid JSON' });
            }
        });
        return;
    }

    reply(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => console.log(`mock-brevo listening on http://127.0.0.1:${PORT}`));
