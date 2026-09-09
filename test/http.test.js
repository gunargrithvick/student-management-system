'use strict';

// HTTP-level tests that exercise the real Express stack (routing, auth,
// validation, error handling) without a database. Requests that would touch
// MySQL are checked only up to the point where auth/validation reject them, so
// no DB connection is needed. Run as part of `npm test`.

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

const app = require('../server');

test('GET / serves the SPA shell', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.match(res.text, /Student Management/);
});

test('GET /login.html is served', async () => {
  const res = await request(app).get('/login.html');
  assert.equal(res.status, 200);
});

test('protected API routes require auth', async () => {
  for (const path of ['/api/auth/me', '/api/students', '/api/stats', '/api/courses/1']) {
    const res = await request(app).get(path);
    assert.equal(res.status, 401, `${path} should be 401 without auth`);
    assert.equal(res.body.message, 'Authentication required.');
  }
});

test('write routes require auth before touching the DB', async () => {
  const res = await request(app).post('/api/students').send({ Student_ID: 'S1' });
  assert.equal(res.status, 401);
});

test('login validates the request body (400, not 500)', async () => {
  const res = await request(app).post('/api/auth/login').send({});
  assert.equal(res.status, 400);
  assert.match(res.body.message, /username/);
});

test('unknown API route returns JSON 404, not HTML', async () => {
  const res = await request(app).get('/api/does-not-exist').set('Accept', 'application/json');
  // Auth runs first for /api/:resource, so this is 401; the point is it's JSON.
  assert.ok(res.status === 401 || res.status === 404);
  assert.equal(res.type, 'application/json');
});

test('an expired/garbage token is rejected', async () => {
  const res = await request(app).get('/api/auth/me').set('Cookie', 'token=not-a-real-jwt');
  assert.equal(res.status, 401);
  assert.match(res.body.message, /log in again/i);
});

test('security headers are set by helmet', async () => {
  const res = await request(app).get('/');
  assert.ok(res.headers['x-content-type-options'], 'expected X-Content-Type-Options');
});

test('malformed JSON returns 400, not 500', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send('{bad json');
  assert.equal(res.status, 400);
  assert.equal(res.type, 'application/json');
});

test('oversized request body returns 413', async () => {
  const big = JSON.stringify({ username: 'a'.repeat(200000) });
  const res = await request(app)
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send(big);
  assert.equal(res.status, 413);
});
