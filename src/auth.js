'use strict';

// Authentication: password hashing, JWT issue/verify, and Express middleware
// that gates routes by login and by role.
//
// Tokens are carried in an httpOnly, SameSite=Strict cookie. httpOnly means
// page JavaScript cannot read the token, so an XSS bug can't exfiltrate it;
// SameSite=Strict means the browser won't attach it to cross-site requests,
// which is our CSRF defense. A Bearer header is also accepted for API clients.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { HttpError } = require('./errors');

const COOKIE_NAME = 'token';

// Role hierarchy: a higher rank implies every permission of the ranks below.
const ROLE_RANK = { viewer: 1, staff: 2, admin: 3 };

async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(user) {
  return jwt.sign(
    { sub: user.User_ID, username: user.Username, role: user.Role },
    config.jwtSecret,
    {
      expiresIn: config.sessionTtl,
    },
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProd, // HTTPS-only in production
    maxAge: 8 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function readToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  return null;
}

// Require a valid session. Attaches the decoded user to req.user.
function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return next(new HttpError(401, 'Authentication required.'));
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    next(new HttpError(401, 'Session expired or invalid. Please log in again.'));
  }
}

// Require at least the given role rank. Use after requireAuth.
function requireRole(minRole) {
  const min = ROLE_RANK[minRole];
  return (req, res, next) => {
    const rank = ROLE_RANK[req.user?.role] || 0;
    if (rank < min) return next(new HttpError(403, 'You do not have permission for this action.'));
    next();
  };
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireRole,
};
