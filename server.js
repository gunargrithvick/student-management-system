'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./src/config');
const { query, pool } = require('./src/db');
const { RESOURCES, loginSchema, createUserSchema } = require('./src/resources');
const { HttpError, asyncHandler, translateDbError } = require('./src/errors');
const auth = require('./src/auth');

const app = express();

// Behind a reverse proxy (Render/Railway/Fly/Heroku) so secure cookies and
// per-IP rate limiting see the real client address.
if (config.isProd) app.set('trust proxy', 1);

app.use(helmet());
// Skip request logging under test so the test runner's output stays readable.
if (config.nodeEnv !== 'test') app.use(morgan(config.isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Backtick-quote an identifier. Identifiers only ever come from our own
// RESOURCES config, never from request input, so this is defense in depth.
const q = (id) => `\`${String(id).replace(/`/g, '')}\``;

// Validate `data` against a zod schema, or throw a 400 listing the problems.
function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ');
    throw new HttpError(400, msg);
  }
  return result.data;
}

// Coerce and validate a primary-key value taken from the URL.
function parseId(def, raw) {
  if (def.pkType === 'int') {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Invalid id.');
    return n;
  }
  const s = String(raw).trim();
  if (!s || s.length > 11) throw new HttpError(400, 'Invalid id.');
  return s;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const isTest = config.nodeEnv === 'test';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again shortly.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please wait 15 minutes and try again.' },
});

// Skip rate limiting under test so repeated requests don't trip the limiter
// and make the suite flaky.
if (!isTest) app.use('/api', apiLimiter);

// ---------------------------------------------------------------------------
// Health check (no auth) -- used by hosts for readiness probes.
// ---------------------------------------------------------------------------
app.get('/api/health', async (req, res, next) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
app.post(
  '/api/auth/login',
  isTest ? (req, res, next) => next() : loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = validate(loginSchema, req.body);
    const rows = await query('SELECT * FROM users WHERE Username = ?', [username]);
    const user = rows[0];
    // Compare even when the user is absent to avoid leaking which usernames
    // exist via response timing.
    const ok = await auth.verifyPassword(password, user ? user.Password_Hash : auth.DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'Invalid username or password.');

    const token = auth.signToken(user);
    auth.setAuthCookie(res, token);
    res.json({ user: { username: user.Username, role: user.Role } });
  }),
);

app.post('/api/auth/logout', (req, res) => {
  auth.clearAuthCookie(res);
  res.json({ message: 'Logged out.' });
});

app.get('/api/auth/me', auth.requireAuth, (req, res) => {
  res.json({ user: { username: req.user.username, role: req.user.role } });
});

// --- User management (admin only) ---
app.get(
  '/api/auth/users',
  auth.requireAuth,
  auth.requireRole('admin'),
  asyncHandler(async (req, res) => {
    const rows = await query(
      'SELECT User_ID, Username, Role, Created_At FROM users ORDER BY Username',
    );
    res.json({ data: rows });
  }),
);

app.post(
  '/api/auth/users',
  auth.requireAuth,
  auth.requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { username, password, role } = validate(createUserSchema, req.body);
    const hash = await auth.hashPassword(password);
    await query('INSERT INTO users (Username, Password_Hash, Role) VALUES (?, ?, ?)', [
      username,
      hash,
      role,
    ]);
    res.status(201).json({ message: 'User created.' });
  }),
);

app.delete(
  '/api/auth/users/:id',
  auth.requireAuth,
  auth.requireRole('admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid user id.');
    if (id === req.user.sub) throw new HttpError(400, 'You cannot delete your own account.');
    const result = await query('DELETE FROM users WHERE User_ID = ?', [id]);
    if (result.affectedRows === 0) throw new HttpError(404, 'User not found.');
    res.json({ message: 'User deleted.' });
  }),
);

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------
app.get(
  '/api/stats',
  auth.requireAuth,
  asyncHandler(async (req, res) => {
    const [students, courses, attendances, marks, avg] = await Promise.all([
      query('SELECT COUNT(*) AS n FROM students'),
      query('SELECT COUNT(*) AS n FROM courses'),
      query('SELECT COUNT(*) AS n FROM attendances'),
      query('SELECT COUNT(*) AS n FROM marks'),
      query('SELECT ROUND(AVG(Score), 2) AS avg FROM marks'),
    ]);
    res.json({
      students: students[0].n,
      courses: courses[0].n,
      attendances: attendances[0].n,
      marks: marks[0].n,
      averageScore: avg[0].avg,
    });
  }),
);

// ---------------------------------------------------------------------------
// Generic CRUD for every resource in RESOURCES.
// Registered AFTER the specific /api routes above so ':resource' can't shadow
// them. A middleware resolves and attaches the resource definition.
// ---------------------------------------------------------------------------
function loadResource(req, res, next) {
  const def = RESOURCES[req.params.resource];
  if (!def) return next(new HttpError(404, 'Unknown resource.'));
  req.resourceDef = def;
  next();
}

// List with pagination + optional search.
app.get(
  '/api/:resource',
  auth.requireAuth,
  loadResource,
  asyncHandler(async (req, res) => {
    const def = req.resourceDef;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let where = '';
    const params = [];
    const search = (req.query.search || '').toString().trim();
    if (search && def.searchable.length) {
      where = 'WHERE ' + def.searchable.map((c) => `${q(c)} LIKE ?`).join(' OR ');
      for (const _ of def.searchable) params.push(`%${search}%`);
    }

    const countRows = await query(`SELECT COUNT(*) AS n FROM ${q(def.table)} ${where}`, params);
    const total = countRows[0].n;

    // limit/offset are validated integers, not user strings, so inlining them
    // avoids MySQL's placeholder quirks for LIMIT.
    const rows = await query(
      `SELECT * FROM ${q(def.table)} ${where} ORDER BY ${q(def.pk)} LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    res.json({
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    });
  }),
);

// Read one.
app.get(
  '/api/:resource/:id',
  auth.requireAuth,
  loadResource,
  asyncHandler(async (req, res) => {
    const def = req.resourceDef;
    const id = parseId(def, req.params.id);
    const rows = await query(`SELECT * FROM ${q(def.table)} WHERE ${q(def.pk)} = ?`, [id]);
    if (!rows.length) throw new HttpError(404, 'Record not found.');
    res.json({ data: rows[0] });
  }),
);

// Create.
app.post(
  '/api/:resource',
  auth.requireAuth,
  auth.requireRole('staff'),
  loadResource,
  asyncHandler(async (req, res) => {
    const def = req.resourceDef;
    const body = validate(def.createSchema, req.body);
    const cols = def.columns;
    const sql = `INSERT INTO ${q(def.table)} (${cols.map(q).join(', ')}) VALUES (${cols
      .map(() => '?')
      .join(', ')})`;
    await query(
      sql,
      cols.map((c) => (body[c] === undefined ? null : body[c])),
    );
    res.status(201).json({ message: `${def.pk.split('_')[0]} created.` });
  }),
);

// Update (full replace of non-key fields).
app.put(
  '/api/:resource/:id',
  auth.requireAuth,
  auth.requireRole('staff'),
  loadResource,
  asyncHandler(async (req, res) => {
    const def = req.resourceDef;
    const id = parseId(def, req.params.id);
    const body = validate(def.updateSchema, req.body);
    const setClause = def.updateColumns.map((c) => `${q(c)} = ?`).join(', ');
    const values = def.updateColumns.map((c) => (body[c] === undefined ? null : body[c]));
    values.push(id);
    const result = await query(
      `UPDATE ${q(def.table)} SET ${setClause} WHERE ${q(def.pk)} = ?`,
      values,
    );
    if (result.affectedRows === 0) throw new HttpError(404, 'Record not found.');
    res.json({ message: 'Record updated.' });
  }),
);

// Delete.
app.delete(
  '/api/:resource/:id',
  auth.requireAuth,
  auth.requireRole('staff'),
  loadResource,
  asyncHandler(async (req, res) => {
    const def = req.resourceDef;
    const id = parseId(def, req.params.id);
    const result = await query(`DELETE FROM ${q(def.table)} WHERE ${q(def.pk)} = ?`, [id]);
    if (result.affectedRows === 0) throw new HttpError(404, 'Record not found.');
    res.json({ message: 'Record deleted.' });
  }),
);

// Unknown API route -> JSON 404 (before static, so /api/* never serves HTML).
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

// ---------------------------------------------------------------------------
// Static frontend
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Central error handler
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  const e = translateDbError(err);
  if (e instanceof HttpError) return res.status(e.status).json({ message: e.message });

  // Body-parser errors (malformed JSON, payload too large) carry their own
  // status -- they're client mistakes (4xx), not server faults, so don't log
  // them as 500s.
  if (e.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large.' });
  }
  if (e.status === 400 || e instanceof SyntaxError) {
    return res.status(400).json({ message: 'Malformed request body.' });
  }

  console.error(err);
  res.status(500).json({ message: 'Internal server error.' });
});

// Only listen when run directly; tests import `app` without binding a port.
if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port} (${config.nodeEnv})`);
  });

  // Graceful shutdown: hosts (and `docker stop`) send SIGTERM on redeploy.
  // Stop accepting connections, then close the DB pool so in-flight queries
  // finish and no connection is left dangling.
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down ...`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    // Don't hang forever if a connection is stuck.
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
