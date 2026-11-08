import 'server-only'
import { randomUUID } from 'node:crypto'
import { Resend } from 'resend'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { isAccountActive } from '../../shared/account-lifecycle'
import type { InquiryMail, InquiryNotification } from './inquiry-notification-types'

export const DEFAULT_INQUIRY_NOTIFICATION_EMAIL = 'konkuriitonouenokareha128@gmail.com'
const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000 // Resend keeps idempotency keys for 24 hours.

function dashboardLink(locale: string, postId: string) {
  const url = new URL(process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://gomicale.jp')
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('INVALID_APP_URL')
  url.pathname = `/${locale === 'en' ? 'en' : 'ja'}/dashboard`
  url.search = new URLSearchParams({ inquiry: postId }).toString()
  url.hash = ''
  return url.toString()
}

/** Text-only mail: feedback is never interpreted as HTML or placed in mail headers. */
export function buildInquiryMail(input: {
  kind: 'post' | 'reply'; postId: string; locale: string; authorEmail: string;
  content: string; reply?: string
}): InquiryMail {
  const operator = process.env.INQUIRY_NOTIFICATION_EMAIL?.trim() || DEFAULT_INQUIRY_NOTIFICATION_EMAIL
  const from = process.env.APP_FROM_EMAIL || 'ゴミカレ <noreply@gomicale.jp>'
  const en = input.locale === 'en'
  const link = dashboardLink(input.kind === 'post' ? 'ja' : input.locale, input.postId)
  if (input.kind === 'post') return {
    from, to: operator, replyTo: input.authorEmail,
    subject: '【ゴミカレ】ご意見・ご要望が届きました',
    text: [`新しいご意見・ご要望が投稿されました。`, `投稿者：${input.authorEmail}`, '',
      '投稿内容：', input.content, '', '運営からの返信は、ダッシュボードの「ご意見・ご要望」から行ってください。', link].join('\n'),
  }
  return {
    from, to: input.authorEmail,
    subject: en ? '[GomiCale] We replied to your feedback' : '【ゴミカレ】ご意見・ご要望に返信が届きました',
    text: en ? [
      'Thank you for your feedback. The GomiCale team has replied.', '',
      'Our reply:', input.reply ?? '', '', 'Your feedback:', input.content, '',
      'View the conversation in Feedback on your dashboard:', link,
    ].join('\n') : [
      'ご意見・ご要望をお寄せいただきありがとうございます。ゴミカレ運営から返信が届きました。', '',
      '運営からの返信：', input.reply ?? '', '', 'あなたの投稿：', input.content, '',
      'ダッシュボードの「ご意見・ご要望」でご確認いただけます。', link,
    ].join('\n'),
  }
}

async function deliverNotification(row: InquiryNotification, token: string) {
  const db = getSupabaseServiceClient()
  const save = async (value: Partial<InquiryNotification>) => {
    const { data, error } = await db.from('inquiry_notifications').update(value)
      .eq('id', row.id).eq('lease_token', token).select('id').maybeSingle()
    if (error || !data) throw new Error('NOTIFICATION_SAVE_FAILED')
  }
  const finish = (value: Partial<InquiryNotification>) => save({ ...value, lease_token: null, lease_until: null })
  try {
    if (!await isAccountActive(db, row.user_id)) {
      await finish({ status: 'skipped', last_error_code: 'ACCOUNT_INACTIVE', payload: null }); return
    }
    if (!process.env.RESEND_API_KEY) throw new Error('MAIL_NOT_CONFIGURED')
    // Never resend an ambiguous request beyond the provider's deduplication window.
    if (row.first_attempt_at && Date.now() - Date.parse(row.first_attempt_at) >= RETRY_WINDOW_MS) {
      await finish({ status: 'review_required', last_error_code: 'RETRY_WINDOW_EXPIRED' }); return
    }
    let payload = row.payload
    if (!payload) {
      const { data: post, error } = await db.from('inquiry_posts').select('user_id,content,locale').eq('id', row.post_id).maybeSingle()
      if (error) throw new Error('POST_READ_FAILED')
      if (!post || post.user_id !== row.user_id) {
        await finish({ status: 'skipped', last_error_code: 'POST_MISSING' }); return
      }
      const { data: author, error: authorError } = await db.auth.admin.getUserById(post.user_id)
      if (authorError && authorError.status !== 404) throw new Error('AUTHOR_READ_FAILED')
      const email = author?.user?.email
      if (!email || !author.user?.email_confirmed_at) {
        await finish({ status: 'skipped', last_error_code: 'NO_VERIFIED_EMAIL' }); return
      }
      let reply: string | undefined
      if (row.kind === 'reply') {
        const { data: replyRow, error: replyError } = await db.from('inquiry_replies').select('content,post_id').eq('id', row.reply_id!).maybeSingle()
        if (replyError) throw new Error('REPLY_READ_FAILED')
        if (!replyRow || replyRow.post_id !== row.post_id) {
          await finish({ status: 'skipped', last_error_code: 'REPLY_MISSING' }); return
        }
        reply = replyRow.content
      }
      payload = buildInquiryMail({ kind: row.kind, postId: row.post_id, locale: post.locale, authorEmail: email, content: post.content, reply })
      // Freeze recipient, sender and content before the first network request, including across deployments.
      await save({ payload })
    }
    if (!row.first_attempt_at) await save({ first_attempt_at: new Date().toISOString() })
    // Recheck after resolving the recipient; withdrawal must stop queued notifications.
    if (!await isAccountActive(db, row.user_id)) {
      await finish({ status: 'skipped', last_error_code: 'ACCOUNT_INACTIVE', payload: null }); return
    }
    const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send(payload, {
      idempotencyKey: `inquiry/${row.id}`,
    })
    if (error || !data?.id) throw new Error('MAIL_SEND_FAILED')
    await finish({ status: 'sent', resend_id: data.id, sent_at: new Date().toISOString(), last_error_code: null })
  } catch {
    // The content is already saved. Keep notification failure separate from posting success.
    console.error('[inquiry-notifications] delivery deferred', row.id)
    await finish({ last_error_code: 'DELIVERY_FAILED', next_attempt_at: new Date(Date.now() + Math.min(row.attempts * 60000, 3600000)).toISOString() })
  }
}

export async function sendInquiryNotifications(options: { notificationId?: string; limit?: number; budgetMs?: number } = {}) {
  const db = getSupabaseServiceClient()
  const deadline = Date.now() + (options.budgetMs ?? 20000)
  let processed = 0
  while (processed < (options.limit ?? 10) && Date.now() < deadline) {
    const token = randomUUID()
    const { data, error } = await db.rpc('claim_inquiry_notification', { p_token: token, p_notification_id: options.notificationId })
    if (error) throw new Error('NOTIFICATION_CLAIM_FAILED')
    const row = data?.[0]
    if (!row) break
    await deliverNotification(row, token)
    processed++
  }
  return processed
}
