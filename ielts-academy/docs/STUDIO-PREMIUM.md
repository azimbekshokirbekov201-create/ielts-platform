# Content Studio, subscriptions and promo codes

This upgrade keeps the premium design and the existing SQLite account, session, grading and progress services. Existing content without an `access_tier` remains free. Roles do not come from browser storage. Every registered user still has the Student role; administrators grant Teacher privileges through the existing Users panel.

## Windows update

Use Node 24 LTS. From the existing `ielts-academy` directory, stop the app, pull the update, and run:

```bat
npm run db:setup
npm run dev
```

No dependency reinstall is required for this upgrade. `db:setup` first creates a timestamped `.backup-....db` beside an existing database, then applies additive indexes from `prisma/migrations/202611090002_studio`. It never resets accounts, roles, sessions, results, content or media. Applied SQL checksums remain enforced. The upgrade was tested on temporary databases; the user's current database was deliberately left untouched.

The existing Entity model durably stores content access tiers, creator ownership, upload metadata/attachments, subscriptions, promo codes, redemptions and audit events. New indexes cover promo digests, subscriber IDs and content creators. A separate schema reset or educational seed is not used.

## Admin and Teacher content

Register and bootstrap the first real administrator only if none exists:

```bat
npm run db:admin -- your-existing-account@example.com
```

Existing administrators use their usual login. Grant Teacher through Admin → Users. Teachers see Content Studio alongside their assigned-student review tools. They can create and edit their own content hierarchy; they cannot change another author's content or administer subscriptions. Administrators manage all content. Historical content without a creator remains administrator-managed.

1. Open Admin or Teacher → Content management. Select Listening, Reading, Writing or Speaking, then **+ Add Test**.
2. Enter the title, timing and instructions; choose Free or Premium, then Save a draft. Writing supports Tasks 1/2, suggested word counts and chart images. Speaking supports Parts 1–3, preparation/response timings and optional attachments.
3. For Listening/Reading, use the Content management selector to add Test sections and choose the newly created test by title. Add passages, questions, options and private answer keys with accepted alternatives. Sections serve as question groups. Supported question types include choice, multiple choice, gap/text answers, matching, true/false/not-given and yes/no/not-given. Numeric positions control order.
4. Select Edit on a saved draft to resume. Valid edits autosave after a short pause; invalid or incomplete edits report their save state. New records require the initial Save so mandatory parent relationships can be established.
5. Use Preview, Publish/Unpublish, Duplicate, search/status filters or confirmed Delete. Duplication creates a draft copy of the full content hierarchy, including new question/key relationships; it does not copy student attempts or grades. Every objective question requires a private key before publication. Assessment content used in attempts remains frozen; access tier and publication state can change without altering earned grades.

Rich-text tools support bold and italic formatting, stored as plain Markdown and rendered through safe React text nodes. Raw HTML/scripts are never rendered.

## Files and YouTube lessons

File fields accept drag/drop or **Browse Files**, display name/size and upload progress, and associate the returned private path automatically. Existing URL/path entry remains optional for compatibility. Each upload is limited to 25 MiB and checked on the server for allowed MIME and file signature. Paths use generated filenames, cannot traverse directories and cannot overwrite existing files. Uploaded file metadata includes MIME, size, owner and original name.

Use lesson resources for PDFs, passage attachments for Reading PDFs/images, section audio for Listening, Writing images and optional Speaking attachments. Preview opens the authenticated file. Uploading a replacement changes the reference. Remove attachment clears the form reference and requests deletion of unused owned files. Files still referenced by content are retained and return a clear in-use message; save reference changes first. Student recordings and their history are never deleted by the course-media removal endpoint.

Create a course, module and lesson through the same selector. In a lesson's Video URL field, enter an HTTPS `youtube.com/watch?v=...`, `youtu.be/...` or `/shorts/...` link, or upload an MP4. Only validated 11-character YouTube IDs produce an iframe, using `www.youtube-nocookie.com`; arbitrary iframe hosts are rejected. The player is responsive, sandboxed and has a loading state. Completion continues through the existing enrollment/progress APIs.

YouTube is externally hosted: embedding does not turn public YouTube content into private encrypted media, and a video's owner may disable embedding. Private uploaded media is protected by server sessions, content access and author/reviewer permissions.

## Promo and subscription management

Admin → **Subscriptions** shows active/expired/revoked grants, searchable subscriber history, activation/expiration dates, promo usage and redemption history.

- Generate a cryptographically random code or enter a custom code (8–64 letters/digits/hyphens). Choose a duration in days (7, 30, 90, 180, 365 or any custom integer up to 3650), redemption limit and optional expiration.
- Copy the resulting code immediately: plaintext is returned only on creation. Listings do not return plaintext or lookup digests.
- Enable/disable or permanently revoke a code. Revoking a code stops future redemptions; already issued grants remain until their own expiration/revocation.
- Select a registered user and duration for manual activation. Revoke an individual grant with confirmation.

Students open Settings → Premium access, enter a code and activate it. Locked catalog cards also link to this screen. Current tier, activation, expiration and remaining days come from the server. Reload a catalog after activation. Expiration/revocation is enforced at content/media APIs and premium actions, while earned results, progress and submissions remain readable.

Grants stack: a new grant begins extending access from the latest non-revoked expiration, or now if none is active. Each grant has its own expiration. Revoking one grant does not rewrite another grant's already assigned expiration. This rule is tested.

Promo codes use uppercase normalization and HMAC-SHA256 lookup digests. A random signing key is created locally at `private-uploads/.promo-key`, with private permissions, and is never served by the media route. Back up this key and private uploads with the database. Losing or replacing it makes existing promo codes unresolvable. No new environment secret is required.

Redemption has a separate per-user rate limit. A SQLite write lock is taken before quota checks; deterministic redemption identities and a unique promo-digest index provide additional protection. Concurrent callers cannot exceed limits or redeem the same code twice. Audit records track creation, grants, changes and revocations.

## Future Click/Payme integration

`src/server/subscriptions.ts` defines provider/order contracts and a central `grant` service. No payment success or paid order is simulated, and no live checkout is exposed. Before enabling payments:

1. Obtain actual merchant/service identifiers and the appropriate signing/API secrets in the provider's merchant account; store them only on the server.
2. Implement the provider's documented request signatures, callback verification, amount/currency checks and transaction state machine in a concrete PaymentProvider adapter.
3. Persist server-priced pending orders and uniquely indexed provider transaction IDs. Verify callbacks over the raw request, reconcile provider state, and settle each order idempotently in the same transaction as subscription activation.
4. Validate the complete sandbox flow, duplicate/out-of-order callbacks, cancellations and refund/revocation policy before switching production credentials.

No Click, Payme or OpenAI credentials are included. Optional AI and the pre-existing unconfigured email-recovery limitation remain unchanged.

## Validation

Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`, then `npm run test:local` against the built app. Tests use disposable data and never seed the development database. The exact changed-file inventory is [STUDIO-CHANGED-FILES.txt](STUDIO-CHANGED-FILES.txt).
