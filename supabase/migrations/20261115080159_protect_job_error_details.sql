-- Realtime also checks SELECT privileges before including a column in a payload.
revoke select on table public.jobs from public, anon, authenticated;
revoke select (error_message) on table public.jobs from public, anon, authenticated;
grant select (id, user_id, status, r2_object_key, pdf_hash, pdf_title, parser_mode, result_data, created_at, updated_at)
  on table public.jobs to authenticated;
grant select on table public.jobs to service_role;

-- Preserve actionable errors from older workers. Other details stay in error_message.
with legacy as (
  select id, error_message, case
    when error_message = 'No valid events were found' and r2_object_key like 'manual/%' then 'NO_VALID_MANUAL_EVENTS'
    when error_message = 'No valid events were found' then 'NO_VALID_EVENTS'
    when error_message in (
      'No calendar events could be generated from the text instruction. Please make the rule more specific.',
      '入力指示から登録できる予定を生成できませんでした。曜日や収集種別が分かるように、もう少し具体的に入力してください。'
    ) then 'NO_VALID_MANUAL_EVENTS'
    when error_message = 'Too many events. Please upload a shorter period.' then 'TOO_MANY_EVENTS'
    when error_message in (
      'GOOGLE_REAUTH_REQUIRED', 'GOOGLE_CALENDAR_SCOPE_MISSING', 'GOOGLE_CALENDAR_PERMISSION_DENIED',
      'GOOGLE_CALENDAR_RATE_LIMIT', 'GOOGLE_API_TEMPORARY', 'GOOGLE_OAUTH_CONFIG_ERROR',
      'CALENDAR_NOT_FOUND', 'AUTO_DISPATCH_FAILED', 'PROCESSOR_UNAVAILABLE', 'UPLOAD_FAILED'
    ) then error_message
    when error_message like '%Googleカレンダーへのアクセス権限%' then 'GOOGLE_CALENDAR_SCOPE_MISSING'
    when error_message like 'No Google refresh token for user: %' then 'GOOGLE_REAUTH_REQUIRED'
  end as code
  from public.jobs
  where status = 'error' and coalesce(result_data->>'error_code', 'UNKNOWN') = 'UNKNOWN'
)
update public.jobs as job
set result_data = (
  case when jsonb_typeof(job.result_data) = 'object' then job.result_data else '{}'::jsonb end
) || jsonb_build_object('error_code', legacy.code)
from legacy
where job.id = legacy.id and legacy.code is not null
  and job.status = 'error' and job.error_message = legacy.error_message
  and coalesce(job.result_data->>'error_code', 'UNKNOWN') = 'UNKNOWN';
