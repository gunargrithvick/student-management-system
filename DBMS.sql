CREATE DATABASE STUDENT_MANAGEMENT;
USE STUDENT_MANAGEMENT;

CREATE TABLE students (
    Student_ID VARCHAR(11) PRIMARY KEY,
    Name VARCHAR(100),
    DOB DATE,
    Gender VARCHAR(10),
    Email VARCHAR(100),
    Phone VARCHAR(15)
);

CREATE TABLE courses (
    Course_ID INT PRIMARY KEY,
    Course_Name VARCHAR(100),
    Credits INT
);

CREATE TABLE attendances (
    Attendance_ID INT PRIMARY KEY,
    Student_ID VARCHAR(11),
    Course_ID INT,
    Enrolment_Date DATE,
    FOREIGN KEY (Student_ID) REFERENCES Student(Student_ID),
    FOREIGN KEY (Course_ID) REFERENCES Course(Course_ID)
);

CREATE TABLE marks (
    Marks_ID INT PRIMARY KEY,
    Student_ID VARCHAR(11),
    Exam_Type VARCHAR(50),
    Score DECIMAL(5,2),
    FOREIGN KEY (Student_ID) REFERENCES Student(Student_ID)
);