const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;

const dbConfig = {
    host: '127.0.0.1',
    user: 'root',
    password: 'Gr@20082005',
    database: 'student_management',
    port: '3306',
};

async function query(sql, params) {
    const connection = await mysql.createConnection(dbConfig);
    const [results] = await connection.execute(sql, params);
    await connection.end();
    return results;
}

app.post('/', async (req, res) => {
    const { operation, table, payload } = req.body;
    if (!operation || !table) {
        return res.status(400).json({ message: 'Operation and table are required' });
    }

    try {
        switch (operation) {
            case 'insert':
                switch (table) {
                    case 'student': {
                        const exists = await query('SELECT 1 FROM students WHERE Student_ID = ?', [payload.Student_ID]);
                        if (exists.length) return res.status(400).json({ message: 'Student_ID already exists' });
                        await query(
                            'INSERT INTO students (Student_ID, Name, DOB, Gender, Email, Phone) VALUES (?, ?, ?, ?, ?, ?)',
                            [payload.Student_ID, payload.Name, payload.DOB, payload.Gender, payload.Email, payload.Phone]
                        );
                        return res.json({ message: 'Student inserted' });
                    }
                    case 'course': {
                        const exists = await query('SELECT 1 FROM courses WHERE Course_ID = ?', [payload.Course_ID]);
                        if (exists.length) return res.status(400).json({ message: 'Course_ID already exists' });
                        await query(
                            'INSERT INTO courses (Course_ID, Course_Name, Credits) VALUES (?, ?, ?)',
                            [payload.Course_ID, payload.Course_Name, payload.Credits]
                        );
                        return res.json({ message: 'Course inserted' });
                    }
                    case 'attendance': {
                        const exists = await query('SELECT 1 FROM attendances WHERE Attendance_ID = ?', [payload.Attendance_ID]);
                        if (exists.length) return res.status(400).json({ message: 'Attendance_ID already exists' });
                        await query(
                            'INSERT INTO attendances (Attendance_ID, Student_ID, Course_ID, Enrolment_Date) VALUES (?, ?, ?, ?)',
                            [payload.Attendance_ID, payload.Student_ID, payload.Course_ID, payload.Enrolment_Date]
                        );
                        return res.json({ message: 'Attendance inserted' });
                    }
                    case 'marks': {
                        const exists = await query('SELECT 1 FROM marks WHERE Marks_ID = ?', [payload.Marks_ID]);
                        if (exists.length) return res.status(400).json({ message: 'Marks_ID already exists' });
                        await query(
                            'INSERT INTO marks (Marks_ID, Student_ID, Exam_Type, Score) VALUES (?, ?, ?, ?)',
                            [payload.Marks_ID, payload.Student_ID, payload.Exam_Type, payload.Score]
                        );
                        return res.json({ message: 'Marks inserted' });
                    }
                    default:
                        return res.status(400).json({ message: 'Unknown table' });
                }

            case 'update':
                switch (table) {
                    case 'student': {
                        const result = await query(
                            'UPDATE students SET Name = ?, DOB = ?, Gender = ?, Email = ?, Phone = ? WHERE Student_ID = ?',
                            [payload.Name, payload.DOB, payload.Gender, payload.Email, payload.Phone, payload.Student_ID]
                        );
                        if (result.affectedRows === 0) return res.status(404).json({ message: 'Student not found' });
                        return res.json({ message: 'Student updated' });
                    }
                    case 'course': {
                        const result = await query(
                            'UPDATE courses SET Course_Name = ?, Credits = ? WHERE Course_ID = ?',
                            [payload.Course_Name, payload.Credits, payload.Course_ID]
                        );
                        if (result.affectedRows === 0) return res.status(404).json({ message: 'Course not found' });
                        return res.json({ message: 'Course updated' });
                    }
                    case 'attendance': {
                        const result = await query(
                            'UPDATE attendances SET Student_ID = ?, Course_ID = ?, Enrolment_Date = ? WHERE Attendance_ID = ?',
                            [payload.Student_ID, payload.Course_ID, payload.Enrolment_Date, payload.Attendance_ID]
                        );
                        if (result.affectedRows === 0) return res.status(404).json({ message: 'Attendance not found' });
                        return res.json({ message: 'Attendance updated' });
                    }
                    case 'marks': {
                        const result = await query(
                            'UPDATE marks SET Student_ID = ?, Exam_Type = ?, Score = ? WHERE Marks_ID = ?',
                            [payload.Student_ID, payload.Exam_Type, payload.Score, payload.Marks_ID]
                        );
                        if (result.affectedRows === 0) return res.status(404).json({ message: 'Marks not found' });
                        return res.json({ message: 'Marks updated' });
                    }
                    default:
                        return res.status(400).json({ message: 'Unknown table' });
                }

            case 'delete':
                switch (table) {
                    case 'student': {
                        const result = await query('DELETE FROM students WHERE Student_ID = ?', [payload.Student_ID]);
                        if (result.affectedRows === 0) return res.status(404).json({ message: 'Student not found' });
                        return res.json({ message: 'Student deleted' });
                    }
                    case 'course': {
                        const result = await query('DELETE FROM courses WHERE Course_ID = ?', [payload.Course_ID]);
                        if (result.affectedRows === 0) return res.status(404).json({ message: 'Course not found' });
                        return res.json({ message: 'Course deleted' });
                    }
                    case 'attendance': {
                        const result = await query('DELETE FROM attendances WHERE Attendance_ID = ?', [payload.Attendance_ID]);
                        if (result.affectedRows === 0) return res.status(404).json({ message: 'Attendance not found' });
                        return res.json({ message: 'Attendance deleted' });
                    }
                    case 'marks': {
                        const result = await query('DELETE FROM marks WHERE Marks_ID = ?', [payload.Marks_ID]);
                        if (result.affectedRows === 0) return res.status(404).json({ message: 'Marks not found' });
                        return res.json({ message: 'Marks deleted' });
                    }
                    default:
                        return res.status(400).json({ message: 'Unknown table' });
                }

            case 'retrieve':
                switch (table) {
                    case 'student': {
                        const results = await query('SELECT * FROM students');
                        return res.json(results);
                    }
                    case 'course': {
                        const results = await query('SELECT * FROM courses');
                        return res.json(results);
                    }
                    case 'attendance': {
                        const results = await query('SELECT * FROM attendances');
                        return res.json(results);
                    }
                    case 'marks': {
                        const results = await query('SELECT * FROM marks');
                        return res.json(results);
                    }
                    default:
                        return res.status(400).json({ message: 'Unknown table' });
                }

            default:
                return res.status(400).json({ message: 'Unknown operation' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));