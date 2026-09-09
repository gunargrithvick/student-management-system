# Student Management System

A small full-stack app for managing students, courses, attendance, and marks.
Node/Express REST API backed by MySQL, with a dependency-free web UI. Includes
authentication, role-based access control, input validation, pagination, and
search.

## Features

- **REST API** — `GET/POST/PUT/DELETE /api/:resource` for students, courses,
  attendances, and marks, generated from a single config map.
- **Auth & roles** — login with hashed passwords (bcrypt) and JWT in an
  httpOnly cookie. Three roles: `viewer` (read), `staff` (read + write),
  `admin` (write + manage users).
- **Validation** — every write is validated with zod before it reaches the DB.
- **Safe rendering** — the UI builds tables with DOM APIs, so stored values
  can't inject markup (no stored XSS).
- **Dashboard** — record counts and average score.
- **Search + pagination** on every list.
- **Security** — helmet headers, rate limiting (global + stricter on login),
  parameterized queries, secure cookies in production.
- **Ops** — `/api/health` readiness endpoint, connection pooling, Docker +
  docker-compose, unit tests.

## Prerequisites

- Node.js 18+
- MySQL 8 (local, or via the included docker-compose)

## Quick start (local, with your own MySQL)

```bash
npm install
cp .env.example .env        # then edit .env with your DB credentials + JWT_SECRET
npm run init-db             # creates schema + admin user (add ` -- --seed` for demo data)
npm start
```

Open http://localhost:3000 and log in with the admin credentials from your
`.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`). If you left `ADMIN_PASSWORD` blank
in development, `init-db` prints a generated password once — save it.

Generate a strong `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Quick start (Docker)

```bash
# Provide at least JWT_SECRET and ADMIN_PASSWORD (via a .env file or your shell)
docker compose up --build -d
docker compose exec app npm run init-db     # add: -- --seed  for demo data
```

App on http://localhost:3000, MySQL on `localhost:3306`.

## Configuration

All configuration is via environment variables — see [.env.example](.env.example).
Required in production: `JWT_SECRET` (≥32 chars), DB credentials, and
`ADMIN_PASSWORD`. Set `DB_SSL=true` when connecting to a managed MySQL provider.

## API overview

| Method          | Path                 | Role   | Description                    |
| --------------- | -------------------- | ------ | ------------------------------ |
| POST            | `/api/auth/login`    | —      | Log in, sets auth cookie       |
| POST            | `/api/auth/logout`   | —      | Clear auth cookie              |
| GET             | `/api/auth/me`       | any    | Current user                   |
| GET             | `/api/stats`         | any    | Dashboard counts               |
| GET             | `/api/:resource`     | any    | List (`?page=&limit=&search=`) |
| GET             | `/api/:resource/:id` | any    | Read one                       |
| POST            | `/api/:resource`     | staff+ | Create                         |
| PUT             | `/api/:resource/:id` | staff+ | Update                         |
| DELETE          | `/api/:resource/:id` | staff+ | Delete                         |
| GET/POST/DELETE | `/api/auth/users`    | admin  | Manage users                   |
| GET             | `/api/health`        | —      | Readiness probe                |

`:resource` is one of `students`, `courses`, `attendances`, `marks`.

## Testing

`npm test` runs the suite on Node's built-in runner — no database required.
It covers validation schemas, password hashing, the login timing-safe dummy
hash, JWT round-trips, DB-error mapping, and HTTP-level checks (auth gating,
validation, security headers, JSON 404s) against the real Express app via
supertest. CI runs the same suite plus a Prettier format check on every push.

## Scripts

| Command                | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `npm start`            | Run the server                                         |
| `npm run dev`          | Run with file watch                                    |
| `npm run init-db`      | Create schema + admin user (`-- --seed` for demo data) |
| `npm run seed`         | Create schema + admin user with demo data              |
| `npm test`             | Run unit tests (no DB required)                        |
| `npm run format`       | Format with Prettier                                   |
| `npm run format:check` | Check formatting without writing (used in CI)          |

## Deploying

The frontend is served by Express, so this is a single deployable service.
Deploy the Node app plus a managed MySQL instance on the same platform
(Railway, Render, Fly.io all work). Set the environment variables from
`.env.example`, run `npm run init-db` once against the production database, and
point the platform's health check at `/api/health`.

## Tech notes

- `src/config.js` — env-driven config, fails fast on missing prod secrets
- `src/db.js` — shared connection pool
- `src/resources.js` — table definitions + zod schemas (single source of truth)
- `src/auth.js` — hashing, JWT, auth/role middleware
- `src/errors.js` — typed errors + MySQL-error translation
- `server.js` — generic CRUD routing built from the resource map

## License

MIT © Guna Rithvick
