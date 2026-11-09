# IELTS Academy

The existing Next.js frontend and API backend run together in this repository, using **SQLite with Prisma ORM**. Local development needs no Supabase project, Docker, API keys, or OpenAI account. The original UI, languages, dark mode and learning screens are retained. Accounts, sessions, progress and results are real database records; no sample users or scores are substituted.

## Windows CMD setup

Install Node.js **24 LTS** (minimum 22.13), then open CMD:

```bat
cd ielts-academy
npm ci
copy .env.example .env
npm run db:setup
npm run dev
```

Open `http://localhost:3000`. Register your own account and complete onboarding. The database is `ielts-academy/db/academy.db`; restarting the server retains your data. Uploaded audio and course files live in `ielts-academy/private-uploads/`, outside the public directory. Both locations are ignored by Git.

On macOS/Linux, replace `copy .env.example .env` with `cp .env.example .env`. In a cloud environment with a read-only home, use `npm ci --cache /workspace/.npm-cache`.

Use `.env` for both setup scripts and Next.js. Remove obsolete Supabase values or conflicting `DATABASE_URL`/`APP_URL` overrides from `.env.local`. Set `APP_URL` to the exact browser origin and port; writes reject other origins. `DATABASE_URL` accepts a local `file:` path relative to this application directory. The supplied value stores the database at `db/academy.db`.

## First administrator and content

Register a real account first, then run:

```bat
npm run db:admin -- your-email@example.com
```

This one-time command refuses to run once an administrator exists. Sign in normally. The Admin UI grants Teacher roles, assigns students to teachers, and manages course/test content. Every new registration receives only Student privileges. No shared administrator password exists.

The initial catalog is empty. Create draft courses, modules, lessons, objective tests, questions and private answer keys, Writing/Speaking tasks, and mock exams in Admin. Every objective question needs an answer key before its test can be published. Teachers see only assigned students. Students can enroll, save progress, submit timed work, upload audio, and view their actual results.

## Database migrations

`npm run db:setup` applies versioned SQL from `prisma/migrations` transactionally, records checksums in `_academy_migrations`, and is safe to repeat. It creates only platform settings and the onboarding badge definition, never users or learning results. Do not edit an applied migration: add a new migration directory and SQL file, update `prisma/schema.prisma` if needed, then run:

```bat
npm run db:generate
npm run db:setup
```

Prisma's JavaScript engine uses a local SQLite driver. Client generation uses the version-pinned Prisma WASM parser, avoiding the CLI's unrelated native migration-engine download. The migration runner uses Node's built-in SQLite driver. Use `db:setup` for this repository, not `prisma migrate deploy` (the migration ledgers differ).

Historical PostgreSQL migrations and Supabase configuration remain in `supabase/` for a future migration. They are not run or required locally. They do not automatically import SQLite data or switch the application back to Supabase. See [architecture](docs/ARCHITECTURE.md).

## Validation

```bat
npm run typecheck
npm run lint
npm test
npm run test:db
npm run build
npm run test:local
npm run test:e2e
```

The SQLite integration suite creates a temporary database, applies actual migrations, exercises real API handlers with database-backed sessions, and tests auth, role isolation, persistence, grading and media access. `npm run test:local` exercises actual registration, onboarding, courses, grading, Writing and Speaking persistence, role-restricted audio, logout/login and server restart through a real production server/browser with a temporary SQLite database. It never writes fixtures to the development database. The separate browser regression suite exercises existing UI workflows with isolated API fixtures. For browser tests on Windows:

```bat
npx playwright install chromium
npm run test:e2e
```

The historical PostgreSQL integration suite remains available for future migration work and skips unless `RUN_DB_TESTS=1` is set. It is not needed for SQLite development.

## Authentication, media and optional AI

Passwords use independently salted scrypt hashes. Seven-day opaque sessions are stored as SHA-256 hashes, delivered through HttpOnly/SameSite cookies, revoked on logout, and rotated on login or password change. Authorization is checked on the server for every operation; browser roles do not grant access. Use `SESSION_COOKIE_SECURE=true` for HTTPS deployments.

Local registration logs in immediately and does not send email. The existing forgot-password UI returns an explicit unavailable message because no email recovery provider is configured; it never claims that an email was sent. Signed-in password changes work and revoke other sessions. Supabase email confirmation/callbacks are not used locally.

Audio URLs require a live authorized session on every read; they are not public bearer links. Uploads have size/MIME/signature checks and are stored with private file permissions. Answer keys, password hashes and session tokens are never included in learner API responses.

OpenAI is optional and disabled by default. Add `OPENAI_API_KEY` only on the server, enable AI in Admin settings, and obtain the learner's consent. Without a key, manual submissions, objective grading and teacher reviews still work. No fabricated feedback is generated. See [deployment and operations](docs/DEPLOYMENT.md) and [API workflows](docs/API.md).

Use a persistent Node server for this SQLite configuration. Ephemeral serverless filesystems do not retain SQLite or uploads. Back up both before migration or deployment. The premium frontend compositions from commit `1920722e6d9db03075f1c5f773cd865f6833a32d` are connected to the live APIs. The original Shell, landing artwork, split-screen authentication, dashboard, course cards and learning layouts are restored. The old browser-only session store, sample exercises and fabricated scores are not used by active screens. See [design restoration](docs/DESIGN-RESTORATION.md).

Content Studio supports teacher-owned content, direct uploads, YouTube lessons and Free/Premium access. See [the Windows update and operator guide](docs/STUDIO-PREMIUM.md) for safe migrations, promo codes, manual activation, payment integration boundaries and the exact changed-file inventory.
