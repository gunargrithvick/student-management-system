'use strict';

// Login page. Posts credentials to the API; on success the server sets an
// httpOnly cookie and we navigate to the app. Kept separate from app.js so the
// unauthenticated page loads nothing it doesn't need.

const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || 'Login failed.');
    window.location.href = '/';
  } catch (err) {
    errorEl.textContent = err.message;
    submitBtn.disabled = false;
  }
});
