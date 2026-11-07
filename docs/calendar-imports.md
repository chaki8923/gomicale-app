# Calendar review imports

All new PDF, image, and manual imports use `analyze → ready → register → completed`.
The job status is a UI projection; `calendar_imports` is the canonical, service-only
record. It contains the original source, editable draft, revision, immutable confirmed
snapshot, worker lease, and registration checkpoint. Shared `parsed_pdfs` entries
contain only parser output and use a `_colors_v1` cache suffix.

The review page is `/{locale}/jobs/{jobId}/review`, reachable from job status and
history. It lists only owned calendars, defaults to the previously selected calendar
(or primary on first use), autosaves after 500 ms, and requires a final confirmation.
The Calendar API validates the chosen calendar again at confirmation and in the worker.
Detected colors are matched with CIELAB / CIE76 distance to Google event colors;
unreadable or monochrome categories stay unspecified. Users can override each color.

New users grant `calendar.events` and `calendar.calendarlist.readonly`. Existing users
can use **Update Google permissions** on the review page, allow calendar access, and
return to the same draft. User edits never go in the shared cache. LINE reminders,
LINE collection searches, and web classification read included confirmed events for
new completed jobs, with shared-cache fallback for older jobs.

## Release

1. Apply `supabase/migrations/20261107123255_calendar_import_review.sql` before Lambda
   and Web. This migration was applied to production project `fsmajfntzicwrfxjqwwz`.
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

   Expected health result: `{"protocol":"calendar-review-v1","revision":2}`. Invoke health only
   after the new code is deployed. No calendar or email operations occur in health.
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
and safely replays any intervening writes. A worker near its execution deadline stops
with a retryable failure. A lost/hard-timed-out worker can be retried after lease expiry.
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
