# SQLite deployment and operations

Use Node 24 LTS on a persistent machine. Run `npm ci`, configure `.env`, run `npm run db:setup`, then `npm run build` and `npm start`. Keep the working directory at `ielts-academy`. Route HTTPS through a reverse proxy, set `APP_URL` to its exact origin and `SESSION_COOKIE_SECURE=true`. The proxy must replace untrusted `x-forwarded-for` headers for the authentication rate limiter.

Persist and back up `db/academy.db` and `private-uploads/` together. Stop writes and use SQLite's backup API or stop the application before copying the database; never copy only a live WAL database's main file. Restrict filesystem access to the app's service account. SQLite and local media are intended for a single persistent application deployment; do not deploy this configuration to ephemeral serverless storage or multiple independent replicas.

All accounts are registered by actual users. Bootstrap the first administrator with `npm run db:admin -- email@example.com`. Further privileges and teacher/student assignments are managed through Admin. Passwords use scrypt; cookies expire after seven days, sessions are revoked on logout/password change. Secure cookies require HTTPS. Local email recovery is explicitly unavailable; do not advertise email confirmation or recovery until you implement and validate an email delivery/token flow.

Private files are served only by `/api/local-media`, after session and ownership/reviewer checks. Never mount `private-uploads` as static content. URLs remain usable only while the caller is authenticated and authorized. Both signed-upload and multipart API contracts remain supported; the former now returns a same-origin session-authenticated upload URL. Upload requests are limited to 25 MiB, verified by MIME and file signature, and cannot overwrite existing files.

AI defaults to disabled. Supply an optional server-only `OPENAI_API_KEY`, enable AI in Admin, and require student consent. Default reservations permit five requests per user and 100 platform-wide per UTC day; adjust in Admin and set provider spending limits. Failed calls consume their reservation. Writing feedback is an estimate; speaking transcription feedback does not invent pronunciation or overall bands. Teacher reviews take precedence. Cost estimates cover completion tokens, not all provider charges.

Review audit records and storage usage. Expired session rows and old rate-limit keys can be removed during maintenance. Back up before applying migrations. `db:setup` verifies applied SQL checksums and never resets user data. Production education content starts empty; administrators publish material intentionally. Used tests, questions, subjective tasks and mock structures cannot be changed except publication state.

Run tests, lint, typecheck, build and browser checks before deploying. Validate real browser login and role isolation on the intended HTTPS origin. SQLite local integration tests and a successful build do not establish live OpenAI connectivity.

Historical Supabase deployment notes are retained in [SUPABASE-LEGACY.md](SUPABASE-LEGACY.md). They describe the previous implementation and require an explicit future adapter/data migration; they are not the current deployment instructions.
