'use strict';

// Unit tests for the pieces that don't need a database: validation schemas,
// password hashing/verification, JWT round-trips, and DB-error translation.
// Run with `npm test` (node's built-in test runner) -- no MySQL required.

const test = require('node:test');
const assert = require('node:assert/strict');

const { RESOURCES, loginSchema } = require('../src/resources');
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

test('student schema rejects an impossible date', () => {
  const r = RESOURCES.students.createSchema.safeParse({
    Student_ID: 'S001',
    Name: 'Ada',
    DOB: '2003-13-40',
    Gender: 'Female',
    Email: 'ada@example.com',
    Phone: '123456',
  });
  assert.equal(r.success, false);
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

test('password hashing round-trips and rejects wrong passwords', async () => {
  const hash = await auth.hashPassword('correct horse');
  assert.notEqual(hash, 'correct horse');
  assert.equal(await auth.verifyPassword('correct horse', hash), true);
  assert.equal(await auth.verifyPassword('wrong', hash), false);
});

test('JWT sign/verify carries the role claim', () => {
  const jwt = require('jsonwebtoken');
  const config = require('../src/config');
  const token = auth.signToken({ User_ID: 7, Username: 'admin', Role: 'admin' });
  const decoded = jwt.verify(token, config.jwtSecret);
  assert.equal(decoded.sub, 7);
  assert.equal(decoded.role, 'admin');
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
