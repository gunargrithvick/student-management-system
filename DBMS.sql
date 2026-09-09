-- Student Management System schema
-- Lowercase database name throughout: MySQL on Linux is case-sensitive for
-- database names (lower_case_table_names=0), so STUDENT_MANAGEMENT and
-- student_management are different databases there even though Windows treats
-- them as one. Keeping it lowercase makes local and deployed behaviour match.

CREATE DATABASE IF NOT EXISTS student_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE student_management;

-- --------------------------------------------------------------------------
-- users: application logins. Passwords are bcrypt hashes, never plaintext.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  User_ID       INT AUTO_INCREMENT PRIMARY KEY,
  Username      VARCHAR(50)  NOT NULL UNIQUE,
  Password_Hash VARCHAR(255) NOT NULL,
  Role          ENUM('admin', 'staff', 'viewer') NOT NULL DEFAULT 'viewer',
  Created_At    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

-- --------------------------------------------------------------------------
-- students
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  Student_ID VARCHAR(11)  NOT NULL PRIMARY KEY,
  Name       VARCHAR(100) NOT NULL,
  DOB        DATE         NOT NULL,
  Gender     ENUM('Male', 'Female', 'Other', 'Prefer not to say') NOT NULL,
  Email      VARCHAR(100) NOT NULL UNIQUE,
  Phone      VARCHAR(15)  NOT NULL,
  Created_At TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Updated_At TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Rules out typos like a birth year of 0207 without hardcoding an age limit.
  CONSTRAINT chk_students_dob CHECK (DOB > '1900-01-01'),
  INDEX idx_students_name (Name)
) ENGINE = InnoDB;

-- --------------------------------------------------------------------------
-- courses
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
  Course_ID   INT          NOT NULL PRIMARY KEY,
  Course_Name VARCHAR(100) NOT NULL,
  Credits     INT          NOT NULL,
  Created_At  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Updated_At  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_courses_credits CHECK (Credits BETWEEN 1 AND 20)
) ENGINE = InnoDB;

-- --------------------------------------------------------------------------
-- attendances: one row per student, per course, per class date.
--
-- The original table held only an Enrolment_Date, which made it an enrolments
-- table rather than attendance. Class_Date + Status record actual attendance;
-- Enrolment_Date is kept so existing rows and the UI stay meaningful.
--
-- FKs referenced tables named `Student` and `Course` before, but the tables
-- created are `students` and `courses` -- InnoDB rejected that with error 1824,
-- so this file could not run to completion.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendances (
  Attendance_ID  INT         NOT NULL PRIMARY KEY,
  Student_ID     VARCHAR(11) NOT NULL,
  Course_ID      INT         NOT NULL,
  Enrolment_Date DATE        NOT NULL,
  Class_Date     DATE        NULL,
  Status         ENUM('Present', 'Absent', 'Late', 'Excused') NOT NULL DEFAULT 'Present',
  Created_At     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Updated_At     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Deleting a student removes their attendance; a course still in use cannot
  -- be deleted out from under its records.
  CONSTRAINT fk_attendances_student FOREIGN KEY (Student_ID)
    REFERENCES students (Student_ID) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_attendances_course FOREIGN KEY (Course_ID)
    REFERENCES courses (Course_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Stops the same student being marked twice for one class.
  UNIQUE KEY uq_attendance_slot (Student_ID, Course_ID, Class_Date),
  INDEX idx_attendances_student (Student_ID),
  INDEX idx_attendances_course (Course_ID)
) ENGINE = InnoDB;

-- --------------------------------------------------------------------------
-- marks: Course_ID added so a score is attached to a subject. Without it you
-- cannot answer "what did this student get in Physics".
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marks (
  Marks_ID   INT          NOT NULL PRIMARY KEY,
  Student_ID VARCHAR(11)  NOT NULL,
  Course_ID  INT          NULL,
  Exam_Type  VARCHAR(50)  NOT NULL,
  Score      DECIMAL(5, 2) NOT NULL,
  Created_At TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Updated_At TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_marks_student FOREIGN KEY (Student_ID)
    REFERENCES students (Student_ID) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_marks_course FOREIGN KEY (Course_ID)
    REFERENCES courses (Course_ID) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_marks_score CHECK (Score >= 0 AND Score <= 100),
  UNIQUE KEY uq_marks_slot (Student_ID, Course_ID, Exam_Type),
  INDEX idx_marks_student (Student_ID)
) ENGINE = InnoDB;
