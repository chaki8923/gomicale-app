import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import type { CalendarImport } from '../../shared/calendar-import'
import type { CalendarImportTask, ReadyEmailPayload } from '../../shared/calendar-import-task'

/** Thrown after analysis has committed, so async Lambda retries only its follow-up. */
export class ImportFollowupError extends Error {
  constructor(public code: string) { super(code); this.name = 'ImportFollowupError' }
}
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))
export function buildReadyEmail(email: string, jobId: string, language: 'ja'|'en', title: string | null, appUrl: string): ReadyEmailPayload {
  const url = `${appUrl.replace(/\/$/,'')}/${language}/jobs/${encodeURIComponent(jobId)}/review`
  const subject = language === 'en' ? '[GomiCale] Your calendar is ready to review' : '【ゴミカレ】解析が完了しました。内容を確認して登録してください'
  const text = language === 'en'
    ? `Your calendar has been analyzed and is ready to review.\n${title ?? ''}\n\nEvents have not been added to Google Calendar yet.\nChoose your calendar, check dates, names and colors, then press Import to Google Calendar.\n\nReview your calendar:\n${url}\n\nSign in with the Google account you used to upload the file. Your draft is saved so you can return later.`
    : `カレンダーの解析が完了し、確認の準備ができました。\n${title ?? ''}\n\nGoogleカレンダーへの登録はまだ行っていません。\n登録先・日付・予定名・色を確認し、「Googleカレンダーへ登録」を押してください。\n\n内容を確認して登録：\n${url}\n\nアップロード時と同じGoogleアカウントでログインしてください。確認内容は保存されているため、あとから再開できます。`
  return { from: process.env.APP_FROM_EMAIL ?? 'ゴミカレ <noreply@gomicale.jp>', to: email, subject, text,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px"><h2>${escapeHtml(subject)}</h2><p style="white-space:pre-line;line-height:1.8">${escapeHtml(text)}</p><a href="${escapeHtml(url)}" style="display:inline-block;background:#0f766e;color:white;padding:14px 20px;border-radius:10px;text-decoration:none">${language === 'en' ? 'Review and import' : '内容を確認して登録'}</a></div>` }
}
async function getTask(db: SupabaseClient, jobId: string): Promise<CalendarImportTask> {
  const { error } = await db.from('calendar_import_tasks').upsert({ job_id: jobId }, { onConflict: 'job_id', ignoreDuplicates: true })
  if (error) throw new ImportFollowupError('TASK_SAVE_FAILED')
  const { data, error: loadError } = await db.from('calendar_import_tasks').select('*').eq('job_id',jobId).single()
  if (loadError || !data) throw new ImportFollowupError('TASK_LOAD_FAILED')
  return data as CalendarImportTask
}
export async function sendReadyEmail(db: SupabaseClient, review: CalendarImport, title: string | null, appUrl: string): Promise<void> {
  if (review.registration_mode === 'auto' || review.state !== 'ready') return
  let task = await getTask(db, review.job_id)
  if (task.email_status === 'sent') return
  if (!task.email_payload) {
    const { data: { user }, error } = await db.auth.admin.getUserById(review.user_id)
    if (error || !user?.email) throw new ImportFollowupError('RECIPIENT_UNAVAILABLE')
    const payload = buildReadyEmail(user.email,review.job_id,review.language,title,appUrl)
    const { error: saveError } = await db.from('calendar_import_tasks').update({ email_payload: payload, email_first_attempt_at: new Date().toISOString() })
      .eq('job_id',review.job_id).is('email_payload',null)
    if (saveError) throw new ImportFollowupError('EMAIL_SAVE_FAILED')
    task = await getTask(db,review.job_id)
  }
  if (!task.email_payload || !task.email_first_attempt_at) throw new ImportFollowupError('EMAIL_SAVE_FAILED')
  // Resend retains keys for 24 hours. Never retry an unconfirmed older request.
  if (Date.now()-Date.parse(task.email_first_attempt_at) >= 24*60*60*1000) {
    await db.from('calendar_import_tasks').update({ email_status: 'failed', email_error_code: 'IDEMPOTENCY_EXPIRED' }).eq('job_id',review.job_id)
    return
  }
  try {
    if (!process.env.RESEND_API_KEY) throw new ImportFollowupError('EMAIL_NOT_CONFIGURED')
    const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send(task.email_payload, { idempotencyKey: `calendar-review-ready/${review.job_id}` })
    if (error || !data?.id) throw new ImportFollowupError('EMAIL_PROVIDER_REJECTED')
    const { error: saveError } = await db.from('calendar_import_tasks').update({ email_status: 'sent', email_provider_id: data.id, email_sent_at: new Date().toISOString(), email_error_code: null }).eq('job_id',review.job_id)
    if (saveError) throw new ImportFollowupError('EMAIL_RESULT_SAVE_FAILED')
  } catch (error) {
    const code = error instanceof ImportFollowupError ? error.code : 'EMAIL_DELIVERY_UNCONFIRMED'
    await db.from('calendar_import_tasks').update({ email_status: 'failed', email_error_code: code }).eq('job_id',review.job_id).neq('email_status','sent')
    throw new ImportFollowupError(code)
  }
}
export async function dispatchConfirmedImport(db: SupabaseClient, review: CalendarImport, appUrl: string, onTerminalFailure?: () => Promise<void>): Promise<void> {
  if (!review.confirmed || review.state !== 'registering') return
  const task = await getTask(db,review.job_id)
  const initialAttempts = task.dispatch_attempts ?? 0
  for (let attempts = initialAttempts; attempts < 3; attempts++) {
    try {
      const response = await fetch(`${appUrl.replace(/\/$/,'')}/api/internal/calendar-imports/dispatch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${task.dispatch_token}` },
        body: JSON.stringify({ jobId: review.job_id }), signal: AbortSignal.timeout(20000),
      })
      if (!response.ok) throw new ImportFollowupError('AUTO_DISPATCH_FAILED')
      return
    } catch {
      const next = attempts+1
      await db.from('calendar_import_tasks').update({ dispatch_attempts: next }).eq('job_id',review.job_id).eq('dispatch_attempts',attempts)
      if (next >= 3) {
        const { data: failed } = await db.from('calendar_imports').update({ state: 'error', error: 'AUTO_DISPATCH_FAILED' })
          .eq('job_id',review.job_id).eq('state','registering').is('lease_token',null).select('job_id').maybeSingle()
        if (failed) {
          await db.from('jobs').update({ status: 'error', error_message: 'AUTO_DISPATCH_FAILED', result_data: { review_available: true, registration_mode: 'auto' } }).eq('id',review.job_id)
          await onTerminalFailure?.()
        }
        throw new ImportFollowupError('AUTO_DISPATCH_FAILED')
      }
      await new Promise(resolve => setTimeout(resolve,500*next))
    }
  }
}
