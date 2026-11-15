import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('job error details are private while legacy codes and owner-only job access survive migration', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      grant usage on schema auth to authenticated;
      create function auth.uid() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')
      $$;
      create table jobs(
        id text primary key, user_id text not null, status text not null default 'pending',
        r2_object_key text not null, pdf_hash text, pdf_title text, parser_mode text,
        result_data jsonb, error_message text,
        created_at timestamptz not null default now(), updated_at timestamptz not null default now()
      );
      alter table jobs enable row level security;
      create policy own on jobs for all to authenticated
        using (auth.uid() = user_id) with check (auth.uid() = user_id);
      grant select on jobs to public, anon, authenticated;
      grant select (error_message) on jobs to authenticated;
      grant insert, update on jobs to authenticated;
      insert into jobs(id, user_id, status, r2_object_key, error_message, result_data) values
        ('file', 'alice', 'error', 'uploads/file.pdf', 'No valid events were found', '{"error_code":"UNKNOWN","review_available":true}'),
        ('manual', 'alice', 'error', 'manual/rules.json', 'No valid events were found', null),
        ('size', 'alice', 'error', 'uploads/calendar.pdf', 'Too many events. Please upload a shorter period.', null),
        ('google', 'alice', 'error', 'uploads/photo.png', 'Googleカレンダーへのアクセス権限がありません', null),
        ('unknown', 'alice', 'error', 'uploads/file.pdf', 'Private provider details', null),
        ('known', 'alice', 'error', 'uploads/file.pdf', 'No valid events were found', '{"error_code":"GOOGLE_REAUTH_REQUIRED"}'),
        ('other', 'bob', 'processing', 'uploads/file.pdf', null, null);
    `)
    const migration = new URL('../supabase/migrations/20261115080159_protect_job_error_details.sql', import.meta.url)
    await db.exec(await readFile(migration, 'utf8'))

    const { rows: [grants] } = await db.query(`
      select has_column_privilege('authenticated', 'public.jobs', 'id', 'select') as realtime_id,
        has_column_privilege('authenticated', 'public.jobs', 'error_message', 'select') as realtime_detail,
        has_column_privilege('anon', 'public.jobs', 'error_message', 'select') as anonymous_detail
    `)
    assert.deepEqual(grants, { realtime_id: true, realtime_detail: false, anonymous_detail: false })

    await db.exec("set role authenticated; set request.jwt.claim.sub = 'alice'")
    await assert.rejects(db.query('select error_message from jobs'), /permission denied/)
    await assert.rejects(db.query("select id from jobs where error_message = 'Private provider details'"), /permission denied/)
    await assert.rejects(db.query('select * from jobs'), /permission denied/)
    const { rows } = await db.query('select id, result_data from jobs order by id')
    assert.deepEqual(rows, [
      { id: 'file', result_data: { error_code: 'NO_VALID_EVENTS', review_available: true } },
      { id: 'google', result_data: { error_code: 'GOOGLE_CALENDAR_SCOPE_MISSING' } },
      { id: 'known', result_data: { error_code: 'GOOGLE_REAUTH_REQUIRED' } },
      { id: 'manual', result_data: { error_code: 'NO_VALID_MANUAL_EVENTS' } },
      { id: 'size', result_data: { error_code: 'TOO_MANY_EVENTS' } },
      { id: 'unknown', result_data: null },
    ])
    assert.deepEqual(
      (await db.query("insert into jobs(id, user_id, r2_object_key) values ('new', 'alice', 'uploads/new.pdf') returning id")).rows,
      [{ id: 'new' }],
    )
    await db.query("update jobs set status = 'error', error_message = 'UPLOAD_FAILED' where id = 'new'")
    await db.exec('set role service_role')
    assert.deepEqual(
      (await db.query("select error_message from jobs where id = 'unknown' or id = 'new' order by id")).rows,
      [{ error_message: 'UPLOAD_FAILED' }, { error_message: 'Private provider details' }],
    )
  } finally {
    await db.close()
  }
})
