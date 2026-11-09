# IELTS Academy

The Next.js frontend and backend live together in [`ielts-academy/`](ielts-academy/README.md). Local development uses SQLite with Prisma and optional OpenAI feedback. Supabase is not required.

Windows CMD:

```bat
cd ielts-academy
npm ci
copy .env.example .env
npm run db:setup
npm run dev
```

See the [application README](ielts-academy/README.md) for real account registration, first-admin setup, migrations and tests. SQLite data stays at `ielts-academy/db/academy.db`; private uploads and databases are excluded from Git. Historical Supabase migrations are retained for future migration work.
