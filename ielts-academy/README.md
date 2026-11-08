# IELTS Academy

A database-backed IELTS learning platform using Next.js 16, React, TypeScript, Supabase PostgreSQL/Auth/Storage, and optional OpenAI feedback. The original Academy typography, colors and dark mode are retained. The active application no longer uses demo sessions, bundled sample questions, or fabricated dashboard metrics.

## Development

Use Node 22+ (verified with Node 24). Work in this existing isolated checkout; do not create an additional worktree unless explicitly requested.

```sh
npm ci
cp .env.example .env.local
# Set Supabase project URL, anon/publishable key and server service-role key securely.
npm run dev
```

Use `npm ci --cache /workspace/.npm-cache` if the cloud user's home directory is read-only. Never disable TLS or integrity verification. Configure `APP_URL` to the exact origin used in your browser, including port; state-changing requests enforce same-origin protection. Sessions use HttpOnly, SameSite=Lax cookies, Secure in production. Browser code receives no service or AI key. Session refresh is handled on authenticated API requests.

The app renders a configuration-required state when Supabase is absent. It does not substitute fake accounts or content. Authenticated students complete `/onboarding` before the dashboard. Admins and teachers are redirected by database roles, not a role chooser.

See [deployment and security](docs/DEPLOYMENT.md), [architecture](docs/ARCHITECTURE.md), and [API workflows](docs/API.md).

## Local Supabase

Install the official Supabase CLI and Docker. Configuration is in `supabase/config.toml`; ports 54331–54334 keep it separate from the disposable PostgreSQL test database. No educational seed runs.

```sh
supabase start -x realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
# If required, the CLI officially supports SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io.
# Copy local URL/anon/service values securely into .env.local (do not paste them into chat).
npm run dev
```

Local Auth configuration permits development signups; production must enable email confirmation, SMTP, CAPTCHA and appropriate rate limits. Never point test suites at production.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The PostgreSQL integration suite uses a **disposable `academy_test` database** in the local container `ielts-db`. It bootstraps Auth/Storage schema interfaces, applies every migration, and exercises genuine SQL/RLS/RPC behavior; it does not emulate a live hosted Auth service.

```sh
docker run -d --name ielts-db -e POSTGRES_HOST_AUTH_METHOD=trust \
  -p 127.0.0.1:54322:5432 postgres:17-alpine
npm run test:db
```

This trust-only database is local test infrastructure, never a deployment configuration. Existing container contents are retained; the suite drops/recreates only `academy_test`. Browser tests use isolated API fixtures for authenticated UI workflows; their results do not establish hosted Supabase or OpenAI connectivity. The unit suite retains separately labeled legacy grading tests as regression checks for the unused original demo code.

## Application workflows

- Admin: create draft courses, modules, lessons, tests, sections, passages, questions, options, private keys, Writing/Speaking tasks and mock exams; preview, edit, publish, unpublish, archive or delete where referential integrity allows. Manage roles and teacher/student relationships. Upload private media, view real counts, audit events and AI limits.
- Student: register/verify, resume onboarding, enroll, complete published lessons, take timed objective practice with server marking, submit timed writing, record/upload speaking, complete sequential mock sections, review real results and consent to optional AI processing.
- Teacher: access only assigned students, assign published content, review authorized writing/audio, and evaluate using separate writing/speaking rubrics. Teacher review supersedes AI estimates.

Content is administrator-authored; interface language does not machine-translate examination text. The three interface dictionaries use stable keys. Only the onboarding badge is awarded automatically. XP and streak widgets are deliberately hidden; no learning activity is invented.

Legacy frontend-only feature files and `src/data/content.ts` are retained for reference and are not imported by the active platform. Do not reconnect them as production data sources.
