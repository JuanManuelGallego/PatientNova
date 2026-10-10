import { describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../../../src/app.js';

// Exercises the real Express app (CORS, body parsers, error handler, rate limit) that the
// route-level tests using invokeRoute skip. The rate-limit test must stay last: the global
// limiter is process-wide and keyed by IP.
describe('app layer', () => {
  it('echoes a safe X-Request-Id and mints one otherwise', async () => {
    const supplied = await request(app).get('/health').set('X-Request-Id', 'client-req-12345');
    expect(supplied.headers['x-request-id']).toBe('client-req-12345');

    const unsafe = await request(app).get('/health').set('X-Request-Id', 'bad id with spaces!');
    expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sends security headers including nosniff', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns a JSON 404 with the request id for unknown routes', async () => {
    const res = await request(app).get('/v1/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ success: false, error: 'Route not found' });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('returns JSON 400 for malformed JSON bodies without a stack trace', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ success: false, error: 'Invalid JSON body' });
    expect(res.text).not.toMatch(/SyntaxError|at .*\.js/);
  });

  it('returns JSON 413 for oversized bodies', async () => {
    const big = JSON.stringify({ blob: 'x'.repeat(16 * 1024 * 1024) });
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(big);
    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({ success: false, error: 'Request body too large' });
  });

  it('applies the small default body limit to ordinary routes', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200 * 1024) }));
    expect(res.status).toBe(413);
  });

  it('still parses large bodies on file-upload routes (reaches auth instead of 413)', async () => {
    const res = await request(app)
      .post('/v1/medical-records')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: 'x'.repeat(1024 * 1024) }));
    expect(res.status).toBe(401);
  });

  it('no longer exposes the unauthenticated message-status endpoint', async () => {
    const sid = `SM${'a'.repeat(32)}`;
    expect((await request(app).get(`/messages/${sid}`)).status).toBe(404);
    expect((await request(app).get(`/v1/messages/${sid}`)).status).toBe(404);
  });

  it('rejects disallowed origins with a JSON 403 and no CORS headers', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, error: 'Origin not allowed' });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows configured origins with credentials', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:3000');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rate limits per IP with the JSON envelope (keep last)', async () => {
    let limited: request.Response | undefined;
    for (let i = 0; i < 40 && !limited; i++) {
      const res = await request(app).get('/health');
      if (res.status === 429) limited = res;
    }
    expect(limited).toBeDefined();
    expect(limited!.body).toMatchObject({ success: false });
  });
});
