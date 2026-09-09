'use strict';

// A single shared connection pool for the whole process. The original code
// opened a fresh TCP connection and auth handshake for every query (two per
// insert) and closed it again -- correct but very slow. A pool keeps a small
// set of connections warm and hands them out per query.

const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: config.db.ssl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: false,
  // Return DATE columns as 'YYYY-MM-DD' strings rather than JS Date objects, so
  // the client never has to reverse a timezone shift applied on the way out.
  dateStrings: true,
  // Return DECIMAL columns (e.g. Score) as JS numbers instead of strings, so
  // the API serializes 92.5 rather than "92.50".
  decimalNumbers: true,
});

/**
 * Run a parameterized query and return the rows.
 * @param {string} sql
 * @param {Array} [params]
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = { pool, query };
