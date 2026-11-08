/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')
const path = require('node:path')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
let f
const copy = value => structuredClone(value)
class Query {
  constructor(table) { this.table = table; this.filters = []; this.mode = 'select' }
  select() { return this }
  eq(key, value) { this.filters.push(row => row[key] === value); return this }
  insert(value) { this.mode = 'insert'; this.value = value; return this }
  update(value) { this.mode = 'update'; this.value = value; return this }
  async run(single = false) {
    const rows = f.tables[this.table]
    if (this.mode === 'insert') {
      if (rows.some(row => row.id === this.value.id)) return { data: null, error: { code: '23505' } }
      const row = { ...copy(this.value), created_at: new Date().toISOString() }
      rows.push(row)
      const post = this.table === 'inquiry_posts' ? row : f.tables.inquiry_posts.find(p => p.id === row.post_id)
      f.tables.inquiry_notifications.push(notification(this.table === 'inquiry_posts' ? 'post' : 'reply', post.id, row.id))
      return { data: copy(row), error: null }
    }
    const selected = rows.filter(row => this.filters.every(filter => filter(row)))
    if (this.mode === 'update') {
      if (this.value.status === 'sent' && f.failSentSave) { f.failSentSave = false; return { error: { message: 'offline' } } }
      selected.forEach(row => Object.assign(row, copy(this.value)))
    }
    return { data: copy(single ? selected[0] ?? null : selected), error: null }
  }
  single() { return this.run(true) }
  maybeSingle() { return this.run(true) }
  then(yes, no) { return this.run().then(yes, no) }
}
function notification(kind = 'post', postId = id(10), replyId = id(11)) {
  return { id: id(100 + f.tables.inquiry_notifications.length), kind, post_id: postId, reply_id: kind === 'reply' ? replyId : null,
    user_id: id(1), status: 'pending', payload: null, attempts: 0, first_attempt_at: null, next_attempt_at: new Date().toISOString(),
    lease_token: null, lease_until: null, resend_id: null, sent_at: null, created_at: new Date().toISOString() }
}
function setup() {
  delete process.env.INQUIRY_NOTIFICATION_EMAIL
  process.env.RESEND_API_KEY = 'test-only'; process.env.APP_FROM_EMAIL = 'ゴミカレ <noreply@gomicale.jp>'; process.env.APP_URL = 'https://gomicale.jp'
  f = { session: { id: id(1) }, admin: false, active: true, after: [], sent: [], tables: {
    inquiry_posts: [{ id: id(10), user_id: id(1), content: '<script>feedback</script>', locale: 'en' }],
    inquiry_replies: [{ id: id(11), post_id: id(10), admin_user_id: id(2), content: 'お返事です' }], inquiry_notifications: [],
  } }
  f.db = { from: table => new Query(table), auth: {
    getUser: async () => ({ data: { user: f.session }, error: null }),
    admin: { getUserById: async userId => {
      assert.equal(userId, id(1))
      if (f.afterResolveDelete) f.active = false
      return { data: { user: f.missingEmail ? null : { email: 'author@example.test', email_confirmed_at: f.unconfirmed ? null : 'confirmed' } }, error: null }
    } },
  }, rpc: async (name, args) => {
    if (name === 'account_is_active') return { data: f.active, error: null }
    assert.equal(name, 'claim_inquiry_notification')
    const row = f.tables.inquiry_notifications.find(row => row.status === 'pending' && Date.parse(row.next_attempt_at) <= Date.now() &&
      (!row.lease_until || Date.parse(row.lease_until) < Date.now()) && (!args.p_notification_id || row.id === args.p_notification_id))
    if (!row) return { data: [], error: null }
    row.lease_token = args.p_token; row.lease_until = new Date(Date.now() + 90000).toISOString(); row.attempts++
    return { data: [copy(row)], error: null }
  } }
}
const load = Module._load
Module._load = function (name, parent, ...args) {
  if (name === 'server-only') return {}
  if (name === 'next/server') return { ...load.call(this, name, parent, ...args), after: fn => f.after.push(fn) }
  if (name === '@/lib/supabase/server') return { getSupabaseServerClient: async () => f.db, getSupabaseServiceClient: () => f.db }
  if (name === '@/lib/admin-auth') return { getAdminSession: async () => ({ user: f.admin ? f.session : null, status: !f.session ? 401 : f.admin ? 200 : 403 }) }
  if (name.startsWith('@/lib/')) return load.call(this, path.resolve(__dirname, '../src/lib/' + name.slice('@/lib/'.length) + '.ts'), parent, ...args)
  if (name === 'resend') return { Resend: class { emails = { send: async (mail, options) => {
    f.sent.push({ mail: copy(mail), key: options.idempotencyKey })
    if (f.mailFailure) return { data: null, error: { name: 'application_error', message: 'must not leak private provider details' } }
    return { data: { id: 'resend-test-id' }, error: null }
  } } } }
  return load.call(this, name, parent, ...args)
}
const { submitInquiry } = require('../src/lib/inquiry-server.ts')
const { sendInquiryNotifications, buildInquiryMail } = require('../src/lib/inquiry-notifications.ts')
const input = (n = 20, content = '新しいご意見') => ({ id: id(n), content, locale: 'ja' })
const req = (body = input(), headers = {}) => new Request('https://gomicale.jp/api/inquiries', { method: 'POST', headers: { origin: 'https://gomicale.jp', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
const finish = async () => { for (const callback of f.after.splice(0)) await callback() }
const ready = (kind = 'post') => { const row = notification(kind); f.tables.inquiry_notifications.push(row); return row }
const due = row => { row.next_attempt_at = new Date(Date.now() - 1000).toISOString() }

test('new posts persist before sending to the requested operator address, with safe text and a direct link', async () => {
  setup()
  const response = await submitInquiry(req(input(20, '<img src=x onerror=alert(1)>')))
  assert.equal(response.status, 201); assert.equal(f.sent.length, 0)
  await finish(); assert.equal(f.sent.length, 1)
  const { mail } = f.sent[0]
  assert.equal(mail.to, 'konkuriitonouenokareha128@gmail.com'); assert.equal(mail.replyTo, 'author@example.test')
  assert.equal(mail.html, undefined); assert.ok(mail.text.includes('<img src=x onerror=alert(1)>'))
  assert.ok(mail.text.includes('/ja/dashboard?inquiry=' + id(20)))
})
test('only administrators can reply; only the author receives the localized reply email', async () => {
  setup(); assert.equal((await submitInquiry(req(), id(10))).status, 403); assert.equal(f.after.length, 0)
  f.admin = true; f.session = { id: id(2) }
  assert.equal((await submitInquiry(req(input(21, '対応しました')), id(10))).status, 201)
  await finish(); assert.equal(f.sent.length, 1)
  assert.equal(f.sent[0].mail.to, 'author@example.test'); assert.match(f.sent[0].mail.subject, /We replied/)
  assert.match(f.sent[0].mail.text, /対応しました/); assert.match(f.sent[0].mail.text, /\/en\/dashboard/)
  assert.equal(f.sent[0].mail.replyTo, undefined) // the private operator inbox is not exposed to users
})
test('unauthenticated, cross-site, forged-user and invalid input requests do not save or send', async () => {
  setup(); f.session = null
  assert.equal((await submitInquiry(req())).status, 401)
  f.session = { id: id(1) }
  assert.equal((await submitInquiry(req(input(), { origin: 'https://attacker.example' }))).status, 403)
  assert.equal((await submitInquiry(req(input(), { 'sec-fetch-site': 'cross-site' }))).status, 403)
  for (const body of [{ ...input(), user_id: id(2) }, { ...input(), locale: 'fr' }, input(20, ' '), input(20, 'a'.repeat(2001)), { ...input(), id: 'invalid' }])
    assert.equal((await submitInquiry(req(body))).status, 400)
  assert.equal(f.after.length, 0); assert.equal(f.tables.inquiry_posts.length, 1)
})
test('a retried submission reuses its post and notification, and never discloses a conflicting submission', async () => {
  setup()
  assert.equal((await submitInquiry(req())).status, 201)
  assert.equal((await submitInquiry(req())).status, 200)
  await Promise.all(f.after.splice(0).map(fn => fn()))
  assert.equal(f.tables.inquiry_notifications.length, 1); assert.equal(f.sent.length, 1)
  f.session = { id: id(3) }
  const conflict = await submitInquiry(req())
  assert.equal(conflict.status, 409); assert.deepEqual(await conflict.json(), { error: 'SUBMISSION_CONFLICT' })
})
test('reply retries create a single reply and a single email', async () => {
  setup(); f.admin = true; f.session = { id: id(2) }
  assert.equal((await submitInquiry(req(input(22)), id(10))).status, 201)
  assert.equal((await submitInquiry(req(input(22)), id(10))).status, 200)
  await finish(); assert.equal(f.tables.inquiry_replies.length, 2); assert.equal(f.sent.length, 1)
})
test('missing posts and accounts being deleted cannot receive replies or create posts', async () => {
  setup(); f.admin = true
  assert.equal((await submitInquiry(req(), id(99))).status, 404)
  f.active = false
  assert.equal((await submitInquiry(req(), id(10))).status, 409)
  assert.equal((await submitInquiry(req())).status, 409)
  assert.equal(f.after.length, 0)
})
test('provider failure preserves the post and retries the exact same frozen payload and idempotency key', async () => {
  setup(); f.mailFailure = true
  assert.equal((await submitInquiry(req())).status, 201)
  await finish()
  const row = f.tables.inquiry_notifications[0]
  assert.equal(row.status, 'pending'); assert.equal(row.last_error_code, 'DELIVERY_FAILED')
  assert.ok(row.first_attempt_at); assert.equal(row.lease_token, null)
  f.mailFailure = false; due(row); process.env.INQUIRY_NOTIFICATION_EMAIL = 'changed@example.test'
  f.tables.inquiry_posts.find(post => post.id === id(20)).content = 'changed after submission'
  await sendInquiryNotifications()
  assert.deepEqual(f.sent[1], f.sent[0]); assert.equal(row.status, 'sent'); assert.equal(row.resend_id, 'resend-test-id')
})
test('overlapping workers and already-sent records never issue duplicate provider requests', async () => {
  setup(); ready('reply')
  await Promise.all([sendInquiryNotifications(), sendInquiryNotifications(), sendInquiryNotifications()])
  assert.equal(f.sent.length, 1)
  await sendInquiryNotifications(); assert.equal(f.sent.length, 1)
})
test('accepted email followed by a failed result save is retried with the same provider key', async () => {
  setup(); const row = ready(); f.failSentSave = true
  await sendInquiryNotifications(); assert.equal(row.status, 'pending')
  due(row); await sendInquiryNotifications()
  assert.equal(row.status, 'sent'); assert.deepEqual(f.sent[0], f.sent[1])
})
test('ambiguous deliveries beyond the provider deduplication window are held for review', async () => {
  setup(); const row = ready(); row.first_attempt_at = new Date(Date.now() - 86400001).toISOString()
  await sendInquiryNotifications()
  assert.equal(row.status, 'review_required'); assert.equal(f.sent.length, 0)
})
test('withdrawal and missing or unverified addresses skip notifications without mail', async () => {
  for (const scenario of ['inactive', 'missingEmail', 'unconfirmed', 'afterResolveDelete']) {
    setup(); const row = ready('reply')
    if (scenario === 'inactive') f.active = false
    else f[scenario] = true
    await sendInquiryNotifications(); assert.equal(row.status, 'skipped'); assert.equal(f.sent.length, 0)
  }
})
test('missing mail configuration leaves a durable unsent notification without starting the retry window', async () => {
  setup(); const row = ready(); delete process.env.RESEND_API_KEY
  await sendInquiryNotifications()
  assert.equal(row.status, 'pending'); assert.equal(row.first_attempt_at, null); assert.equal(f.sent.length, 0)
})
test('Japanese and English templates keep arbitrary feedback out of headers and HTML', () => {
  setup()
  for (const locale of ['ja', 'en']) {
    const mail = buildInquiryMail({ kind: 'reply', postId: id(10), locale, authorEmail: 'author@example.test', content: 'x\nBcc: other@example.test', reply: '<script>reply</script>' })
    assert.ok(mail.text.includes('<script>reply</script>')); assert.equal(mail.html, undefined)
    assert.ok(!mail.subject.includes('Bcc:')); assert.equal(mail.to, 'author@example.test')
  }
})
