import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('real withdrawal SQL enforces processing exclusion, guards, RLS, cascades and anonymous delayed payments',async()=>{
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to authenticated,service_role;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create type job_status as enum ('pending','processing','completed','error','awaiting_confirmation');
      create table jobs(id uuid primary key,user_id uuid references auth.users on delete cascade,status job_status,created_at timestamptz default now(),updated_at timestamptz,error_message text,pdf_hash text,pdf_title text,parser_mode text,result_data jsonb);
      create table user_integrations(user_id uuid primary key references auth.users on delete cascade);
      create table parsed_pdfs(pdf_hash text primary key,extracted_json jsonb);
      create function handle_updated_at() returns trigger language plpgsql as $$begin new.updated_at=clock_timestamp(); return new; end$$;`)
    for (const table of ['line_links','line_link_codes','gemini_usage_limits','user_streaks','inquiry_posts','inquiry_reply_reads','api_keys']) {
      await db.exec(`create table ${table}(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users on delete cascade);`)
    }
    await db.exec(`create table inquiry_replies(id uuid primary key default gen_random_uuid(),admin_user_id uuid references auth.users on delete cascade);
      create table admin_error_emails(id uuid primary key default gen_random_uuid(),admin_user_id uuid references auth.users on delete cascade,recipient_user_id uuid references auth.users on delete cascade);
      create table support_payments(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users on delete set null,job_id uuid references jobs on delete set null);
      create table revenue_events(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users on delete set null,job_id uuid references jobs on delete set null);
      alter table jobs enable row level security; create policy own on jobs for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
      alter table parsed_pdfs enable row level security; create policy shared on parsed_pdfs for select to authenticated using(true);
      grant select,insert,update on jobs to authenticated; grant select on parsed_pdfs to authenticated;
      grant all on all tables in schema public to service_role;`)
    for (const file of ['20261107123255_calendar_import_review.sql','20261107131554_registration_mode_and_ready_emails.sql','20261108112322_account_deletion.sql','20261108112942_account_deletion_auth_lookup.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
    const alice=id(1),bob=id(2),job=id(10),other=id(11),token=id(50),hash='a'.repeat(64),shared='b'.repeat(64)
    await db.query('insert into auth.users values($1),($2)',[alice,bob])
    await db.query("insert into jobs(id,user_id,status,pdf_hash) values($1,$2,'processing',$3),($4,$5,'completed',$6)",[job,alice,hash,other,bob,shared])
    await db.exec('set role service_role')
    await assert.rejects(()=>db.query('select * from auth.users'),/permission denied/)
    await assert.rejects(()=>db.query('select * from begin_account_deletion($1,$2)',[alice,token]),/ACTIVE_JOBS/)
    assert.equal((await db.query('select * from account_deletion_requests')).rows.length,0)
    await db.query("update jobs set status='awaiting_confirmation' where id=$1",[job])
    await db.query("insert into calendar_imports(job_id,user_id,state,draft,language) values($1,$2,'analyzing','{}','ja')",[job,alice])
    await assert.rejects(()=>db.query('select * from begin_account_deletion($1,$2)',[alice,token]),/ACTIVE_JOBS/)
    await db.query("update calendar_imports set state='ready' where job_id=$1",[job])
    await db.query("insert into jobs(id,user_id,status,created_at,pdf_hash) values($1,$2,'pending',now()-interval '16 minutes',$3)",[id(12),alice,shared])
    await db.query('insert into parsed_pdfs values($1,\'{}\'),($2,\'{}\')',[hash+'_ja_colors_v1',shared+'_ja_colors_v1'])
    await db.query('insert into support_payments(user_id,job_id) values($1,$2)',[alice,job])
    const claimed=(await db.query('select * from begin_account_deletion($1,$2)',[alice,token])).rows
    assert.equal(claimed.length,1)
    assert.equal((await db.query('select * from begin_account_deletion($1,$2)',[alice,id(51)])).rows.length,0)
    assert.equal((await db.query('select account_is_active($1) as active',[alice])).rows[0].active,false)
    assert.equal((await db.query('select account_is_active($1) as active',[bob])).rows[0].active,true)
    await assert.rejects(()=>db.query("update calendar_imports set state='registering',confirmed='{}' where job_id=$1",[job]),/ACCOUNT_DELETING/)
    await assert.rejects(()=>db.query('insert into user_integrations values($1)',[alice]),/ACCOUNT_DELETING/)
    await assert.rejects(()=>db.query("insert into jobs(id,user_id,status) values($1,$2,'pending')",[id(15),alice]),/ACCOUNT_DELETING/)
    await db.exec('reset role')
    for (const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`)
      await assert.rejects(()=>db.query('select * from account_deletion_requests'),/permission denied/)
      await assert.rejects(()=>db.query('select * from begin_account_deletion($1,$2)',[bob,token]),/permission denied/)
      await assert.rejects(()=>db.query('select account_is_active($1)',[bob]),/permission denied/)
      await assert.rejects(()=>db.query('select app_private.account_exists($1)',[bob]),/permission denied/)
      await db.exec('reset role')
    }
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[alice])
    await db.exec('set role authenticated')
    assert.equal((await db.query('select * from parsed_pdfs')).rows.length,0)
    assert.equal((await db.query('select * from jobs')).rows.length,0)
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[bob])
    await db.exec('set role authenticated')
    assert.equal((await db.query('select * from parsed_pdfs')).rows.length,2)
    await db.exec('reset role')
    await db.query('delete from auth.users where id=$1',[alice])
    await db.exec('set role service_role')
    await db.query("update account_deletion_requests set stage='cleanup' where user_id=$1",[alice])
    await db.query('select cleanup_deleted_account_cache($1,$2)',[alice,token])
    assert.deepEqual((await db.query('select pdf_hash from parsed_pdfs')).rows.map(r=>r.pdf_hash),[shared+'_ja_colors_v1'])
    assert.equal((await db.query('select * from jobs')).rows.length,1)
    assert.equal((await db.query('select * from support_payments')).rows[0].user_id,null)
    await db.query('insert into support_payments(user_id,job_id) values($1,$2)',[alice,job])
    assert.ok((await db.query('select * from support_payments')).rows.every(r=>r.user_id===null && r.job_id===null))
    assert.equal((await db.query('select * from account_deletion_requests')).rows.length,1)
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[alice])
    await db.exec('set role authenticated')
    assert.equal((await db.query('select * from parsed_pdfs')).rows.length,0)
  } finally { await db.close() }
})
