# Calendar review imports

PDF, image, and manual inputs now offer two modes before submission:

- **Automatic import** (UI default): analyzed events and detected colors are frozen
  and imported to the authenticated user's primary calendar. No review is required.
- **Review and customize**: analysis saves a draft; a localized readiness email links
  to `/{locale}/jobs/{jobId}/review`. No calendar writes occur before confirmation.

Older API callers that omit `registrationMode` keep review mode. Both start APIs accept
`registrationMode: 'auto' | 'review'` and reject unknown values. The canonical record is
`calendar_imports`; the job status is a UI projection. User edits stay out of the shared
parser cache. The review page defaults to the previous owned calendar or primary,
autosaves after 500 ms, and revalidates ownership before import. Auto mode uses only
primary, so it does not require calendar-list permission. Its retry/status page is read-only.

Color selection shows an actual swatch and a translated color name in both the closed
control and its options, with keyboard navigation and category/individual overrides.
The upload warning opens before the presign request. It blocks duplicate submissions
through file transfer and analysis acceptance, then explains that the browser can close.

New users grant `calendar.events` and `calendar.calendarlist.readonly`. Existing users
can use **Update Google permissions** on the review page, allow calendar access, and
return to the same draft. User edits never go in the shared cache. LINE reminders,
LINE collection searches, and web classification read included confirmed events for
new completed jobs, with shared-cache fallback for older jobs.

## Release

1. Apply `supabase/migrations/20261107123255_calendar_import_review.sql` and
   `supabase/migrations/20261107131554_registration_mode_and_ready_emails.sql` before Lambda
   and Web. These migrations were applied to production project `fsmajfntzicwrfxjqwwz`.
   RLS is enabled; `anon` and `authenticated` cannot access this table or its worker
   functions. The migration is additive and may remain during rollback.
2. Run `npm --prefix lambda ci`, `npx tsc --noEmit -p lambda/tsconfig.json`, and
   `npm --prefix lambda run build:zip`. The ZIP contains code only. Use deployment
   credentials; the invocation-only IAM user cannot update the function.
3. Keep a backup of the currently deployed Lambda ZIP/version using AWS `get-function`
   or the console. Upload `lambda/function.zip` to `gomicale-processor` in
   `ap-northeast-1` using `update-function-code`. Do not replace environment variables
   or deploy the old CDK environment defaults.

   ```sh
   aws lambda update-function-code \
     --function-name gomicale-processor --region ap-northeast-1 \
     --zip-file fileb:///Users/chakiryou/Desktop/gomicale-app/lambda/function.zip \
     --query '{Status:LastUpdateStatus,CodeSha256:CodeSha256}'
   aws lambda wait function-updated-v2 \
     --function-name gomicale-processor --region ap-northeast-1
   aws lambda invoke --function-name gomicale-processor --region ap-northeast-1 \
     --cli-binary-format raw-in-base64-out --payload '{"action":"health"}' \
     /tmp/gomicale-calendar-health.json
   cat /tmp/gomicale-calendar-health.json
   ```

   Expected health result: `{"protocol":"calendar-review-v1","revision":3,"readyEmailConfigured":true,"testSender":false}`. Invoke health only
   after the new code is deployed. Readiness notifications require the existing Resend
   key and a verified sender; the fallback is `noreply@gomicale.jp`. No calendar or email operations occur in health.
   This Lambda also accepts legacy action-less calls from the old Web during rollout.
4. Push Web to `main` only after the worker is ready. Confirm Vercel deployment success
   and the new review route. Do not run customer calendar writes or mail sends as smoke
   tests. For real PDF/color smoke tests, use a valid Gemini API key and test inputs.
5. If rollback is necessary, restore Web to its previous deployment first, then restore
   the backed-up Lambda code. Leave the additional DB structure in place.

## Retries and validation

The confirm API checks ownership, revision, real dates, non-empty names, event/color
IDs, duplicate selected date/name pairs, selected count, time, and time zone. It freezes
one snapshot with a compare-and-swap; edits are refused after that point. Concurrent
workers are excluded by a DB claim. A 16 minute lease outlasts Lambda's maximum runtime.
Writes use deterministic IDs for both inserts and 409 updates, including destination,
color, and time. All-day ends are exclusive and timed ends can cross midnight.

Every 25 successful writes a checkpoint is persisted. Failed writes are errors, never
successes or skips. A retry uses the same frozen content, resumes at the checkpoint,
and safely replays any intervening writes. A worker near its execution deadline releases its lease and dispatches a fresh worker
from the checkpoint, so long registrations continue after the browser closes. A lost/hard-timed-out worker can be retried after lease expiry.
Registration progress and retry are shown on the same review page. Completion and the
job's completed projection commit atomically before mail or LINE codes can be issued.

Validation commands:

```sh
npm run test:calendar-imports
npm run test:admin-emails
npx tsc --noEmit
npx tsc --noEmit -p lambda/tsconfig.json
npm run build
npm --prefix lambda run build:zip
```

Tests mock Google writes and mail. Additional local verification executed the migration
in PGlite (RLS/grants/claim/atomic completion) and used Playwright with isolated mock APIs
for JA/EN mobile layouts, pagination, autosave/restoration, exclusions, time settings,
and confirmation gating. A live sample-image Gemini smoke test could not complete
because the local key returned `API_KEY_INVALID`; mocked parser tests cover valid,
invalid, and absent color output. This does not verify the model's visual accuracy.

## Notification and background dispatch

`calendar_import_tasks` is service-only with RLS and no browser grants. It holds the
immutable readiness email payload, first attempt time, result/provider ID, and a random
per-job dispatch credential. `GET review` exposes only `ready_email_status`, never the
email payload or dispatch token. Analysis completion emails are separate from completion
and failure emails; they do not issue LINE codes.

The readiness email uses a fixed Resend idempotency key per job. Async delivery retries
read the saved payload instead of reparsing or reconstructing mail. Unconfirmed requests
older than the provider's 24-hour window are not resent automatically. Failed delivery
is visible on the review page. Existing completed/ready jobs are not bulk-emailed.

Auto analysis dispatches registration through `POST /api/internal/calendar-imports/dispatch`.
Only the worker's private per-job bearer credential is accepted; the server derives the
owner from the canonical record and requires an already confirmed snapshot. This uses
the existing Web invocation credentials, without adding IAM permission to the Lambda role.
The same route resumes time-limited confirmed imports. Dispatch retries are bounded and
exhaustion becomes an actionable error with the frozen selection preserved.

Revision 3 validation covered both registration modes, preserved behavior for old callers,
readiness mail retry/deduplication, private dispatch credentials, continuation checkpoints,
mobile/English color controls, and upload warnings during a deliberately stalled presign
request. A synthetic readiness email to Resend's test mailbox reached the `delivered`
event. No customer emails or live Google Calendar writes were used for verification.
