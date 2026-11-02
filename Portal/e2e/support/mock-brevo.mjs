import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_BREVO_PORT ?? 4010);
const inbox = new Map();
let sent = 0;

function reply(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
}

const messagesFor = (url) => inbox.get((url.searchParams.get('email') ?? '').trim().toLowerCase()) ?? [];

const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

    if (req.method === 'GET' && url.pathname === '/health') return reply(res, 200, { ok: true });

    if (req.method === 'GET' && url.pathname === '/__test/latest-code') {
        for (const message of [ ...messagesFor(url) ].reverse()) {
            const code = message.textContent.match(/^\s*(\d{6})\s*$/m)?.[ 1 ];
            if (code) return reply(res, 200, { code, subject: message.subject });
        }
        return reply(res, 404, { error: 'no code' });
    }

    if (req.method === 'GET' && url.pathname === '/__test/messages') {
        return reply(res, 200, { messages: messagesFor(url) });
    }

    if (req.method === 'POST' && url.pathname === '/smtp/email') {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            try {
                const payload = JSON.parse(raw);
                for (const { email } of payload.to ?? []) {
                    const key = String(email).toLowerCase();
                    inbox.set(key, [ ...(inbox.get(key) ?? []), { subject: payload.subject, textContent: payload.textContent ?? '' } ]);
                }
                sent += 1;
                console.log(`mock-brevo: accepted email #${sent}`);
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
