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

const config = {
  nodeEnv: NODE_ENV,
  isProd,
  port: Number(process.env.PORT) || 3000,

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'student_management',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  },

  jwtSecret: JWT_SECRET,
  sessionTtl: process.env.SESSION_TTL || '8h',

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || '',
  },
};

module.exports = config;
