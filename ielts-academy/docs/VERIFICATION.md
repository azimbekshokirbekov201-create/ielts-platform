# SQLite verification

The SQLite implementation was verified in the recovered cloud workspace on 2026-11-09 using Node 24 and Next.js 16.4.3. Frontend and backend remain together in this repository; the existing Supabase migrations are unchanged.

| Check | Result |
|---|---|
| Clean dependencies | `npm ci --cache /workspace/.npm-cache` succeeded, including Prisma generation |
| Development server | `npm run dev -- --port 3001` started and served the existing frontend |
| Initialization | `npm run db:setup` initialized `db/academy.db`; repeated migrations preserved data |
| TypeScript and lint | `npm run typecheck` and `npm run lint` passed |
| Unit/integration tests | 39 passed: 20 real SQLite integration cases and 19 existing service/AI/legacy grading regressions |
| Historical PostgreSQL cases | 19 skipped by default; these are retained for future Supabase migration work and are not counted as passes |
| Production build | `npm run build` passed |
| Existing browser regressions | 18 passed against the production server, including accessibility scans, language switching, responsive layouts, onboarding, CMS, objective work, writing and browser audio recording |
| Real local browser/server smoke | `npm run test:local` passed all five workflow groups against an isolated production server and temporary SQLite database, without mocked API responses |

The real smoke scenario registers through the existing UI, checks HttpOnly/SameSite cookies, completes and resumes onboarding, enrolls in a real course, saves lesson progress, autosaves and grades an objective attempt, submits Writing, and uploads/reads protected Speaking audio. It verifies Student/Admin authorization and that only an assigned Teacher can access a student's audio. After stopping and restarting the production server, it checks the same session, onboarding answers, progress, grades, writing body and private recording. Browser logout and login work afterward with no JavaScript errors.

SQLite integration cases additionally exercise duplicate registration, bad credentials, expired/revoked sessions, password-change revocation, CSRF, privilege escalation rejection, another student's data isolation, last-admin protection, path traversal denial, immutable used content, deadline enforcement, private answer keys, course prerequisites, authorized teacher evaluation and a completed four-skill mock. All test accounts/content exist only in disposable test databases. The development database contains no sample users or results.

External OpenAI calls are not verified live. AI is optional, disabled initially, and explicit about missing configuration. Local registration does not send confirmation emails; email recovery returns `password_recovery_unavailable` until an email provider/token flow is implemented. No fake email delivery or grading results are substituted.

This is a persistent single-server SQLite configuration. Deployment to ephemeral serverless filesystems is not supported. Windows CMD instructions are provided, but this validation ran on Linux; a Windows machine was not available. Historical Supabase RLS/provider checks from the previous implementation do not establish current runtime behavior and are not prerequisites for local SQLite use.
