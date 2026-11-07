/* eslint-disable @typescript-eslint/no-require-imports -- Run TypeScript services with the existing ts-node dependency. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { isAdminUser } = require('../src/lib/admin-identity.ts')
const { createAdminEmailService, EmailProviderError, parseErrorJobsPage } = require('../src/lib/admin-error-email-service.ts')
const { createAdminEmailHandlers } = require('../src/lib/admin-error-email-http.ts')
const { parseSendEmailInput, groupEmailRecipients } = require('../src/lib/admin-error-email-types.ts')

const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`
const now = Date.parse('2026-11-07T03:00:00Z')
const adminId = id(100)
const job = (number = 1, user = 10, status = 'error') => ({
  id: id(number), user_id: id(user), status, created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString(),
  pdf_title: '<calendar>', r2_object_key: 'private/path/calendar.pdf', error_message: '<script>alert(1)</script>',
  result_data: { error_code: 'GEMINI_PARSE_ERROR', secret: 'not-for-the-client' },
})
const input = (overrides = {}) => parseSendEmailInput({ operationId: id(50), jobIds: [id(1)], subject: 'Please retry', body: '<script>plain text</script>\nhttps://gomicale.jp/ja/dashboard', ...overrides })

function fixture({ jobs = [job()], email = 'user@example.test', send, saveFails = false } = {}) {
  const deliveries = new Map()
  const calls = []
  let emailLookups = 0
  const repository = {
    async listErrorJobs() { return { jobs: jobs.filter(job => job.status === 'error'), total: jobs.filter(job => job.status === 'error').length } },
    async getJobs(ids) { return jobs.filter(job => ids.includes(job.id)) },
    async getUserEmail() { emailLookups++; return email },
    async latestEmails() { return [...deliveries.values()] },
    async getDelivery(operationId, userId) { return deliveries.get(`${operationId}/${userId}`) ?? null },
    async ensureDelivery(data) {
      const key = `${data.operation_id}/${data.recipient_user_id}`
      if (!deliveries.has(key)) deliveries.set(key, { ...data, id: id(90), created_at: new Date(now).toISOString(), sent_at: null, error_code: null, provider_message_id: null })
      return deliveries.get(key)
    },
    async saveOutcome(delivery, outcome) {
      if (saveFails) throw new Error('DB unavailable')
      const key = `${delivery.operation_id}/${delivery.recipient_user_id}`
      const previous = deliveries.get(key)
      const saved = previous.status === 'sent' ? previous : { ...previous, ...outcome }
      deliveries.set(key, saved)
      return saved
    },
  }
  const service = createAdminEmailService({ repository, fromEmail: 'GomiCale <support@example.test>', now: () => now,
    send: async (delivery, key) => { calls.push({ delivery, key }); return send ? send(delivery, key) : 'provider-1' } })
  return { service, repository, deliveries, calls, lookups: () => emailLookups }
}

function http(overrides = {}) {
  let reads = 0
  let sends = 0
  const handlers = createAdminEmailHandlers({
    authorize: async () => ({ status: 200, user: { id: adminId } }),
    list: async page => { reads++; return { jobs: [], page, total: 0 } },
    send: async () => { sends++; return { outcome: 'sent' } },
    ...overrides,
  })
  return { ...handlers, reads: () => reads, sends: () => sends }
}
const request = (value = input(), headers = {}) => new Request('https://gomicale.jp/api/admin/error-emails', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(value),
})

test('admin authorization fails closed and only accepts a confirmed server-verified email', () => {
  const user = { email: ' Admin@Example.test ', email_confirmed_at: '2026-01-01' }
  assert.equal(isAdminUser(user, 'admin@example.test'), true)
  for (const configured of [undefined, '', ' ', 'other@example.test']) assert.equal(isAdminUser(user, configured), false)
  assert.equal(isAdminUser(null, 'admin@example.test'), false)
  assert.equal(isAdminUser({ email: user.email }, 'admin@example.test'), false)
  assert.equal(isAdminUser({ email: 'other@example.test', email_confirmed_at: 'now', user_metadata: { admin: true } }, 'admin@example.test'), false)
})

for (const status of [401, 403]) {
  test(`GET and POST reject ${status} before accessing privileged services`, async () => {
    const api = http({ authorize: async () => ({ status, user: null }) })
    for (const response of [await api.GET(new Request('https://gomicale.jp/api/admin/error-jobs')), await api.POST(request())]) {
      assert.equal(response.status, status)
      assert.match(response.headers.get('cache-control'), /no-store/)
    }
    assert.equal(api.reads(), 0)
    assert.equal(api.sends(), 0)
  })
}

test('authorized list paginates and rejects invalid pages', async () => {
  const api = http()
  assert.equal((await (await api.GET(new Request('https://gomicale.jp/api/admin/error-jobs?page=2'))).json()).page, 2)
  for (const value of ['0', '-1', '1.5', 'NaN', '20001']) {
    assert.equal((await api.GET(new Request(`https://gomicale.jp/api/admin/error-jobs?page=${value}`))).status, 400)
  }
  assert.equal(parseErrorJobsPage(null), 1)
})

test('POST rejects cross-site requests, non-JSON, malformed JSON, and oversized bodies', async () => {
  const api = http()
  assert.equal((await api.POST(request(input(), { origin: 'https://attacker.test' }))).status, 403)
  assert.equal((await api.POST(request(input(), { 'content-type': 'text/plain' }))).status, 415)
  assert.equal((await api.POST(request(input(), { 'content-type': 'application/jsonp' }))).status, 415)
  assert.equal((await api.POST(new Request('https://gomicale.jp/api/admin/error-emails', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken' }))).status, 400)
  assert.equal((await api.POST(request({ ...input(), body: 'x'.repeat(70000) }))).status, 413)
  assert.equal(api.sends(), 0)
})

test('valid POST accepts same-origin requests without caching', async () => {
  const api = http()
  const response = await api.POST(request(input(), { origin: 'https://gomicale.jp' }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { outcome: 'sent' })
  assert.equal(api.sends(), 1)
})

test('an inconsistent authorization response fails closed even when a user object is present', async () => {
  const api = http({ authorize: async () => ({ status: 403, user: { id: adminId } }) })
  assert.equal((await api.GET(new Request('https://gomicale.jp/api/admin/error-jobs'))).status, 403)
  assert.equal((await api.POST(request())).status, 403)
  assert.equal(api.reads(), 0)
  assert.equal(api.sends(), 0)
})

test('validation bounds subject, body, operation IDs and job selection', () => {
  for (const value of [null, {}, { ...input(), operationId: 'not-a-uuid' },
    { ...input(), jobIds: [] }, { ...input(), jobIds: ['bad'] }, { ...input(), jobIds: Array(51).fill(id(1)) },
    { ...input(), subject: ' ' }, { ...input(), subject: 'x'.repeat(201) }, { ...input(), subject: 'Header\r\nBcc: attacker@test' },
    { ...input(), body: '' }, { ...input(), body: 'x'.repeat(10001) }, { ...input(), body: '\0' }]) {
    assert.throws(() => parseSendEmailInput(value))
  }
  assert.deepEqual(input({ jobIds: [id(2), id(1), id(2)] }).jobIds, [id(1), id(2)])
})

test('list exposes only necessary job fields and looks up each user once', async () => {
  const { service, lookups } = fixture({ jobs: [job(1), job(2), job(3, 11)] })
  const page = await service.list(1)
  assert.equal(page.total, 3)
  assert.equal(lookups(), 2)
  assert.equal(page.jobs[0].fileName, '<calendar>')
  assert.equal(page.jobs[0].errorCode, 'GEMINI_PARSE_ERROR')
  assert.equal(page.jobs[0].latestEmail, null)
  assert.equal(JSON.stringify(page).includes('not-for-the-client'), false)
  assert.equal(JSON.stringify(page).includes('private/path'), false)
  assert.equal(groupEmailRecipients(page.jobs).length, 2)
})

test('individual send uses the server email and retains plain text without HTML interpolation', async () => {
  const { service, calls } = fixture()
  const result = await service.send(adminId, input({ email: 'attacker@example.test' }))
  assert.equal(result.outcome, 'sent')
  assert.equal(calls[0].delivery.recipient_email, 'user@example.test')
  assert.match(calls[0].delivery.body, /^<script>plain text<\/script>/)
  assert.equal(result.delivery.provider_message_id, 'provider-1')
  assert.equal(result.delivery.admin_user_id, adminId)
})

test('multiple selected errors for one user produce one email; grouping bulk users stays separate', async () => {
  const { service, calls } = fixture({ jobs: [job(1), job(2), job(3, 11)] })
  await service.send(adminId, input({ jobIds: [id(1), id(2), id(2)] }))
  await service.send(adminId, input({ jobIds: [id(3)] }))
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0].delivery.job_ids, [id(1), id(2)])
  assert.notEqual(calls[0].key, calls[1].key)
  await assert.rejects(() => service.send(adminId, input({ jobIds: [id(1), id(3)] })), { code: 'MIXED_RECIPIENTS' })
})

test('missing recipient email skips without contacting the provider', async () => {
  const { service, calls } = fixture({ email: null })
  assert.deepEqual(await service.send(adminId, input()), { outcome: 'skipped', code: 'EMAIL_UNAVAILABLE' })
  assert.equal(calls.length, 0)
})

test('changed or missing jobs cannot be sent', async () => {
  const { service, calls } = fixture({ jobs: [job(1, 10, 'completed')] })
  assert.equal((await service.send(adminId, input())).code, 'JOBS_CHANGED')
  await assert.rejects(() => service.send(adminId, input({ jobIds: [id(99)] })), { code: 'JOBS_CHANGED' })
  assert.equal(calls.length, 0)
})

test('a successful operation is not sent twice, even if the job subsequently succeeds', async () => {
  const jobs = [job()]
  const { service, calls } = fixture({ jobs })
  await service.send(adminId, input())
  jobs[0].status = 'completed'
  assert.equal((await service.send(adminId, input())).outcome, 'sent')
  assert.equal(calls.length, 1)
})

test('operation IDs cannot be reused with modified content, selections or another admin', async () => {
  const { service, calls } = fixture({ jobs: [job(1), job(2)] })
  await service.send(adminId, input())
  for (const changed of [input({ subject: 'Changed' }), input({ body: 'Changed' }), input({ jobIds: [id(2)] })]) {
    await assert.rejects(() => service.send(adminId, changed), { code: 'OPERATION_CONFLICT' })
  }
  await assert.rejects(() => service.send(id(101), input()), { code: 'OPERATION_CONFLICT' })
  assert.equal(calls.length, 1)
})

test('a bulk failure does not stop other users; retrying skips completed users and keeps the same key', async () => {
  let fail = true
  const { service, calls } = fixture({ jobs: [job(1), job(2, 11)], send: async delivery => {
    if (delivery.recipient_user_id === id(10) && fail) throw new EmailProviderError(true)
    return 'provider-ok'
  } })
  assert.equal((await service.send(adminId, input())).outcome, 'failed')
  assert.equal((await service.send(adminId, input({ jobIds: [id(2)] }))).outcome, 'sent')
  fail = false
  assert.equal((await service.send(adminId, input())).outcome, 'sent')
  assert.equal((await service.send(adminId, input({ jobIds: [id(2)] }))).outcome, 'sent')
  assert.equal(calls.length, 3)
  assert.equal(calls[0].key, calls[2].key)
})

test('network failures remain unconfirmed and a retry reuses the same recipient, sender and key', async () => {
  let fail = true
  const { service, calls } = fixture({ send: async () => { if (fail) throw new Error('timeout'); return 'same-id' } })
  assert.equal((await service.send(adminId, input())).outcome, 'unknown')
  fail = false
  assert.equal((await service.send(adminId, input())).outcome, 'sent')
  assert.equal(calls[0].key, calls[1].key)
  assert.deepEqual(calls[0].delivery.body, calls[1].delivery.body)
})

test('provider acceptance followed by DB failure is not incorrectly reported as failure or success', async () => {
  const { service, calls } = fixture({ saveFails: true })
  assert.deepEqual(await service.send(adminId, input()), { outcome: 'unknown', code: 'HISTORY_UNAVAILABLE' })
  await service.send(adminId, input())
  assert.equal(calls[0].key, calls[1].key)
})

test('expired idempotency windows never resend automatically', async () => {
  const { service, repository, calls, deliveries } = fixture({ send: async () => { throw new Error('timeout') } })
  await service.send(adminId, input())
  const delivery = await repository.getDelivery(id(50), id(10))
  deliveries.set(`${id(50)}/${id(10)}`, { ...delivery, created_at: new Date(now - 24 * 60 * 60 * 1000).toISOString() })
  assert.equal((await service.send(adminId, input())).code, 'RETRY_EXPIRED')
  assert.equal(calls.length, 1)
})

test('concurrent sends keep the same provider key and cannot downgrade a recorded success', async () => {
  let release
  let count = 0
  const gate = new Promise(resolve => { release = resolve })
  const { service, calls } = fixture({ send: async () => {
    if (++count === 1) return 'provider-1'
    await gate
    throw new EmailProviderError(true)
  } })
  const first = service.send(adminId, input())
  const second = service.send(adminId, input())
  await first
  release()
  assert.equal((await second).outcome, 'sent')
  assert.equal(calls.length, 2)
  assert.equal(calls[0].key, calls[1].key)
})

test('Japanese and English contain matching admin UI translations and safe default templates', () => {
  const messages = locale => JSON.parse(fs.readFileSync(path.join(__dirname, `../messages/${locale}.json`), 'utf8'))
  const ja = messages('ja')
  const en = messages('en')
  const keys = (value, prefix = '') => Object.entries(value).flatMap(([key, child]) => typeof child === 'object' ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`]).sort()
  assert.deepEqual(keys(ja.adminErrorEmails), keys(en.adminErrorEmails))
  for (const value of [ja, en]) {
    assert.ok(value.dashboard.adminErrorEmails)
    assert.match(value.adminErrorEmails.defaultBody, /\{dashboardUrl\}/)
    assert.ok(value.adminErrorEmails.defaultSubject.length <= 200)
  }
})
