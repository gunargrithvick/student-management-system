'use strict';

// Student Management — single-page app (no build step, plain ES).
// Talks to the REST API under /api, renders everything with DOM APIs (never
// innerHTML with server data, so stored values can't inject markup), and adapts
// the UI to the logged-in user's role.

const API = '/api';

// Client-side field definitions. Mirror the server's resources so forms and
// tables can be generated instead of hand-written four times over.
const RESOURCES = {
  students: {
    label: 'Students',
    singular: 'Student',
    pk: 'Student_ID',
    fields: [
      { name: 'Student_ID', label: 'Student ID', type: 'text', maxlength: 11 },
      { name: 'Name', label: 'Name', type: 'text' },
      { name: 'DOB', label: 'Date of Birth', type: 'date' },
      {
        name: 'Gender',
        label: 'Gender',
        type: 'select',
        options: ['Male', 'Female', 'Other', 'Prefer not to say'],
      },
      { name: 'Email', label: 'Email', type: 'email' },
      { name: 'Phone', label: 'Phone', type: 'text' },
    ],
  },
  courses: {
    label: 'Courses',
    singular: 'Course',
    pk: 'Course_ID',
    fields: [
      { name: 'Course_ID', label: 'Course ID', type: 'number' },
      { name: 'Course_Name', label: 'Course Name', type: 'text' },
      { name: 'Credits', label: 'Credits', type: 'number', min: 1, max: 20 },
    ],
  },
  attendances: {
    label: 'Attendance',
    singular: 'Attendance',
    pk: 'Attendance_ID',
    fields: [
      { name: 'Attendance_ID', label: 'Attendance ID', type: 'number' },
      { name: 'Student_ID', label: 'Student ID', type: 'text', maxlength: 11 },
      { name: 'Course_ID', label: 'Course ID', type: 'number' },
      { name: 'Enrolment_Date', label: 'Enrolment Date', type: 'date' },
      { name: 'Class_Date', label: 'Class Date', type: 'date', optional: true },
      {
        name: 'Status',
        label: 'Status',
        type: 'select',
        options: ['Present', 'Absent', 'Late', 'Excused'],
      },
    ],
  },
  marks: {
    label: 'Marks',
    singular: 'Marks',
    pk: 'Marks_ID',
    fields: [
      { name: 'Marks_ID', label: 'Marks ID', type: 'number' },
      { name: 'Student_ID', label: 'Student ID', type: 'text', maxlength: 11 },
      { name: 'Course_ID', label: 'Course ID', type: 'number', optional: true },
      { name: 'Exam_Type', label: 'Exam Type', type: 'text' },
      { name: 'Score', label: 'Score', type: 'number', min: 0, max: 100, step: '0.01' },
    ],
  },
};

const state = {
  user: null,
  view: 'dashboard',
  page: 1,
  search: '',
};

// --------------------------------------------------------------------------
// Utilities
// --------------------------------------------------------------------------

// Tiny hyperscript helper. `props.text` sets textContent (safe); everything
// else becomes an attribute or (for on*) an event listener.
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

const canWrite = () => state.user && (state.user.role === 'staff' || state.user.role === 'admin');
const isAdmin = () => state.user && state.user.role === 'admin';

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (res.status === 401) {
    window.location.href = '/login.html';
    throw new Error('Not authenticated');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Request failed (${res.status})`);
  return body;
}

function toast(message, type = 'success') {
  const t = el('div', { class: `toast toast--${type}`, role: 'status', text: message });
  document.getElementById('toasts').append(t);
  setTimeout(() => t.classList.add('toast--out'), 3200);
  setTimeout(() => t.remove(), 3600);
}

function formatDisplay(field, value) {
  if (value == null || value === '') return '';
  if (field && field.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  return String(value);
}

// --------------------------------------------------------------------------
// Navigation
// --------------------------------------------------------------------------
function renderNav() {
  const nav = document.getElementById('mainNav');
  nav.replaceChildren();
  const items = [
    ['dashboard', 'Dashboard'],
    ...Object.entries(RESOURCES).map(([k, r]) => [k, r.label]),
  ];
  if (isAdmin()) items.push(['users', 'Users']);

  for (const [key, label] of items) {
    nav.append(
      el('button', {
        class: 'navbtn' + (state.view === key ? ' navbtn--active' : ''),
        type: 'button',
        text: label,
        'aria-current': state.view === key ? 'page' : null,
        onclick: () => navigate(key),
      }),
    );
  }
}

function navigate(view) {
  state.view = view;
  state.page = 1;
  state.search = '';
  renderNav();
  render();
}

function render() {
  if (state.view === 'dashboard') return renderDashboard();
  if (state.view === 'users') return renderUsers();
  return renderResource(state.view);
}

// --------------------------------------------------------------------------
// Dashboard
// --------------------------------------------------------------------------
async function renderDashboard() {
  const view = document.getElementById('view');
  view.replaceChildren(el('h2', { class: 'view__title', text: 'Dashboard' }));
  try {
    const s = await fetchJSON(`${API}/stats`);
    const cards = [
      ['Students', s.students],
      ['Courses', s.courses],
      ['Attendance records', s.attendances],
      ['Marks recorded', s.marks],
      ['Average score', s.averageScore == null ? '—' : s.averageScore],
    ];
    const grid = el('div', { class: 'stat-grid' });
    for (const [label, value] of cards) {
      grid.append(
        el('div', { class: 'stat-card' }, [
          el('div', { class: 'stat-card__value', text: String(value) }),
          el('div', { class: 'stat-card__label', text: label }),
        ]),
      );
    }
    view.append(grid);
  } catch (err) {
    view.append(el('p', { class: 'form-error', text: err.message }));
  }
}

// --------------------------------------------------------------------------
// Resource list (table + search + pagination + actions)
// --------------------------------------------------------------------------
let searchTimer;

async function renderResource(name) {
  const def = RESOURCES[name];
  const view = document.getElementById('view');
  view.replaceChildren();

  // Toolbar
  const searchInput = el('input', {
    class: 'search',
    type: 'search',
    placeholder: `Search ${def.label.toLowerCase()}…`,
    value: state.search,
    'aria-label': `Search ${def.label}`,
    oninput: (e) => {
      clearTimeout(searchTimer);
      const v = e.target.value;
      searchTimer = setTimeout(() => {
        state.search = v;
        state.page = 1;
        renderResource(name);
      }, 300);
    },
  });

  const toolbar = el('div', { class: 'toolbar' }, [
    el('h2', { class: 'view__title', text: def.label }),
    el('div', { class: 'toolbar__actions' }, [
      searchInput,
      canWrite()
        ? el('button', {
            class: 'btn btn--primary',
            type: 'button',
            text: `+ Add ${def.singular}`,
            onclick: () => openForm(name, 'create'),
          })
        : null,
    ]),
  ]);
  view.append(toolbar);

  const tableHost = el('div', { class: 'table-host' }, el('p', { text: 'Loading…' }));
  view.append(tableHost);

  try {
    const params = new URLSearchParams({ page: state.page, limit: 20 });
    if (state.search) params.set('search', state.search);
    const { data, pagination } = await fetchJSON(`${API}/${name}?${params}`);
    tableHost.replaceChildren(buildTable(def, data), buildPagination(name, pagination));
    // keep focus in search box across re-renders triggered by typing
    if (document.activeElement !== searchInput && state.search) searchInput.focus();
  } catch (err) {
    tableHost.replaceChildren(el('p', { class: 'form-error', text: err.message }));
  }
}

function buildTable(def, rows) {
  if (!rows.length) return el('p', { class: 'empty', text: 'No records found.' });

  const headCells = def.fields.map((f) => el('th', { scope: 'col', text: f.label }));
  if (canWrite()) headCells.push(el('th', { scope: 'col', text: 'Actions' }));

  const body = el('tbody');
  for (const row of rows) {
    const cells = def.fields.map((f) => el('td', { text: formatDisplay(f, row[f.name]) }));
    if (canWrite()) {
      cells.push(
        el('td', { class: 'row-actions' }, [
          el('button', {
            class: 'btn btn--small',
            type: 'button',
            text: 'Edit',
            onclick: () => openForm(state.view, 'edit', row),
          }),
          el('button', {
            class: 'btn btn--small btn--danger',
            type: 'button',
            text: 'Delete',
            onclick: () => confirmDelete(state.view, row[def.pk]),
          }),
        ]),
      );
    }
    body.append(el('tr', {}, cells));
  }

  return el('table', { class: 'data-table' }, [
    el('caption', { class: 'sr-only', text: `${def.label} records` }),
    el('thead', {}, el('tr', {}, headCells)),
    body,
  ]);
}

function buildPagination(name, p) {
  const info = el('span', {
    class: 'pageinfo',
    text: `Page ${p.page} of ${p.totalPages} · ${p.total} total`,
  });
  const prev = el('button', {
    class: 'btn btn--ghost',
    type: 'button',
    text: '‹ Prev',
    disabled: p.page <= 1 ? 'disabled' : null,
    onclick: () => {
      state.page = Math.max(1, state.page - 1);
      renderResource(name);
    },
  });
  const next = el('button', {
    class: 'btn btn--ghost',
    type: 'button',
    text: 'Next ›',
    disabled: p.page >= p.totalPages ? 'disabled' : null,
    onclick: () => {
      state.page = Math.min(p.totalPages, state.page + 1);
      renderResource(name);
    },
  });
  return el('div', { class: 'pagination' }, [prev, info, next]);
}

// --------------------------------------------------------------------------
// Create / edit modal
// --------------------------------------------------------------------------
let lastFocused = null;

function openForm(name, mode, record = {}) {
  const def = RESOURCES[name];
  lastFocused = document.activeElement;
  const root = document.getElementById('modalRoot');

  const form = el('form', { class: 'modal__form', novalidate: 'novalidate' });
  const inputs = {};

  for (const f of def.fields) {
    const id = `f_${f.name}`;
    const isPk = f.name === def.pk;
    let input;
    if (f.type === 'select') {
      input = el(
        'select',
        { id, name: f.name },
        f.options.map((o) => el('option', { value: o, text: o })),
      );
    } else {
      input = el('input', {
        id,
        name: f.name,
        type: f.type,
        maxlength: f.maxlength,
        min: f.min,
        max: f.max,
        step: f.step,
        required: f.optional ? null : 'required',
      });
    }
    // Prefill on edit; the primary key can't be changed.
    if (record[f.name] != null) input.value = record[f.name];
    if (mode === 'edit' && isPk) {
      input.setAttribute('readonly', 'readonly');
      input.setAttribute('aria-readonly', 'true');
      if (input.tagName === 'SELECT') input.setAttribute('disabled', 'disabled');
    }
    inputs[f.name] = input;

    form.append(
      el('div', { class: 'field' }, [
        el('label', { for: id, text: f.label + (f.optional ? ' (optional)' : '') }),
        input,
      ]),
    );
  }

  const errorEl = el('p', { class: 'form-error', role: 'alert' });
  const saveBtn = el('button', {
    class: 'btn btn--primary',
    type: 'submit',
    text: mode === 'create' ? 'Create' : 'Save changes',
  });
  const cancelBtn = el('button', {
    class: 'btn btn--ghost',
    type: 'button',
    text: 'Cancel',
    onclick: closeModal,
  });
  form.append(errorEl, el('div', { class: 'modal__actions' }, [cancelBtn, saveBtn]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    saveBtn.disabled = true;

    const payload = {};
    for (const f of def.fields) {
      if (mode === 'edit' && f.name === def.pk) continue;
      const raw = inputs[f.name].value;
      if (f.optional && raw === '') {
        payload[f.name] = null;
      } else if (f.type === 'number') {
        payload[f.name] = raw === '' ? null : Number(raw);
      } else {
        payload[f.name] = raw;
      }
    }

    try {
      if (mode === 'create') {
        await fetchJSON(`${API}/${name}`, { method: 'POST', body: JSON.stringify(payload) });
        toast(`${def.singular} created.`);
      } else {
        const id = record[def.pk];
        await fetchJSON(`${API}/${name}/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast(`${def.singular} updated.`);
      }
      closeModal();
      renderResource(name);
    } catch (err) {
      errorEl.textContent = err.message;
      saveBtn.disabled = false;
    }
  });

  const dialog = el(
    'div',
    {
      class: 'modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': `${mode === 'create' ? 'Add' : 'Edit'} ${def.singular}`,
    },
    [
      el('h3', {
        class: 'modal__title',
        text: `${mode === 'create' ? 'Add' : 'Edit'} ${def.singular}`,
      }),
      form,
    ],
  );
  const backdrop = el('div', { class: 'modal__backdrop', onclick: closeModal });

  root.replaceChildren(backdrop, dialog);
  root.hidden = false;
  document.addEventListener('keydown', onModalKey);
  // Focus the first editable control.
  const firstEditable = def.fields.find((f) => !(mode === 'edit' && f.name === def.pk));
  if (firstEditable) inputs[firstEditable.name].focus();
}

function onModalKey(e) {
  if (e.key === 'Escape') closeModal();
}

function closeModal() {
  const root = document.getElementById('modalRoot');
  root.hidden = true;
  root.replaceChildren();
  document.removeEventListener('keydown', onModalKey);
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

// --------------------------------------------------------------------------
// Delete
// --------------------------------------------------------------------------
async function confirmDelete(name, id) {
  const def = RESOURCES[name];
  if (
    !window.confirm(`Delete this ${def.singular.toLowerCase()} (ID ${id})? This cannot be undone.`)
  ) {
    return;
  }
  try {
    await fetchJSON(`${API}/${name}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast(`${def.singular} deleted.`);
    renderResource(name);
  } catch (err) {
    toast(err.message, 'error');
  }
}

// --------------------------------------------------------------------------
// Users admin
// --------------------------------------------------------------------------
async function renderUsers() {
  const view = document.getElementById('view');
  view.replaceChildren(el('h2', { class: 'view__title', text: 'Users' }));

  // Add-user form
  const uName = el('input', { type: 'text', required: 'required', 'aria-label': 'New username' });
  const uPass = el('input', {
    type: 'password',
    required: 'required',
    minlength: 8,
    'aria-label': 'New password',
  });
  const uRole = el(
    'select',
    { 'aria-label': 'Role' },
    ['viewer', 'staff', 'admin'].map((r) => el('option', { value: r, text: r })),
  );
  const addForm = el('form', { class: 'user-add' }, [
    el('div', { class: 'field' }, [el('label', { text: 'Username' }), uName]),
    el('div', { class: 'field' }, [el('label', { text: 'Password (min 8)' }), uPass]),
    el('div', { class: 'field' }, [el('label', { text: 'Role' }), uRole]),
    el('button', { class: 'btn btn--primary', type: 'submit', text: 'Add user' }),
  ]);
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!addForm.checkValidity()) return addForm.reportValidity();
    try {
      await fetchJSON(`${API}/auth/users`, {
        method: 'POST',
        body: JSON.stringify({
          username: uName.value,
          password: uPass.value,
          role: uRole.value,
        }),
      });
      toast('User created.');
      renderUsers();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  view.append(addForm);

  const host = el('div', { class: 'table-host' }, el('p', { text: 'Loading…' }));
  view.append(host);
  try {
    const { data } = await fetchJSON(`${API}/auth/users`);
    const body = el('tbody');
    for (const u of data) {
      body.append(
        el('tr', {}, [
          el('td', { text: u.Username }),
          el('td', { text: u.Role }),
          el('td', { text: formatDisplay({ type: 'text' }, (u.Created_At || '').slice(0, 10)) }),
          el(
            'td',
            { class: 'row-actions' },
            u.Username === state.user.username
              ? el('span', { class: 'muted', text: '(you)' })
              : el('button', {
                  class: 'btn btn--small btn--danger',
                  type: 'button',
                  text: 'Delete',
                  onclick: () => deleteUser(u.User_ID),
                }),
          ),
        ]),
      );
    }
    host.replaceChildren(
      el('table', { class: 'data-table' }, [
        el(
          'thead',
          {},
          el('tr', {}, [
            el('th', { scope: 'col', text: 'Username' }),
            el('th', { scope: 'col', text: 'Role' }),
            el('th', { scope: 'col', text: 'Created' }),
            el('th', { scope: 'col', text: 'Actions' }),
          ]),
        ),
        body,
      ]),
    );
  } catch (err) {
    host.replaceChildren(el('p', { class: 'form-error', text: err.message }));
  }
}

async function deleteUser(id) {
  if (!window.confirm('Delete this user?')) return;
  try {
    await fetchJSON(`${API}/auth/users/${id}`, { method: 'DELETE' });
    toast('User deleted.');
    renderUsers();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// --------------------------------------------------------------------------
// Boot
// --------------------------------------------------------------------------
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'same-origin' });
  } finally {
    window.location.href = '/login.html';
  }
});

(async function init() {
  try {
    const { user } = await fetchJSON(`${API}/auth/me`);
    state.user = user;
    document.getElementById('userInfo').textContent = `${user.username} (${user.role})`;
    renderNav();
    render();
  } catch {
    // fetchJSON already redirects on 401.
  }
})();
