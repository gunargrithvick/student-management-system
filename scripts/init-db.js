'use strict';

// One-shot database bootstrap:
//   1. Runs DBMS.sql to create the database, tables, and constraints.
//   2. Ensures an initial admin user exists (from ADMIN_USERNAME/ADMIN_PASSWORD).
//   3. With --seed, inserts a little demo data so the UI isn't empty.
//
// Run with: npm run init-db   (add -- --seed to include demo data)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const config = require('../src/config');
const { hashPassword } = require('../src/auth');

async function main() {
  const seed = process.argv.includes('--seed');
  const fullSchemaSql = fs.readFileSync(path.join(__dirname, '..', 'DBMS.sql'), 'utf8');

  // The database may already exist when this script runs as the restricted
  // application user in Docker. Strip the database-selection statements so
  // the user only needs privileges on the configured database. If the database
  // does not exist, the fallback connection below creates it first.
  const schemaSql = fullSchemaSql.replace(
    /CREATE DATABASE IF NOT EXISTS\s+`?[^;\s`]+`?[\s\S]*?;\s*USE\s+`?[^;\s`]+`?\s*;/i,
    '',
  );

  const quoteIdentifier = (identifier) => `\`${String(identifier).replace(/`/g, '``')}\``;
  const connectionOptions = {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    ssl: config.db.ssl,
    multipleStatements: true,
  };

  let conn;
  try {
    // This is the normal path for Docker and managed MySQL databases where the
    // database has already been provisioned for the application user.
    conn = await mysql.createConnection({ ...connectionOptions, database: config.db.database });
  } catch (err) {
    if (err.code !== 'ER_BAD_DB_ERROR') throw err;

    // Local development may use a database administrator account and start
    // with no database created yet.
    conn = await mysql.createConnection(connectionOptions);
    await conn.query(`CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(config.db.database)}`);
    await conn.changeUser({ database: config.db.database });
  }

  console.log('Applying schema from DBMS.sql ...');
  await conn.query(schemaSql);
  console.log('Schema applied.');

  // --- Admin user ---
  let adminPassword = config.admin.password;
  let generated = false;
  if (!adminPassword) {
    if (config.isProd) throw new Error('ADMIN_PASSWORD must be set in production.');
    adminPassword = crypto.randomBytes(9).toString('base64url');
    generated = true;
  }

  const [existing] = await conn.query('SELECT User_ID FROM users WHERE Username = ?', [
    config.admin.username,
  ]);
  if (existing.length) {
    console.log(`Admin user "${config.admin.username}" already exists -- left unchanged.`);
  } else {
    const hash = await hashPassword(adminPassword);
    await conn.query('INSERT INTO users (Username, Password_Hash, Role) VALUES (?, ?, ?)', [
      config.admin.username,
      hash,
      'admin',
    ]);
    console.log(`Created admin user "${config.admin.username}".`);
    if (generated) {
      console.log('\n============================================================');
      console.log(`  Generated admin password: ${adminPassword}`);
      console.log('  Save it now -- it is not stored anywhere else.');
      console.log('============================================================\n');
    }
  }

  // --- Optional demo data ---
  if (seed) {
    console.log('Seeding demo data ...');
    await conn.query(
      `INSERT IGNORE INTO students (Student_ID, Name, DOB, Gender, Email, Phone) VALUES
        ('S001','Ada Lovelace','2003-12-10','Female','ada@example.com','+1 202 555 0100'),
        ('S002','Alan Turing','2002-06-23','Male','alan@example.com','+1 202 555 0111')`,
    );
    await conn.query(
      `INSERT IGNORE INTO courses (Course_ID, Course_Name, Credits) VALUES
        (101,'Databases',4),
        (102,'Algorithms',3)`,
    );
    await conn.query(
      `INSERT IGNORE INTO attendances (Attendance_ID, Student_ID, Course_ID, Enrolment_Date, Class_Date, Status) VALUES
        (1,'S001',101,'2026-01-15','2026-02-01','Present'),
        (2,'S002',102,'2026-01-16','2026-02-01','Late')`,
    );
    await conn.query(
      `INSERT IGNORE INTO marks (Marks_ID, Student_ID, Course_ID, Exam_Type, Score) VALUES
        (1,'S001',101,'Midterm',92.50),
        (2,'S002',102,'Midterm',88.00)`,
    );
    console.log('Demo data seeded.');
  }

  await conn.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error('init-db failed:', err.message);
  process.exit(1);
});
