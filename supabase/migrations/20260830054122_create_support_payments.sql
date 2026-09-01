-- ============================================================
-- 開発支援決済と収益導線イベント
-- ============================================================

create table if not exists public.support_payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  job_id            uuid references public.jobs(id) on delete set null,
  stripe_session_id text not null unique,
  amount            integer not null check (amount > 0),
  currency          text not null default 'jpy' check (char_length(currency) = 3),
  status            text not null default 'pending'
                    check (status in ('pending', 'paid', 'failed', 'refunded')),
  source            text not null default 'donate_page'
                    check (source in ('donate_page', 'job_completed', 'classification_milestone')),
  locale            text not null default 'ja' check (locale in ('ja', 'en')),
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);

create index if not exists idx_support_payments_user_paid
  on public.support_payments (user_id, paid_at desc)
  where status = 'paid';

alter table public.support_payments enable row level security;

create policy "support_payments: select own"
  on public.support_payments for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.support_payments from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.support_payments from authenticated;
grant select on public.support_payments to authenticated;
grant all on public.support_payments to service_role;

create table if not exists public.revenue_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  job_id            uuid references public.jobs(id) on delete set null,
  stripe_session_id text,
  event_name        text not null
                    check (event_name in (
                      'support_cta_impression',
                      'support_cta_click',
                      'support_cta_dismissed',
                      'checkout_created',
                      'payment_completed',
                      'payment_failed'
                    )),
  source            text not null
                    check (source in ('donate_page', 'job_completed', 'classification_milestone')),
  amount            integer check (amount is null or amount > 0),
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists idx_revenue_events_source_created
  on public.revenue_events (source, created_at desc);

create unique index if not exists idx_revenue_events_payment_session
  on public.revenue_events (event_name, stripe_session_id)
  where stripe_session_id is not null
    and event_name in ('payment_completed', 'payment_failed');

alter table public.revenue_events enable row level security;

-- ブラウザからは直接アクセスさせず、検証済みのサーバーAPIだけが記録する。
revoke all on public.revenue_events from anon, authenticated;
grant all on public.revenue_events to service_role;
