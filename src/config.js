'use strict';

// Central config. Reads from the environment (populated by dotenv in dev, by
// the host in production) and fails fast if anything required is missing or
// obviously wrong -- better to crash on boot than to serve traffic misconfigured.

require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredAny(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== '') return value;
  }
  throw new Error(`Missing required environment variable: ${names.join(' or ')}`);
}

function portValue(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} must be a valid TCP port`);
  }
  return value;
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

// In production every secret must be provided explicitly. In dev we allow a
// throwaway JWT secret so the app runs out of the box, but never in prod.
const JWT_SECRET = isProd
  ? required('JWT_SECRET')
  : process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';

if (isProd && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

// Parse a session-TTL string like '8h', '30m', '7d', or a bare number of
// seconds into milliseconds. The JWT expiry and the cookie maxAge are both
// derived from this one value so they can never drift apart.
function parseTtlMs(raw) {
  const s = String(raw).trim();
  const m = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(s);
  if (!m) throw new Error(`Invalid SESSION_TTL: ${raw}`);
  const n = Number(m[1]);
  const unit = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2] || 's'];
  return n * unit;
}

const SESSION_TTL = process.env.SESSION_TTL || '8h';
const SESSION_TTL_MS = parseTtlMs(SESSION_TTL);
const dbPort =
  process.env.DB_PORT === undefined ? portValue('TIDB_PORT', 3306) : portValue('DB_PORT', 3306);
const usingTiDbVariables = process.env.TIDB_HOST !== undefined && process.env.DB_HOST === undefined;

const config = {
  nodeEnv: NODE_ENV,
  isProd,
  port: portValue('PORT', 3000),

  db: {
    host: isProd
      ? requiredAny('DB_HOST', 'TIDB_HOST')
      : process.env.DB_HOST || process.env.TIDB_HOST || '127.0.0.1',
    port: dbPort,
    user: isProd
      ? requiredAny('DB_USER', 'TIDB_USER')
      : process.env.DB_USER || process.env.TIDB_USER || 'root',
    password: isProd
      ? requiredAny('DB_PASSWORD', 'TIDB_PASSWORD')
      : process.env.DB_PASSWORD || process.env.TIDB_PASSWORD || '',
    database: isProd
      ? requiredAny('DB_NAME', 'TIDB_DATABASE')
      : process.env.DB_NAME || process.env.TIDB_DATABASE || 'student_management',
    ssl:
      process.env.DB_SSL === 'true' || usingTiDbVariables
        ? {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
            ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
          }
        : undefined,
  },

  jwtSecret: JWT_SECRET,
  sessionTtl: SESSION_TTL,
  sessionTtlMs: SESSION_TTL_MS,

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: isProd ? required('ADMIN_PASSWORD') : process.env.ADMIN_PASSWORD || '',
  },
};

module.exports = config;
