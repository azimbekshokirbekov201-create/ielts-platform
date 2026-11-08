# Implementation verification — 8 November 2026

## Executed successfully in this workspace

| Check | Outcome |
|---|---|
| Frozen dependency installation | `npm ci` succeeded using a writable cache; Supabase packages added with lockfile updates; `npm ls --depth=0` succeeds |
| TypeScript | `npm run typecheck` passed |
| ESLint | `npm run lint` passed without errors or warnings |
| Unit/service tests | 19 passed: eight input/translation/upload tests, five mocked-provider AI boundary tests, six retained legacy grading regressions |
| PostgreSQL integration | 19 passed, applying all five migrations to a disposable PostgreSQL 17 database |
| Production build | `npm run build` passed (Next.js 16.4.3, webpack) |
| Production server | Restarted with `npm start`; browser suite exercised this build |
| Browser tests | 18 passed; includes four public-page axe scans, language switching, account form, same-origin rejection, anonymous API, onboarding save/resume/completion, empty/error states, 320/375/768/1440 px layouts, CMS draft/publish/unpublish, objective autosave/submission, writing recovery, and real browser microphone recording through signed-upload fixtures |
| Visual inspection | Desktop and 375 px onboarding screenshots inspected |
| Repository whitespace | `git diff --check` passed |

The database suite checks zero initial educational content, RLS on every public table, safe role provisioning, escalation denial, onboarding validation/idempotency/isolation, publication/key protection, attempt resume/marking/deadlines/ownership, immutable used tests, assigned-teacher review, consent/quota enforcement, first-admin restrictions, final-admin retention, writing retry idempotency, mock publication/access, four-skill mock completion/teacher-scored overall band, and private recording ownership.

The normal unit command skips the database suite unless `RUN_DB_TESTS=1`; it was **separately executed** by `npm run test:db`. Skipped default DB cases are not counted as unit passes. Provider tests stub external OpenAI responses. Authenticated browser tests use isolated API fixtures; real SQL/RLS execution is covered separately, not by a hosted Supabase session.

## Not verified live

No hosted Supabase URL/keys or OpenAI key were available in environment bindings or the process. No production migrations were applied, no production user was created, no real email was sent, and no remote deployment was made.

A full local Supabase stack was attempted. The default ECR image destination was denied; the official CLI's documented Docker Hub registry override was then used. Docker layer extraction failed with `no space left on device`. That attempt was stopped; the smaller standalone PostgreSQL test database remains working. The CLI release binary was downloaded from the official GitHub release and SHA-256 checked against its published checksum before execution. TLS and package integrity verification were preserved.

Before production acceptance, use a staging Supabase project to verify actual signup/email confirmation/recovery, cookies and session refresh, role redirects, Storage CORS/signed direct upload/read/finalization, authorized private recording playback, and consented OpenAI transcription/evaluation. Review model availability, function timeouts, provider billing limits, and retention rules. Follow DEPLOYMENT.md.

## Current limits

- No XP/streak widget is exposed; no fake values or automatic learning milestones are awarded. Only completed onboarding receives its one idempotent badge.
- Lesson completion is an authenticated explicit learner action, not a guarantee of video watch time.
- AI feedback is estimated. Transcript-only speaking feedback intentionally supplies no pronunciation or speaking-band score; a teacher must evaluate audio.
- Full-length mocks require administrators to author and order both Writing tasks and all three Speaking parts with suitable timings; shorter practice configurations are also supported. The automated end-to-end SQL mock scenario uses one isolated task per skill; the additional multi-task configuration has not been exercised with hosted services.
- Learner catalogs and admin content/users have page controls. Histories and teacher lists are currently bounded to 100; expand those operational lists for larger deployments (see deployment guide).
- Legacy demo source remains for reference but is not imported by the active platform or used to seed the database.
- The verification above was recorded before Git publication. Consult the repository history for subsequent commits; no deployment or environment publication was performed.
