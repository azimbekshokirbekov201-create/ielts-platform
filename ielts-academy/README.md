# IELTS Academy

A polished, frontend-only IELTS preparation demo built with Next.js App Router, React, TypeScript, Tailwind CSS, Radix/shadcn-style UI primitives, Lucide, Motion, Recharts, React Hook Form, Zod, and Zustand.

## Run locally

Node.js **22 or newer** is required (validated on Node 24.19.0 / npm 11.9.0).

```bash
cd ielts-academy
npm install
npm run dev
```

Open port 3000 in your local browser. No secrets, environment variables, database, or API server are needed. For a reproducible dependency installation, use `npm ci` with the included lockfile. Webpack is explicitly selected because Turbopack's compiler subprocess failed under the managed environment's process restrictions.

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npm start
```

## Explore the demo

The public home page introduces the product and links to the interactive workspace. Go to **Log in** and choose **student**, **teacher**, or **admin** for a ready-made demo. Alternatively, use example details in the login or registration form. Passwords are only validated for the UI: they are never stored or transmitted. Recovery and reset pages are previews and do not send email or change credentials.

| Route | Experience |
| --- | --- |
| `/` | Marketing site, interactive dashboard link, skills, features, courses, pricing previews, FAQ |
| `/login`, `/register` | Validated forms and local role switching |
| `/forgot-password`, `/reset-password` | Explicitly labeled recovery/reset previews |
| `/dashboard` | Personal greeting, illustrative band scores, local goals/history, charts, recommended practice, assignments, recent teacher-demo feedback |
| `/practice/listening` | Four sections, original 31-second synthetic audio, playback/seek/volume, seven questions across six question types, timer, autosave, deterministic results/review |
| `/practice/reading` | Original passage, Academic/General tabs, seven question types, split workspace, highlighting, notes, timer, autosave, answer explanations |
| `/practice/writing` | Academic Task 1 chart, General Training letter, Task 2 essay; formatted editor, word count, focus mode, timer, draft recovery/history, saved submissions |
| `/practice/speaking` | Parts 1–3, cue card/preparation timer, microphone permission/error handling, five-minute recording limit, playback/download, IndexedDB recording history |
| `/mock-exams` | Academic/General guided sample sequence across all four skills, saved responses, completion guards, confirmation, objective results |
| `/courses` | Catalog, category/enrollment filters, course details, 25 text lessons across four courses, understanding checks, persisted enrollment/completion |
| `/progress` | Local practice history and details, course completion, illustrative band/weekly activity and skill breakdown charts |
| `/teacher` | Student/class/assignment/course CRUD, essay review/feedback, local recording playback/feedback, progress previews |
| `/admin` | User/teacher/course/test/question/content CRUD, search, pagination, analytics preview, settings link |
| `/settings` | Display name, persisted light/dark mode, English/Uzbek/Russian navigation, target band, daily intention, JSON progress export |

## Important demo boundaries

- This is an independent educational demonstration, not an official IELTS product, accredited exam, or score prediction.
- **There is no backend, database, production authentication, payment processing, email delivery, or paid AI/speech API.** Role gates are a user-experience feature, not security. Every demo role shares this browser's data.
- Writing and Speaking submissions show **Awaiting evaluation**. Fixed, explicitly opted-in demo feedback does not analyse user content. No overall mock band is calculated without evaluated subjective scores.
- Objective practice contains **seven original questions per skill**, not a full 40-question test. Band estimates use an illustrative percentage mapping documented in `src/lib/grading.ts`; they are not official conversions.
- Academic and General Training share the original objective sample. The mock exam is a shortened sequence with one selected writing task and one saved speaking response, not a full-length exam. Course video placeholders are explicitly unavailable; text lessons and quizzes work.
- Skill/weekly trend charts and prefilled dashboard band scores are clearly labeled **sample data**. Actual completed practice and course progress are separate. Marking daily intentions is a self-reported checklist, not an activity measurement.
- Teacher/admin CRUD edits persist local workspace records. They do not publish new live courses or tests to the learner catalog. The catalog and practice library are bundled source content.
- Navigation, dashboard headings, and core preferences support English, Uzbek, and Russian. Detailed interface copy, practice material, and lessons are in English; this is not exhaustive localization.
- Session metadata, answers, drafts, timers, goals, feedback, and results are in `localStorage` (`ielts-academy-v1`). Recordings are in IndexedDB (`ielts-academy-recordings`). No cross-device syncing occurs. Clearing browser data deletes this local state. Export JSON in Settings and download audio separately to keep a copy.
- Microphone recording requires a supported browser, explicit permission, and HTTPS or localhost. Recording was tested in Chromium with a synthetic browser microphone. Real hardware and Safari/Firefox have not been verified here.
- Browser highlighting uses pointer text selection; mobile users can save notes instead. The formatting toolbar uses `document.execCommand` as a simple browser-native demo editor; a production integration should use a maintained editor package.

## Architecture and integration points

```text
src/
  app/                 App Router pages, metadata, errors, icon, route validation
  components/
    ui/                Button variants, input, card, badge, progress, modal/dialog,
                       tooltip, tabs, pagination, empty/error/loading states, toast
    layout/            Sidebar, topbar, breadcrumbs, language menu, search, inbox
    charts/            Responsive Recharts visualizations
    listening/         Audio playback controls
    speaking/          Teacher recording review
  features/            Landing, auth, dashboard, practice, writing, speaking,
                       mock exams, courses, progress, role workspaces, settings
  data/                Original content, sample records, interface translations
  hooks/               Hydration readiness
  lib/                 Pure grading/word count, IndexedDB adapter, class utilities
  store/               Typed Zustand state, versioned local persistence
  types/               Role, skill, question, attempt, record contracts
  styles/              Shared tokens, visual system, dark mode, responsive layouts
public/audio/          Original synthetic listening sample and attribution
public/images/         Original brand asset
scripts/               Reproducible audio generation and source packaging
tests/                Unit, functional, responsive, and accessibility checks
```

Replace the local state actions with authenticated service/repository adapters for future backend work. Keep deterministic grading server authoritative in production. Implement secure server sessions, role authorization, storage policies, evaluation services, and consent handling before using real user data. Never put secret API keys in client bundles.

Typography is self-hosted from Fontsource (DM Sans and Instrument Serif), with no runtime Google Fonts request. Illustrations are original CSS/SVG compositions. UI primitives follow shadcn conventions using Radix, class-variance-authority, `cn`, and the included `components.json`.

## Browser tests

```bash
# If a compatible Chromium is installed, point to it:
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e

# On a machine without Chromium:
npx playwright install chromium
# Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to that installed browser's executable,
# or remove executablePath in playwright.config.ts to use Playwright's default.
```

The suite starts the dev server automatically if port 3000 is available and reuses an existing one outside CI. Tests cover landing, forms, role sessions, answer persistence/grading, original audio playback, writing recovery, recording and denied permission, course completion, teacher/admin CRUD, theme/language/goals, mock sequencing, and page overflow/mobile navigation at **320, 375, 430, 768, 1024, 1440, and 1920 px**. Eight representative pages and the dark dashboard are scanned with axe for WCAG A/AA rules (decorative elements explicitly marked `aria-hidden` are excluded). Automated checks do not constitute a full accessibility certification or cross-browser audit.

## Rebuild the listening sample

The checked-in WAV needs no runtime synthesis. If FFmpeg includes its `flite` source filter:

```bash
node scripts/generate-audio.mjs
```

The script uses only the original `listeningScript` text. No copyrighted exam recording or network speech service is used.

## Package the source

```bash
python3 scripts/package.py
```

This creates `../ielts-academy-frontend.zip` with an `ielts-academy/` root, source/config/lockfile, tests, fonts' package declarations, and public assets. It excludes `node_modules`, `.next`, Git metadata, secrets, test output, and temporary files. Installation requires access to the npm registry.
