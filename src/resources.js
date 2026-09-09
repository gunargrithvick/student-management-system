'use strict';

// Config-driven resource definitions. Each entry describes a table well enough
// that a single generic set of CRUD handlers (in server.js) can serve it --
// replacing the original 16 hand-written switch branches. Adding a table is now
// a matter of adding one entry here plus its columns.

const { z } = require('zod');

// A strict YYYY-MM-DD date string that also has to parse to a real date.
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Must be a real calendar date');

const phone = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{5,15}$/, 'Phone must be 5-15 digits and may include + - ( ) and spaces');

const studentId = z.string().trim().min(1).max(11);
const positiveInt = z.coerce.number().int().positive();

const RESOURCES = {
  students: {
    table: 'students',
    pk: 'Student_ID',
    pkType: 'string',
    columns: ['Student_ID', 'Name', 'DOB', 'Gender', 'Email', 'Phone'],
    searchable: ['Student_ID', 'Name', 'Email', 'Phone'],
    createSchema: z.object({
      Student_ID: studentId,
      Name: z.string().trim().min(1).max(100),
      DOB: dateString,
      Gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
      Email: z.email().max(100),
      Phone: phone,
    }),
  },

  courses: {
    table: 'courses',
    pk: 'Course_ID',
    pkType: 'int',
    columns: ['Course_ID', 'Course_Name', 'Credits'],
    searchable: ['Course_Name'],
    createSchema: z.object({
      Course_ID: positiveInt,
      Course_Name: z.string().trim().min(1).max(100),
      Credits: z.coerce.number().int().min(1).max(20),
    }),
  },

  attendances: {
    table: 'attendances',
    pk: 'Attendance_ID',
    pkType: 'int',
    columns: ['Attendance_ID', 'Student_ID', 'Course_ID', 'Enrolment_Date', 'Class_Date', 'Status'],
    searchable: ['Student_ID'],
    createSchema: z.object({
      Attendance_ID: positiveInt,
      Student_ID: studentId,
      Course_ID: positiveInt,
      Enrolment_Date: dateString,
      Class_Date: dateString.nullish(),
      Status: z.enum(['Present', 'Absent', 'Late', 'Excused']).default('Present'),
    }),
  },

  marks: {
    table: 'marks',
    pk: 'Marks_ID',
    pkType: 'int',
    columns: ['Marks_ID', 'Student_ID', 'Course_ID', 'Exam_Type', 'Score'],
    searchable: ['Student_ID', 'Exam_Type'],
    createSchema: z.object({
      Marks_ID: positiveInt,
      Student_ID: studentId,
      Course_ID: positiveInt.nullish(),
      Exam_Type: z.string().trim().min(1).max(50),
      Score: z.coerce.number().min(0).max(100),
    }),
  },
};

// The update schema is the create schema without the primary key -- the pk
// comes from the URL, and PUT replaces the remaining fields.
for (const def of Object.values(RESOURCES)) {
  def.updateSchema = def.createSchema.omit({ [def.pk]: true });
  def.updateColumns = def.columns.filter((c) => c !== def.pk);
}

// Login payload.
const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
});

module.exports = { RESOURCES, loginSchema };
