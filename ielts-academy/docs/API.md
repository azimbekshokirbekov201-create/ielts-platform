# API and authorization

All routes live under `/api`. Success is `{data: ...}`; failures are `{error: stable_code}` without private database or provider errors. Every non-public route verifies the Supabase user server-side. All mutations require a matching Origin header and use a shared per-user rate limit. Auth uses a separate ingress-IP hash limit. Database policies protect direct SDK access as well.

| Endpoint | Method | Behavior |
|---|---|---|
| `/auth/register`, `/auth/login` | POST | Email/password, name on signup; no role selection |
| `/auth/forgot`, `/auth/reset`, `/auth/logout` | POST | Recovery, authenticated password change, session revocation |
| `/me` | GET | Verified identity, database roles/preferences/onboarding and destination |
| `/preferences` | PATCH | Language, theme and explicit AI consent |
| `/onboarding` | PATCH | `{answers,finish}`; validated partial save and idempotent completion |
| `/catalog/:table` | GET | Published course/test/task/mock/lesson catalog, `page` pagination |
| `/test/:id`, `/course/:id` | GET | Policy-filtered hierarchy; never answer keys |
| `/attempts` | POST/GET | Start/resume test or list authorized history |
| `/attempts/:id` | GET/PATCH | Resume answers, or autosave `{answers:{question_uuid:answer}}` |
| `/attempts/:id/submit` | POST | Locked, idempotent server marking |
| `/writing` | POST | `{task_id,submission_id?,body?,finish?}`; send returned submission ID for every retry/save |
| `/media-upload`, `/media-finalize`, `/media-url` | POST | Authorized direct upload, signature validation/metadata finalization, five-minute signed read URL. `/media` also supports small multipart uploads. |
| `/speaking` | POST | Attach owned upload `{task_id,path}`; private recording and activity |
| `/enroll`, `/complete` | POST | Enroll in course or record authenticated lesson completion |
| `/dashboard`, `/submissions`, `/mock-results` | GET | Genuine authorized activity, evaluations and mock aggregates |
| `/mock` | POST | `{exam_id}` starts/resumes according to exam policy |
| `/mock/:id` | GET/PATCH | GET uses exam ID for definition; PATCH uses attempt ID to link `{section_id,result_id}` |
| `/review` | POST | Assigned teacher/admin rubric evaluation, with audited override |
| `/ai` | POST | Consent/quota-checked optional evaluation `{kind,id}` |
| `/teacher/students`, `/teacher/assignments` | GET | Assigned student profiles and assignments |
| `/teacher/assignments` | POST | Assign one published lesson/test/writing/speaking task |
| `/admin/content/:table[/:id]` | GET/POST/PATCH/DELETE | Validated allowlisted CMS; draft creation and publication validation |
| `/admin/users`, `/admin/stats`, `/admin/audit` | GET | Real profiles/roles, counts, audited events |
| `/admin/roles`, `/admin/assign-teacher` | POST | Admin-only role grants/revocations or teacher/student relationship |
| `/admin/settings` | GET/PATCH | Enable AI and configure global/per-user daily caps |

The Zod schemas in `src/server/validation.ts` define CMS payloads. PostgreSQL is authoritative for foreign keys, ownership, deadlines, scoring, publication, role changes, quotas and idempotency. Private answer keys have no student read policy, even after submission. Review reveals scores and feedback, not a public key dump.
