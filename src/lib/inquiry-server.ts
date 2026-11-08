import 'server-only'
import { after } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { getAdminSession } from '@/lib/admin-auth'
import { accountAccessError } from '@/lib/account-access'
import { sendInquiryNotifications } from '@/lib/inquiry-notifications'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

async function readInput(request: Request): Promise<{ id: string; content: string; locale: 'ja' | 'en' } | null> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return null
  const reader = request.body?.getReader()
  if (!reader) return null
  let raw = ''
  let size = 0
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 16384) { await reader.cancel(); return null }
      raw += decoder.decode(value, { stream: true })
    }
    raw += decoder.decode()
    const body = JSON.parse(raw)
    if (!body || typeof body !== 'object' || Object.keys(body).some(key => !['id', 'content', 'locale'].includes(key))) return null
    if (typeof body.id !== 'string' || !UUID.test(body.id) || typeof body.content !== 'string' || !body.content.trim() || body.content.trim().length > 2000) return null
    if (!['ja', 'en'].includes(body.locale)) return null
    return { id: body.id, content: body.content.trim(), locale: body.locale }
  } catch { return null } finally { reader.releaseLock() }
}

/** A stable client-generated ID makes a retried submission the same post/reply. */
export async function submitInquiry(request: Request, postId?: string) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'FORBIDDEN' }, 403)
    let userId: string
    if (postId !== undefined) {
      const session = await getAdminSession()
      if (!session.user) return json({ error: session.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN' }, session.status)
      userId = session.user.id
      if (!UUID.test(postId)) return json({ error: 'INVALID_INPUT' }, 400)
    } else {
      const auth = await getSupabaseServerClient()
      const { data: { user }, error } = await auth.auth.getUser()
      if (error || !user) return json({ error: 'UNAUTHORIZED' }, 401)
      userId = user.id
      const denied = await accountAccessError(userId)
      if (denied) return denied
    }
    const input = await readInput(request)
    if (!input) return json({ error: 'INVALID_INPUT' }, 400)
    const db = getSupabaseServiceClient()
    if (postId) {
      const { data: post, error } = await db.from('inquiry_posts').select('user_id').eq('id', postId).maybeSingle()
      if (error) throw new Error('POST_READ_FAILED')
      if (!post) return json({ error: 'POST_NOT_FOUND' }, 404)
      if (await accountAccessError(post.user_id)) return json({ error: 'POST_UNAVAILABLE' }, 409)
    }
    const kind = postId ? 'reply' : 'post'
    const table = postId ? 'inquiry_replies' : 'inquiry_posts'
    const row = postId
      ? { id: input.id, post_id: postId, admin_user_id: userId, content: input.content }
      : { id: input.id, user_id: userId, content: input.content, locale: input.locale }
    const { data, error } = await db.from(table).insert(row).select().single()
    let saved = data
    if (error?.code === '23505') {
      const { data: existing, error: readError } = await db.from(table).select('*').eq('id', input.id).maybeSingle()
      if (readError) throw new Error('SUBMISSION_READ_FAILED')
      // IDs never grant access to another person's submission, even on replay.
      if (!existing || existing.content !== input.content ||
        ('admin_user_id' in existing ? existing.admin_user_id !== userId || existing.post_id !== postId : existing.user_id !== userId || existing.locale !== input.locale)) {
        return json({ error: 'SUBMISSION_CONFLICT' }, 409)
      }
      saved = existing
    } else if (error) {
      if (error.message.includes('ACCOUNT_DELETING')) return json({ error: 'ACCOUNT_DELETING' }, 409)
      throw new Error('SUBMISSION_SAVE_FAILED')
    }
    if (!saved) throw new Error('SUBMISSION_SAVE_FAILED')
    after(async () => {
      try {
        const query = db.from('inquiry_notifications').select('id').eq('kind', kind)
        const { data: notification, error: lookupError } = await (postId ? query.eq('reply_id', saved.id) : query.eq('post_id', saved.id)).maybeSingle()
        if (lookupError) throw new Error('NOTIFICATION_READ_FAILED')
        if (notification) await sendInquiryNotifications({ notificationId: notification.id, limit: 1 })
      } catch { console.error('[inquiry-notifications] background delivery deferred') }
    })
    return json({ [kind]: saved }, error ? 200 : 201)
  } catch {
    console.error('[inquiries] submission failed')
    return json({ error: 'SUBMISSION_FAILED' }, 503)
  }
}
