-- Manual follow-up only. Automatic Lambda notifications remain separate.
create table public.admin_error_emails (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  from_email text not null,
  job_ids uuid[] not null check (cardinality(job_ids) between 1 and 50),
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 10000),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed', 'unknown')),
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (operation_id, recipient_user_id)
);

create index admin_error_emails_recipient_created_idx
  on public.admin_error_emails (recipient_user_id, created_at desc, id desc);
create index jobs_error_updated_idx
  on public.jobs (updated_at desc, id desc) where status = 'error';

alter table public.admin_error_emails enable row level security;
-- No browser policies: even admins go through the authenticated server endpoints.
revoke all on public.admin_error_emails from public, anon, authenticated;
grant select, insert, update on public.admin_error_emails to service_role;

create view public.latest_admin_error_emails with (security_invoker = true) as
  select distinct on (recipient_user_id) *
  from public.admin_error_emails
  order by recipient_user_id, created_at desc, id desc;

revoke all on public.latest_admin_error_emails from public, anon, authenticated;
grant select on public.latest_admin_error_emails to service_role;
