import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('notification SQL is atomic, private, idempotent, compatible with old clients and cascades on withdrawal', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.inquiry_posts(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,content text not null,created_at timestamptz default now());
      create table public.inquiry_replies(id uuid primary key default gen_random_uuid(),post_id uuid not null references inquiry_posts on delete cascade,admin_user_id uuid not null references auth.users on delete cascade,content text not null,created_at timestamptz default now());
      grant select,insert on inquiry_posts,inquiry_replies to authenticated;
      grant all on all tables in schema public to service_role;
      insert into auth.users values('${id(1)}'),('${id(2)}');
      insert into inquiry_posts(id,user_id,content) values('${id(9)}','${id(1)}','historical');`)
    await db.exec(await readFile(new URL('../supabase/migrations/20261108121200_inquiry_email_notifications.sql',import.meta.url),'utf8'))
    assert.equal((await db.query('select * from inquiry_notifications')).rows.length, 0)
    await db.exec('set role authenticated')
    // Old browser clients still omit locale. Their insert must enqueue as part of the same transaction.
    await db.query('insert into inquiry_posts(id,user_id,content) values($1,$2,$3)',[id(10),id(1),'new post'])
    await db.exec('reset role')
    assert.equal((await db.query('select locale from inquiry_posts where id=$1',[id(10)])).rows[0].locale,'ja')
    assert.equal((await db.query('select * from inquiry_notifications')).rows.length,1)
    await db.exec('begin')
    await db.query('insert into inquiry_posts(id,user_id,content) values($1,$2,$3)',[id(12),id(1),'rolled back'])
    await db.exec('rollback')
    assert.equal((await db.query('select * from inquiry_notifications')).rows.length,1)
    await db.query('insert into inquiry_replies(id,post_id,admin_user_id,content) values($1,$2,$3,$4)',[id(11),id(10),id(2),'reply'])
    assert.equal((await db.query('select * from inquiry_notifications')).rows.length,2)
    await assert.rejects(()=>db.query('insert into inquiry_notifications(kind,post_id,user_id) values($1,$2,$3)',['post',id(10),id(1)]),/unique/)
    for (const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`)
      await assert.rejects(()=>db.query('select * from inquiry_notifications'),/permission denied/)
      await assert.rejects(()=>db.query('update inquiry_notifications set status=$1',['sent']),/permission denied/)
      await assert.rejects(()=>db.query('select * from claim_inquiry_notification($1)',[id(50)]),/permission denied/)
      await assert.rejects(()=>db.query('select app_private.enqueue_inquiry_notification()'),/permission denied/)
      await db.exec('reset role')
    }
    await db.exec('set role service_role')
    const first = (await db.query('select * from claim_inquiry_notification($1)',[id(50)])).rows[0]
    assert.ok(first); assert.equal(first.attempts,1)
    assert.equal((await db.query('select * from claim_inquiry_notification($1,$2)',[id(51),first.id])).rows.length,0)
    await db.query("update inquiry_notifications set lease_until=now()-interval '1 second' where id=$1",[first.id])
    const retry = (await db.query('select * from claim_inquiry_notification($1,$2)',[id(51),first.id])).rows[0]
    assert.equal(retry.attempts,2); assert.equal(retry.lease_token,id(51))
    await db.query("update inquiry_notifications set status='sent',lease_until=null where id=$1",[first.id])
    assert.equal((await db.query('select * from claim_inquiry_notification($1,$2)',[id(52),first.id])).rows.length,0)
    const policy = (await db.query("select relrowsecurity from pg_class where relname='inquiry_notifications'")).rows[0]
    assert.equal(policy.relrowsecurity,true)
    await db.exec('reset role')
    await db.query('delete from auth.users where id=$1',[id(1)])
    assert.equal((await db.query('select * from inquiry_posts')).rows.length,0)
    assert.equal((await db.query('select * from inquiry_replies')).rows.length,0)
    assert.equal((await db.query('select * from inquiry_notifications')).rows.length,0)
  } finally { await db.close() }
})
