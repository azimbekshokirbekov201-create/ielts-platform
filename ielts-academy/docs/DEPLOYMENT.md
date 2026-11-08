# Deployment and operating guide

## Supabase

1. Create a Supabase project. Keep the database password, service-role key and AI key out of source control.
2. Link with the official Supabase CLI (`supabase link --project-ref YOUR_PROJECT_REF`) and review then apply `supabase db push`. This is an external production change: perform it intentionally against the chosen project. Migrations are versioned under `supabase/migrations`; there is no educational seed.
3. Migrations create all tables, constraints, indexes, RLS, transactional workflows and two **private** Storage buckets. Course media is readable only when referenced by published content; speaking audio only by its owner or authorized reviewer. Signed links last five minutes. Buckets limit uploads to 25 MiB and explicit MIME types. The server issues authorized direct-upload URLs (so media avoids Vercel request-body limits), then verifies the stored file signature before finalizing its metadata. Signed upload URLs expire after the provider’s two-hour window; signed read URLs expire after five minutes. Use dedicated video hosting or a YouTube HTTPS link for larger lessons.
4. Configure the Auth site URL and allowlist `/auth/callback` on the exact application origin. Enable email verification, production SMTP and password protections. Supabase PKCE links must complete in the initiating browser. Recovery redirects through `/auth/callback?next=reset` to `/reset-password`. Test signup verification, recovery, and logout with your mail provider.
5. Register and verify your administrator's real account. With server variables loaded securely, run `ADMIN_EMAIL=your-verified-email node --env-file=.env.local scripts/first-admin.mjs`. The database takes an advisory lock and refuses a second bootstrap if an administrator exists. Additional privileges are granted/revoked through the authenticated Admin interface; the last admin cannot be removed. Client metadata never assigns roles.

## Vercel

Set the project root to `ielts-academy`. Use Node 22+, `npm ci`, build `npm run build`, and the Next.js framework preset. Supply the variables from `.env.example` securely. Set `APP_URL` to the actual HTTPS origin. Configure Preview deployments with a separate Supabase development project and matching Auth redirect URLs; never reuse production data for tests.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public project configuration, protected by RLS. `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` must be server-only. Never expose them with `NEXT_PUBLIC_` or log them. The service key is required for the shared database rate limiter even when AI is disabled. Use a trusted reverse proxy that overwrites `x-forwarded-for`; Vercel provides this. Enable upstream bot protection/CAPTCHA for public registration.

The server has private/no-store API responses and security headers. For more restrictive CSP, inventory required media providers before enabling it. Do not allow user HTML rendering: authored content is currently plain text. Keep dependencies and Supabase security patches current.

## AI and consent

AI starts **disabled**. Add an OpenAI API key, confirm the selected model is available to your account, set provider spending limits, then enable AI in Admin settings. Default model: `gpt-4.1-mini`; transcription: `gpt-4o-mini-transcribe`. Models and pricing change: update `OPENAI_MODEL` and cost-rate variables deliberately. Default limits are two requests per user and twenty platform-wide per UTC day; reduce them as needed. PostgreSQL serializes reservations. Failed requests and the bounded transient retry consume the original reservation, limiting retry abuse.

Students must opt in under Settings before writing or audio leaves Supabase for OpenAI. Speaking audio is sent only to transcribe; text feedback makes no pronunciation or overall speaking-band claim. Teacher audio review can supply all four rubric scores. Writing AI outputs are schema validated, stored as estimates and overridden in final mock calculations by teacher reviews. Model/student text is treated as untrusted input. Stored feedback is rendered as text.

Usage logs capture completion token counts and configurable estimated completion costs. Transcription charges and provider-specific reasoning/caching billing are **not** included in this estimate. Review actual OpenAI billing separately. A 0–10 USD monthly budget is viable only within hosting free tiers and bounded usage; unlimited AI and video hosting are not included. Set Vercel function timeouts to fit the 45-second provider deadline plus one bounded retry; short plans can require an asynchronous worker for AI jobs. No paid job runner is provisioned here.

## Content and examinations

Create draft content through Admin. To publish an objective test, add its sections, questions and a private key for **every** question. Multiple-choice answers use sorted comma-separated option values; accepted variants are one per line. Matching and headings use administrator-defined options. No IELTS content is bundled into the database.

Add a conversion array such as `[{"min":0,"band":0}]` only with an appropriate, reviewed score table for that test and Academic/General format. This is a format example, **not** a score conversion to use for real tests. Without a conversion only raw scores are reported. Full-length 40-question conversions must not be applied to short practice tests.

Used objective tests and subjective tasks are immutable (except publication state); create a new version to change them. Student results persist if content is unpublished. Publish every referenced task before publishing a mock; all four skills are required. Configure two separate Writing sections (Tasks 1 and 2) and three Speaking sections (Parts 1–3) for a full-length mock, with suitable IELTS timings. Shorter practice mocks are also supported. Writing aggregation weights Task 2 twice Task 1, and all subjective tasks must be evaluated. Mock timing comes from the referenced tests/tasks; section order is enforced by the database. Complete saved work can be attached by its result ID after interrupted client navigation. Mock overall estimates appear only after all four section bands exist, including teacher-reviewed Speaking. Course completion is an explicit authenticated learner action; it does not claim video-watch verification and awards no XP.

## Security and operational checks

- Run migration/RLS tests, unit tests, lint, typecheck, production build and browser checks before deployment.
- On your staging project verify signup/confirmation, login/logout, email recovery, role routing, private signed media URLs, uploads, objective marking, writing/audio review and consented AI behavior.
- Verify anonymous, other-student and unassigned-teacher access is rejected using real session tokens.
- Verify the production content tables remain empty before administrators author materials.
- Back up the database and Storage; set retention/deletion policies appropriate for student work and provider consent. User deletion is not exposed as a destructive dashboard action; comply with retention requirements through your documented administration process.
- Monitor audit events, provider spending, Supabase quotas and upload storage. Clean expired rate-limit buckets (`window_start < now()-interval '1 day'`) with an operational scheduled task.
- Admin content/user lists use 100 records per page and learner catalogs use 20 per page, with previous/next controls. Histories and teacher lists are bounded to 100; extend those operational lists and parent pickers for larger deployments. Database counts are exact. Hosted provider validation and deployment must be performed with your own credentials; a successful local build is not proof of a deployed service.
