# Premium frontend restoration

Visual reference: [`1920722e6d9db03075f1c5f773cd865f6833a32d`](https://github.com/azimbekshokirbekov201-create/ielts-platform/commit/1920722e6d9db03075f1c5f773cd865f6833a32d).
Backend baseline: [`3a7bd58091543cef3a0e7f8714db63fad19ed79b`](https://github.com/azimbekshokirbekov201-create/ielts-platform/commit/3a7bd58091543cef3a0e7f8714db63fad19ed79b).

The original page components, Shell, artwork, typography, colors and responsive styles have been reconnected to the existing API. The repository was not reverted and no new project was created.

| Original composition | Current connection |
|---|---|
| `platform.tsx` and Shell | Explicit page routing inside the API-backed account provider; original sidebar, topbar, search dialog, mobile navigation and role links |
| Marketing | Original illustrated hero, workspace preview, skill cards, course artwork and plan layout; current account links and truthful product copy |
| Authentication | Original split-screen brand panel and artwork with the existing secure registration/login/reset forms and password visibility control |
| Dashboard | Original illustrated welcome card, metric grid, skill cards, chart and two-column learning layout; actual identity, onboarding targets, grades, course counts and assignments |
| Courses | Original illustrated catalog cards, course outline and lesson viewer; published content, real enrollment and saved completion |
| Practice, Writing, Speaking, mocks | Original card covers and prompt/editor/recording layouts around the existing API autosave, timers, grading, private uploads and mock flow |
| Progress and Settings | Original card/grid treatment, real score history, account profile, language/theme preferences and AI consent |
| Teacher/Admin | Original Shell around the complete existing live content studio, role controls, assignments and review tools |

The old browser-only session store and sample exercise/result sources are not used by active screens. Role selection and fabricated dashboard scores were not restored. Empty accounts display empty states; charts show stored grades. Static navigation translations are retained from the original interface.

The SQLite server, API routes, Prisma schema and migration files are unchanged from the backend baseline. Browser/API tests use temporary databases or explicit fixtures. A read-only logical comparison confirmed that `db/academy.db` matches its pre-restoration snapshot; neither it nor private uploads were reset or deleted.

Validation on 2026-11-09:

- TypeScript, ESLint and production build passed.
- 39 unit/SQLite integration tests passed; 19 historical PostgreSQL tests remain intentionally skipped.
- 22 browser tests passed, including four accessibility scans, 320/375/768/1440px layouts, original composition checks, mobile sidebar/search, preference API writes, actual-grade rendering and the live Admin controls.
- The real SQLite production-browser smoke passed registration, onboarding, course/lesson completion, grading, Writing/Speaking submissions, private audio permissions, logout/login and persistence after server restart.
- Desktop dashboard, dark theme, split-screen authentication and mobile screenshots were produced by the browser suite; dashboard/auth/mobile screenshots were visually inspected.

Screenshots and test databases remain ignored artifacts. The existing local email-recovery limitation and optional OpenAI configuration are unchanged; see README.md.
