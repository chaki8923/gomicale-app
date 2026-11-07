-- Additive migration: older web and Lambda versions continue to work.
alter type public.job_status add value if not exists 'awaiting_confirmation';
alter table public.user_integrations add column if not exists selected_calendar_id text;
create table public.calendar_imports (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'analyzing' check (state in ('analyzing','ready','registering','completed','error')),
  revision integer not null default 0 check (revision >= 0),
  source_events jsonb not null default '[]'::jsonb check (jsonb_typeof(source_events) = 'array'),
  draft jsonb not null,
  confirmed jsonb,
  language text not null check (language in ('ja','en')),
  lease_token uuid,
  lease_until timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (state not in ('registering','completed') or confirmed is not null)
);
create index calendar_imports_user_id_idx on public.calendar_imports(user_id);
alter table public.calendar_imports enable row level security;
revoke all on public.calendar_imports from public, anon, authenticated;
grant select, insert, update, delete on public.calendar_imports to service_role;
create trigger calendar_imports_updated_at before update on public.calendar_imports
for each row execute function public.handle_updated_at();
-- A worker claim excludes concurrent async deliveries. Expired claims can be retried
-- with exactly the same confirmed snapshot and deterministic Google event IDs.
create function public.claim_calendar_import(p_job_id uuid, p_user_id uuid, p_token uuid)
returns setof public.calendar_imports language sql security invoker set search_path = '' as $$
  update public.calendar_imports set lease_token=p_token, lease_until=now()+interval '16 minutes', error=null
  where job_id=p_job_id and user_id=p_user_id and state='registering'
    and (lease_until is null or lease_until < now()) returning *;
$$;
revoke all on function public.claim_calendar_import(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_calendar_import(uuid,uuid,uuid) to service_role;
alter table public.calendar_imports add column registered_count integer not null default 0 check (registered_count >= 0);
create function public.finish_calendar_import(p_job_id uuid, p_token uuid, p_count integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.calendar_imports set state='completed', registered_count=p_count, lease_token=null, lease_until=null, error=null
    where job_id=p_job_id and state='registering' and lease_token=p_token;
  if not found then return false; end if;
  update public.jobs set status='completed', error_message=null,
    result_data=jsonb_build_object('calendar_event_count',p_count,'skipped_count',0,'review_available',true,'pdf_hash',pdf_hash)
    where id=p_job_id;
  return true;
end;
$$;
revoke all on function public.finish_calendar_import(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.finish_calendar_import(uuid,uuid,integer) to service_role;
create function public.prepare_calendar_review(p_job_id uuid, p_user_id uuid, p_events jsonb, p_hash text, p_title text, p_mode text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.calendar_imports set state='ready', source_events=p_events,
    draft=jsonb_set(draft,'{events}',p_events), error=null
    where job_id=p_job_id and user_id=p_user_id and state='analyzing';
  if not found then return false; end if;
  update public.jobs set status='awaiting_confirmation',pdf_hash=p_hash,pdf_title=p_title,
    parser_mode=p_mode,result_data=jsonb_build_object('review_available',true)
    where id=p_job_id and user_id=p_user_id;
  if not found then raise exception 'Job ownership mismatch'; end if;
  return true;
end;
$$;
revoke all on function public.prepare_calendar_review(uuid,uuid,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.prepare_calendar_review(uuid,uuid,jsonb,text,text,text) to service_role;
