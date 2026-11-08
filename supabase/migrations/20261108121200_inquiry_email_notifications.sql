-- Only new inserts enqueue notifications; historical feedback is not emailed.
alter table public.inquiry_posts add column locale text not null default 'ja'
  check (locale in ('ja', 'en'));

create table public.inquiry_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('post', 'reply')),
  post_id uuid not null references public.inquiry_posts(id) on delete cascade,
  reply_id uuid unique references public.inquiry_replies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sent','skipped','review_required')),
  payload jsonb,
  attempts integer not null default 0,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  resend_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'post' and reply_id is null) or (kind = 'reply' and reply_id is not null))
);
create unique index inquiry_notifications_post_once on public.inquiry_notifications(post_id) where kind = 'post';
create index inquiry_notifications_user on public.inquiry_notifications(user_id);
create index inquiry_notifications_due on public.inquiry_notifications(next_attempt_at,created_at) where status = 'pending';
create index inquiry_notifications_post on public.inquiry_notifications(post_id);
alter table public.inquiry_notifications enable row level security;
revoke all on public.inquiry_notifications from public, anon, authenticated;
grant select, insert, update, delete on public.inquiry_notifications to service_role;

create schema if not exists app_private;
create function app_private.enqueue_inquiry_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'inquiry_posts' then
    insert into public.inquiry_notifications(kind,post_id,user_id) values('post',new.id,new.user_id);
  else
    insert into public.inquiry_notifications(kind,post_id,reply_id,user_id)
      select 'reply',new.post_id,new.id,p.user_id from public.inquiry_posts p where p.id = new.post_id;
  end if;
  return new;
end;
$$;
revoke all on function app_private.enqueue_inquiry_notification() from public, anon, authenticated;
create trigger enqueue_notification after insert on public.inquiry_posts
  for each row execute function app_private.enqueue_inquiry_notification();
create trigger enqueue_notification after insert on public.inquiry_replies
  for each row execute function app_private.enqueue_inquiry_notification();

-- Lease one notification so overlapping HTTP retries and Cron cannot send concurrently.
create function public.claim_inquiry_notification(p_token uuid, p_notification_id uuid default null)
returns setof public.inquiry_notifications language sql security invoker set search_path = '' as $$
  with candidate as (
    select id from public.inquiry_notifications
    where status = 'pending' and next_attempt_at <= now()
      and (lease_until is null or lease_until < now())
      and (p_notification_id is null or id = p_notification_id)
    order by created_at limit 1 for update skip locked
  )
  update public.inquiry_notifications n set lease_token = p_token,
    lease_until = now() + interval '90 seconds', attempts = attempts + 1
  from candidate c where n.id = c.id returning n.*;
$$;
revoke all on function public.claim_inquiry_notification(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_inquiry_notification(uuid,uuid) to service_role;
