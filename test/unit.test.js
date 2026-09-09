'use strict';

// Unit tests for the pieces that don't need a database: validation schemas,
// password hashing/verification, JWT round-trips, and DB-error translation.
// Run with `npm test` (node's built-in test runner) -- no MySQL required.

const test = require('node:test');
const assert = require('node:assert/strict');

const { RESOURCES, loginSchema, createUserSchema } = require('../src/resources');
const auth = require('../src/auth');
const { translateDbError, HttpError } = require('../src/errors');

test('student schema accepts a valid record', () => {
  const r = RESOURCES.students.createSchema.safeParse({
    Student_ID: 'S001',
    Name: 'Ada Lovelace',
    DOB: '2003-12-10',
    Gender: 'Female',
    Email: 'ada@example.com',
    Phone: '+1 202 555 0100',
  });
  assert.equal(r.success, true);
});

test('student schema rejects a bad email and bad gender', () => {
  const r = RESOURCES.students.createSchema.safeParse({
    Student_ID: 'S001',
    Name: 'Ada',
    DOB: '2003-12-10',
    Gender: 'Robot',
    Email: 'not-an-email',
    Phone: '123456',
  });
  assert.equal(r.success, false);
});

test('student schema rejects impossible calendar dates', () => {
  const base = {
    Student_ID: 'S001',
    Name: 'Ada',
    Gender: 'Female',
    Email: 'ada@example.com',
    Phone: '123456',
  };
  const parse = (DOB) => RESOURCES.students.createSchema.safeParse({ ...base, DOB }).success;
  // Feb 30 / Apr 31 pass a naive regex+Date.parse (which rolls them over into
  // the next month) but must be rejected as real calendar dates.
  assert.equal(parse('2003-02-30'), false);
  assert.equal(parse('2003-04-31'), false);
  assert.equal(parse('2003-13-40'), false);
  assert.equal(parse('2003-00-10'), false);
  assert.equal(parse('2004-02-29'), true); // leap year
  assert.equal(parse('2003-02-29'), false); // non-leap year
});

test('course credits are bounded to 1..20', () => {
  assert.equal(
    RESOURCES.courses.createSchema.safeParse({ Course_ID: 1, Course_Name: 'DB', Credits: 4 })
      .success,
    true,
  );
  assert.equal(
    RESOURCES.courses.createSchema.safeParse({ Course_ID: 1, Course_Name: 'DB', Credits: 99 })
      .success,
    false,
  );
});

test('marks score is bounded to 0..100 and coerces numeric strings', () => {
  const ok = RESOURCES.marks.createSchema.safeParse({
    Marks_ID: 1,
    Student_ID: 'S001',
    Exam_Type: 'Midterm',
    Score: '88.5',
  });
  assert.equal(ok.success, true);
  assert.equal(ok.data.Score, 88.5);
  assert.equal(
    RESOURCES.marks.createSchema.safeParse({
      Marks_ID: 1,
      Student_ID: 'S001',
      Exam_Type: 'Midterm',
      Score: 200,
    }).success,
    false,
  );
});

test('update schema omits the primary key', () => {
  assert.ok(!('Student_ID' in RESOURCES.students.updateSchema.shape));
  assert.deepEqual(RESOURCES.students.updateColumns.includes('Student_ID'), false);
});

test('login schema requires username and password', () => {
  assert.equal(loginSchema.safeParse({ username: 'a', password: 'b' }).success, true);
  assert.equal(loginSchema.safeParse({ username: '', password: 'b' }).success, false);
});

test('createUserSchema enforces password length and defaults role to viewer', () => {
  const short = createUserSchema.safeParse({ username: 'bob', password: 'short' });
  assert.equal(short.success, false);
  const ok = createUserSchema.safeParse({ username: 'bob', password: 'longenough' });
  assert.equal(ok.success, true);
  assert.equal(ok.data.role, 'viewer');
  assert.equal(
    createUserSchema.safeParse({ username: 'b', password: 'longenough', role: 'root' }).success,
    false,
  );
});

test('password hashing round-trips and rejects wrong passwords', async () => {
  const hash = await auth.hashPassword('correct horse');
  assert.notEqual(hash, 'correct horse');
  assert.equal(await auth.verifyPassword('correct horse', hash), true);
  assert.equal(await auth.verifyPassword('wrong', hash), false);
});

test('DUMMY_HASH is a valid bcrypt hash that never matches (no timing leak)', async () => {
  // A malformed hash makes bcrypt.compare short-circuit in ~0ms, which would
  // let an attacker distinguish unknown usernames by response time.
  assert.match(auth.DUMMY_HASH, /^\$2[aby]\$\d{2}\$.{53}$/);
  const start = process.hrtime.bigint();
  const result = await auth.verifyPassword('any password at all', auth.DUMMY_HASH);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.equal(result, false);
  assert.ok(ms > 50, `dummy-hash compare took only ${ms.toFixed(1)}ms; expected real bcrypt work`);
});

test('JWT sign/verify carries the role claim', () => {
  const jwt = require('jsonwebtoken');
  const config = require('../src/config');
  const token = auth.signToken({ User_ID: 7, Username: 'admin', Role: 'admin' });
  const decoded = jwt.verify(token, config.jwtSecret);
  assert.equal(decoded.sub, 7);
  assert.equal(decoded.role, 'admin');
});

test('config derives sessionTtlMs from SESSION_TTL (cookie/JWT stay in sync)', () => {
  const config = require('../src/config');
  // Default is 8h; the cookie maxAge and JWT expiry both read this one value.
  assert.equal(config.sessionTtl, '8h');
  assert.equal(config.sessionTtlMs, 8 * 60 * 60 * 1000);
});

test('DB error codes map to friendly HTTP errors', () => {
  const dup = translateDbError({ code: 'ER_DUP_ENTRY' });
  assert.ok(dup instanceof HttpError);
  assert.equal(dup.status, 409);

  const fk = translateDbError({ code: 'ER_ROW_IS_REFERENCED_2' });
  assert.equal(fk.status, 409);

  const unknown = translateDbError(new Error('boom'));
  assert.ok(!(unknown instanceof HttpError)); // passed through for a 500
});
