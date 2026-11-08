-- service_role intentionally cannot SELECT auth.users. Expose only existence,
-- from an unexposed schema and only to the existing server role.
create function app_private.account_exists(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id=p_user_id);
$$;
revoke all on function app_private.account_exists(uuid) from public, anon, authenticated;
grant execute on function app_private.account_exists(uuid) to service_role;

create or replace function public.account_is_active(p_user_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select app_private.account_exists(p_user_id)
    and not exists(select 1 from public.account_deletion_requests where user_id=p_user_id);
$$;

create or replace function public.begin_account_deletion(p_user_id uuid,p_token uuid)
returns setof public.account_deletion_requests language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  if not exists(select 1 from public.account_deletion_requests where user_id=p_user_id) then
    if not app_private.account_exists(p_user_id) then raise exception 'ACCOUNT_MISSING'; end if;
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
