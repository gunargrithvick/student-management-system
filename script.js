function showSection(mainSectionId, subSectionId) {
  document.querySelectorAll('.section').forEach(div => {
    div.style.display = 'none';
  });
  const mainSection = document.getElementById(mainSectionId);
  if (mainSection) {
    mainSection.style.display = 'block';
    mainSection.querySelectorAll('div[id]').forEach(subDiv => {
      if (subDiv.parentElement && subDiv.parentElement.id === mainSectionId) {
        subDiv.style.display = 'none';
      }
    });
    const targetSubSection = document.getElementById(subSectionId);
    if (targetSubSection) {
      targetSubSection.style.display = 'block';
    }
  }
}

function clearForm(formId) {
  const form = document.getElementById(formId);
  form.querySelectorAll('input').forEach(input => input.value = '');
}

function renderTable(data, containerId) {
  const container = document.getElementById(containerId);
  if (!Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<p>No data found</p>';
    return;
  }
  let html = '<table><thead><tr>';
  Object.keys(data[0]).forEach(key => {
    html += `<th style="text-align:center">${key}</th>`;
  });
  html += '</tr></thead><tbody>';
  data.forEach(row => {
    html += '<tr>';
    Object.keys(row).forEach(key => {
      let val = row[key];
      if (
        (key === 'DOB' || key === 'Enrolment_Date') &&
        typeof val === 'string' &&
        val.includes('T') &&
        val.includes('Z')
      ) {
        try {
          const date = new Date(val);
          const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
          val = date.toLocaleDateString('en-GB', options);
        } catch (e) {
          console.warn(`Could not parse date for display (${key}):`, val, e);
        }
      }
      html += `<td style="text-align:center">${val}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  showSection('insert', 'insert-student');

  document.getElementById('insertStudentForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      operation: 'insert',
      table: 'student',
      payload: {
        Student_ID: document.getElementById('iStudentID').value,
        Name: document.getElementById('iName').value,
        DOB: document.getElementById('iDOB').value,
        Gender: document.getElementById('iGender').value,
        Email: document.getElementById('iEmail').value,
        Phone: document.getElementById('iPhone').value
      }
    };
    sendRequest(data, null, 'insertStudentForm');
  });

  document.getElementById('insertCourseForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      operation: 'insert',
      table: 'course',
      payload: {
        Course_ID: Number(document.getElementById('iCourseID').value),
        Course_Name: document.getElementById('iCourseName').value,
        Credits: Number(document.getElementById('iCredits').value)
      }
    };
    sendRequest(data, null, 'insertCourseForm');
  });

  document.getElementById('insertAttendanceForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      operation: 'insert',
      table: 'attendance',
      payload: {
        Attendance_ID: Number(document.getElementById('iAttendanceID').value),
        Student_ID: document.getElementById('iAStudentID').value,
        Course_ID: Number(document.getElementById('iACourseID').value),
        Enrolment_Date: document.getElementById('iEnrolmentDate').value
      }
    };
    sendRequest(data, null, 'insertAttendanceForm');
  });

  document.getElementById('insertMarksForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      operation: 'insert',
      table: 'marks',
      payload: {
        Marks_ID: Number(document.getElementById('iMarksID').value),
        Student_ID: document.getElementById('iMStudentID').value,
        Exam_Type: document.getElementById('iExamType').value,
        Score: parseFloat(document.getElementById('iScore').value)
      }
    };
    sendRequest(data, null, 'insertMarksForm');
  });

  document.getElementById('updateStudentForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      operation: 'update',
      table: 'student',
      payload: {
        Student_ID: document.getElementById('uStudentID').value,
        Name: document.getElementById('uName').value,
        DOB: document.getElementById('uDOB').value,
        Gender: document.getElementById('uGender').value,
        Email: document.getElementById('uEmail').value,
        Phone: document.getElementById('uPhone').value
      }
    };
    sendRequest(data, null, 'updateStudentForm');
  });

  document.getElementById('updateCourseForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      operation: 'update',
      table: 'course',
      payload: {
        Course_ID: Number(document.getElementById('uCourseID').value),
        Course_Name: document.getElementById('uCourseName').value,
        Credits: Number(document.getElementById('uCredits').value)
      }
    };
    sendRequest(data, null, 'updateCourseForm');
  });

  document.getElementById('updateAttendanceForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      operation: 'update',
      table: 'attendance',
      payload: {
        Attendance_ID: Number(document.getElementById('uAttendanceID').value),
        Student_ID: document.getElementById('uAStudentID').value,
        Course_ID: Number(document.getElementById('uACourseID').value),
        Enrolment_Date: document.getElementById('uEnrolmentDate').value
      }
    };
    sendRequest(data, null, 'updateAttendanceForm');
  });

  document.getElementById('updateMarksForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      operation: 'update',
      table: 'marks',
      payload: {
        Marks_ID: Number(document.getElementById('uMarksID').value),
        Student_ID: document.getElementById('uMStudentID').value,
        Exam_Type: document.getElementById('uExamType').value,
        Score: parseFloat(document.getElementById('uScore').value)
      }
    };
    sendRequest(data, null, 'updateMarksForm');
  });

  document.querySelector('#delete-student button').addEventListener('click', () => {
    const id = document.getElementById('dStudentID').value;
    const data = {
      operation: 'delete',
      table: 'student',
      payload: {
        Student_ID: id
      }
    };
    sendRequest(data);
  });

  document.querySelector('#delete-course button').addEventListener('click', () => {
    const id = Number(document.getElementById('dCourseID').value);
    const data = {
      operation: 'delete',
      table: 'course',
      payload: {
        Course_ID: id
      }
    };
    sendRequest(data);
  });

  document.querySelector('#delete-attendance button').addEventListener('click', () => {
    const id = Number(document.getElementById('dAttendanceID').value);
    const data = {
      operation: 'delete',
      table: 'attendance',
      payload: {
        Attendance_ID: id
      }
    };
    sendRequest(data);
  });

  document.querySelector('#delete-marks button').addEventListener('click', () => {
    const id = Number(document.getElementById('dMarksID').value);
    const data = {
      operation: 'delete',
      table: 'marks',
      payload: {
        Marks_ID: id
      }
    };
    sendRequest(data);
  });

  document.querySelector('#retrieve-student button').addEventListener('click', () => {
    const data = {
      operation: 'retrieve',
      table: 'student'
    };
    sendRequest(data, 'retrieveStudentResult');
  });

  document.querySelector('#retrieve-course button').addEventListener('click', () => {
    const data = {
      operation: 'retrieve',
      table: 'course'
    };
    sendRequest(data, 'retrieveCourseResult');
  });

  document.querySelector('#retrieve-attendance button').addEventListener('click', () => {
    const data = {
      operation: 'retrieve',
      table: 'attendance'
    };
    sendRequest(data, 'retrieveAttendanceResult');
  });

  document.querySelector('#retrieve-marks button').addEventListener('click', () => {
    const data = {
      operation: 'retrieve',
      table: 'marks'
    };
    sendRequest(data, 'retrieveMarksResult');
  });
});

function sendRequest(data, resultElementId = null, formIdToClear = null) {
  fetch('http://localhost:3000', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    .then(res => {
      return res.json().then(json => {
        if (!res.ok) {
          throw new Error(json.message || `Operation failed with status ${res.status}`);
        }
        return json;
      });
    })
    .then(responseData => {
      if (resultElementId) {
        renderTable(responseData, resultElementId);
      } else {
        alert(responseData.message || 'Operation successful!');
        if (formIdToClear) clearForm(formIdToClear);
      }
    })
    .catch(err => {
      alert('Operation failed: ' + err.message);
      console.error('Fetch error:', err);
    });
}