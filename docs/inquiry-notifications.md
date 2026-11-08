# Feedback email notifications

New feedback posts notify `konkuriitonouenokareha128@gmail.com`. A saved administrator reply notifies only the post author's verified sign-in email. Replies use the original post's Japanese/English locale. The email contains the post, reply when relevant, and a dashboard link that opens the conversation. Existing posts and replies are not backfilled.

Server settings: existing `RESEND_API_KEY`, `APP_FROM_EMAIL` (verified domain), `APP_URL`. Optional `INQUIRY_NOTIFICATION_EMAIL` overrides the operator inbox; its default is the address above. The private operator inbox is not exposed in notifications sent to authors. Operators should reply from the dashboard.

Apply the `inquiry_email_notifications` migration before deploying the Web app. It adds a server-only RLS-protected outbox. Database insert triggers enqueue posts/replies atomically, including inserts from older browser clients. No notification addresses or provider details are exposed to the browser. Account/post/reply deletion cascades to their outbox records, and workers check account activity before sending.

`POST /api/inquiries` and `POST /api/inquiries/{postId}/replies` authenticate the caller, enforce administrator permission for replies, reject cross-site writes and accept only `{id,content,locale}`. Reuse a submission UUID when retrying the same content. Conflicting UUIDs return 409. Saved content is returned immediately; Next.js `after` dispatches the corresponding notification. Daily `/api/cron/line-reminder` retries up to ten due notifications, including those from older clients. A failed email never changes a successfully saved post/reply into a failed submission.

Workers claim a 90-second database lease. Before contacting Resend, they persist the exact sender, recipient and text payload, with a fixed `inquiry/{notificationId}` idempotency key. Concurrent submissions and retry requests therefore do not create duplicate mail. Ambiguous deliveries older than 23 hours are marked `review_required` because [Resend retains keys for 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys). Do not automatically reset these records: check the provider's delivery logs before any manual resend. `sent` means Resend accepted the message, not proof of inbox delivery.

Operational inspection (server role only):

```sql
select id, kind, status, attempts, last_error_code, resend_id, created_at
from public.inquiry_notifications
where status <> 'sent'
order by created_at desc;
```

`npm run test:inquiry-notifications` covers HTTP permissions/input, replay/conflict, localized recipients, safe text, leases, provider failure, fixed-payload retry, expiry, withdrawal, database grants/RLS, old-client inserts, rollback and cascades. Provider calls are mocked. Do not send verification messages to real users or the operator inbox.
