-- This row deliberately outlives auth.users so failed cleanup can be resumed.
create table public.account_deletion_requests (
  user_id uuid primary key,
  operation_id uuid not null unique default gen_random_uuid(),
  stage text not null default 'files' check (stage in ('files','google','auth','cache','cleanup')),
  pdf_hashes text[] not null default '{}',
  lease_token uuid,
  lease_until timestamptz,
  cleanup_after timestamptz not null default now() + interval '24 hours',
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant select, insert, update, delete on public.account_deletion_requests to service_role;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, service_role;

-- A deleted user's unexpired JWT must not keep granting Data API access.
create function app_private.active_session_account() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id=(select auth.uid()))
    and not exists(select 1 from public.account_deletion_requests where user_id=(select auth.uid()));
$$;
revoke all on function app_private.active_session_account() from public, anon;
grant execute on function app_private.active_session_account() to authenticated;

create function public.account_is_active(p_user_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from auth.users where id=p_user_id)
    and not exists(select 1 from public.account_deletion_requests where user_id=p_user_id);
$$;
revoke all on function public.account_is_active(uuid) from public, anon, authenticated;
grant execute on function public.account_is_active(uuid) to service_role;

-- Every job start/edit and deletion uses the same per-user transaction lock.
-- Triggers cover both old web versions and privileged background writers.
create function app_private.guard_account_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  for u in select distinct (to_jsonb(new)->>v)::uuid from unnest(TG_ARGV) v
    where to_jsonb(new)->>v is not null order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(u::text,0));
    if not exists(select 1 from auth.users where id=u)
       or exists(select 1 from public.account_deletion_requests where user_id=u) then
      raise exception 'ACCOUNT_DELETING' using errcode='P0001';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function app_private.guard_account_write() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['jobs','calendar_imports','user_integrations','line_links','line_link_codes',
    'gemini_usage_limits','user_streaks','inquiry_posts','inquiry_reply_reads','api_keys'] loop
    execute format('create trigger account_write_guard before insert or update on public.%I for each row execute function app_private.guard_account_write(''user_id'')',t);
  end loop;
  create trigger account_write_guard before insert or update on public.inquiry_replies
    for each row execute function app_private.guard_account_write('admin_user_id');
  create trigger account_write_guard before insert or update on public.admin_error_emails
    for each row execute function app_private.guard_account_write('admin_user_id','recipient_user_id');
  for t in select distinct tablename from pg_policies where schemaname='public' loop
    execute format('create policy account_must_be_active on public.%I as restrictive for all to authenticated using ((select app_private.active_session_account())) with check ((select app_private.active_session_account()))',t);
  end loop;
end;
$$;

-- Pending uploads expire: abandoned presigned URLs must not block withdrawal forever.
-- The late-object cleanup below also covers uploads finishing after URL expiration.
create function public.account_deletion_blockers(p_user_id uuid)
returns table(id uuid, title text, status text) language sql stable security invoker set search_path = '' as $$
  select j.id,j.pdf_title,j.status::text from public.jobs j
  left join public.calendar_imports c on c.job_id=j.id
  where j.user_id=p_user_id and (j.status='processing'
    or (j.status='pending' and j.created_at>now()-interval '15 minutes')
    or c.state in ('analyzing','registering') or c.lease_until>now());
$$;
revoke all on function public.account_deletion_blockers(uuid) from public, anon, authenticated;
grant execute on function public.account_deletion_blockers(uuid) to service_role;

create function public.begin_account_deletion(p_user_id uuid,p_token uuid)
returns setof public.account_deletion_requests language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  if not exists(select 1 from public.account_deletion_requests where user_id=p_user_id) then
    if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'ACCOUNT_MISSING'; end if;
    if exists(select 1 from public.account_deletion_blockers(p_user_id)) then raise exception 'ACTIVE_JOBS'; end if;
    insert into public.account_deletion_requests(user_id,pdf_hashes)
      select p_user_id,coalesce(array_agg(distinct pdf_hash) filter(where pdf_hash is not null),'{}')
      from public.jobs where user_id=p_user_id;
  end if;
  return query update public.account_deletion_requests set lease_token=p_token,
    lease_until=now()+interval '2 minutes',updated_at=now()
    where user_id=p_user_id and (lease_until is null or lease_until<now()) returning *;
end;
$$;
revoke all on function public.begin_account_deletion(uuid,uuid) from public, anon, authenticated;
grant execute on function public.begin_account_deletion(uuid,uuid) to service_role;

-- Forget only caches with no remaining job referring to the same source hash.
create function public.cleanup_deleted_account_cache(p_user_id uuid,p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare h text;
begin
  if not exists(select 1 from public.account_deletion_requests where user_id=p_user_id
    and lease_token=p_token and stage in ('cache','cleanup')) then return false; end if;
  for h in select unnest(pdf_hashes) from public.account_deletion_requests where user_id=p_user_id loop
    if h ~ '^[0-9a-f]{64}$' then
      delete from public.parsed_pdfs p where (p.pdf_hash=h or left(p.pdf_hash,65)=h||'_')
        and not exists(select 1 from public.jobs j where j.pdf_hash=h);
    end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.cleanup_deleted_account_cache(uuid,uuid) from public, anon, authenticated;
grant execute on function public.cleanup_deleted_account_cache(uuid,uuid) to service_role;

-- A delayed Stripe webhook must still record payment, without resurrecting identity.
create function app_private.detach_deleted_payment_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
    if not exists(select 1 from auth.users where id=new.user_id)
      or exists(select 1 from public.account_deletion_requests where user_id=new.user_id) then
      new.user_id:=null;
    end if;
  end if;
  if new.job_id is not null and (new.user_id is null or not exists(select 1 from public.jobs where id=new.job_id and user_id=new.user_id)) then
    new.job_id:=null;
  end if;
  return new;
end;
$$;
revoke all on function app_private.detach_deleted_payment_identity() from public, anon, authenticated;
create trigger detach_deleted_identity before insert or update on public.support_payments
  for each row execute function app_private.detach_deleted_payment_identity();
create trigger detach_deleted_identity before insert or update on public.revenue_events
  for each row execute function app_private.detach_deleted_payment_identity();
