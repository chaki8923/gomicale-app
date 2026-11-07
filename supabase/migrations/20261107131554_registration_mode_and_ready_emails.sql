alter table public.calendar_imports add column registration_mode text not null default 'review'
  check (registration_mode in ('auto','review'));
-- Private delivery data and per-job dispatch credentials never enter browser-facing rows.
create table public.calendar_import_tasks (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  dispatch_token uuid not null default gen_random_uuid(),
  dispatch_attempts integer not null default 0 check (dispatch_attempts >= 0),
  email_payload jsonb,
  email_status text not null default 'pending' check (email_status in ('pending','sent','failed')),
  email_first_attempt_at timestamptz,
  email_sent_at timestamptz,
  email_provider_id text,
  email_error_code text,
  created_at timestamptz not null default now()
);
alter table public.calendar_import_tasks enable row level security;
revoke all on public.calendar_import_tasks from public, anon, authenticated;
grant select,insert,update,delete on public.calendar_import_tasks to service_role;
create or replace function public.prepare_calendar_review(p_job_id uuid, p_user_id uuid, p_events jsonb, p_hash text, p_title text, p_mode text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_mode text;
  v_draft jsonb;
begin
  select registration_mode,jsonb_set(draft,'{events}',p_events) into v_mode,v_draft
    from public.calendar_imports where job_id=p_job_id and user_id=p_user_id and state='analyzing' for update;
  if not found then return false; end if;
  if v_mode='auto' then v_draft=jsonb_set(v_draft,'{calendarId}','"primary"'::jsonb); end if;
  update public.calendar_imports set state=case when v_mode='auto' then 'registering' else 'ready' end,
    source_events=p_events,draft=v_draft,confirmed=case when v_mode='auto' then v_draft else null end,error=null
    where job_id=p_job_id and user_id=p_user_id;
  insert into public.calendar_import_tasks(job_id) values(p_job_id) on conflict(job_id) do nothing;
  update public.jobs set status=case when v_mode='auto' then 'processing'::public.job_status else 'awaiting_confirmation'::public.job_status end,
    pdf_hash=p_hash,pdf_title=p_title,parser_mode=p_mode,
    result_data=jsonb_build_object('review_available',true,'registration_mode',v_mode)
    where id=p_job_id and user_id=p_user_id;
  if not found then raise exception 'Job ownership mismatch'; end if;
  return true;
end;
$$;
revoke all on function public.prepare_calendar_review(uuid,uuid,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.prepare_calendar_review(uuid,uuid,jsonb,text,text,text) to service_role;
