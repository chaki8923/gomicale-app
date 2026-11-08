import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { sendReadyEmail, dispatchConfirmedImport, ImportFollowupError, escapeHtml } from './import-followup'
import { createSourceEvents, type CalendarImport } from '../../shared/calendar-import'
import { isAccountActive } from '../../shared/account-lifecycle'
import { getOwnedCalendars, GoogleAccessError } from '../../shared/google-calendars'
import { createHash, randomUUID } from 'crypto'
import { Resend } from 'resend'
import type { LambdaPayload, CalendarEvent } from './types'
import { createPdfParser } from './parsers/factory'
import { parseManualGarbageInstruction } from './parsers/gemini'
import { NotACalendarError } from './parsers/base'
import {
  refreshAccessToken,
  batchInsertGarbageEvents,
  CalendarIntegrationError,
  ImportTimeBudgetError,
  type CalendarIntegrationErrorCode,
} from './calendar/client'

const APP_URL = process.env.APP_URL ?? 'https://gomicale.jp'

// オブジェクトキーの拡張子から MIME タイプを判定するためのマップ
const MIME_BY_EXT: Record<string, string> = {
  pdf:  'application/pdf',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
}

// R2 のオブジェクトキー / Content-Type から Gemini に渡す MIME タイプを決定する
function resolveMimeType(objectKey: string, contentType?: string): string {
  if (contentType && Object.values(MIME_BY_EXT).includes(contentType)) {
    return contentType
  }
  const ext = objectKey.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/pdf'
}

type JobErrorCode =
  | CalendarIntegrationErrorCode
  | 'NOT_A_CALENDAR'
  | 'GEMINI_TEMPORARY'
  | 'GEMINI_PARSE_ERROR'
  | 'UNKNOWN'

// LINE 連携済みかどうかを確認する（user_integrations と line_links の両方を確認）
async function isLineLinked(userId: string): Promise<boolean> {
  try {
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('line_user_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (integration?.line_user_id) return true

    const { data: lineLink } = await supabase
      .from('line_links')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    return !!lineLink
  } catch (err) {
    console.warn('[isLineLinked] error, assuming not linked:', err)
    return false
  }
}

// LINE 連携用6桁コードをメール向けに発行する（有効期限24時間）
async function issueLineLinkCode(userId: string): Promise<string | null> {
  try {
    // 既存コードを削除（1ユーザー1コード）
    await supabase
      .from('line_link_codes')
      .delete()
      .eq('user_id', userId)

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24時間後

    const { data, error } = await supabase
      .from('line_link_codes')
      .insert({ user_id: userId, code, expires_at: expiresAt })
      .select('code')
      .single()

    if (error || !data) {
      console.warn('[issueLineLinkCode] insert failed:', error?.message)
      return null
    }
    return data.code
  } catch (err) {
    console.warn('[issueLineLinkCode] error:', err)
    return null
  }
}

async function sendCompletionEmail(
  toEmail: string,
  inserted: number,
  skipped: number,
  lineLinkCode?: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.APP_FROM_EMAIL ?? 'ゴミカレ <noreply@gomicale.jp>'
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set, skipping email')
    return
  }

  const lineBotAddUrl = process.env.LINE_BOT_ADD_URL ?? 'https://lin.ee/4F3CioD'

  const lineSectionHtml = lineLinkCode ? `
        <div style="border:1px solid #d1fae5;border-radius:8px;padding:16px;margin-top:16px;background:#f0fdf4">
          <p style="margin:0 0 8px;color:#065f46;font-size:14px;font-weight:bold">LINEでゴミ分別・収集日通知を受け取る</p>
          <p style="margin:0 0 12px;color:#374151;font-size:13px;line-height:1.6">
            ゴミカレのLINE Botと連携すると、写真や文字を送るだけでゴミの分類と次回の収集日をすぐにお知らせします。
          </p>
          <div style="text-align:center;margin-bottom:12px">
            <a href="${lineBotAddUrl}"
              style="display:inline-block;background:#06c755;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:bold">
              LINE Botを友だち追加する
            </a>
          </div>
          <div style="background:#fff;border:1px solid #d1fae5;border-radius:8px;padding:12px;text-align:center;margin-bottom:10px">
            <p style="margin:0 0 4px;color:#6b7280;font-size:11px">連携コード（友だち追加後にBotへ送信）</p>
            <p style="margin:0;color:#0d9488;font-size:32px;font-weight:bold;letter-spacing:6px">${lineLinkCode}</p>
          </div>
          <ol style="margin:0;padding-left:18px;color:#374151;font-size:12px;line-height:1.8">
            <li>上のボタンからゴミカレ LINE Botを友だち追加</li>
            <li>LINEのトーク画面で上の6桁コードを送信</li>
            <li>連携完了！写真やテキストを送るだけでゴミ分別できます</li>
          </ol>
          <p style="margin:10px 0 0;color:#9ca3af;font-size:11px;text-align:right">※ コードの有効期限は24時間です</p>
        </div>
  ` : ''

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: 'ゴミカレ - カレンダー登録が完了しました',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0d9488;margin-bottom:8px">Googleカレンダーへの登録が完了しました</h2>
        <p style="color:#374151;margin-bottom:16px">
          アップロードされたPDFの解析と、Googleカレンダーへの予定登録が完了しました。
        </p>
        <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:16px">
          <p style="margin:0;color:#065f46;font-size:18px;font-weight:bold">${inserted}件 登録完了</p>
          ${skipped > 0 ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px">（${skipped}件は既存のためスキップ）</p>` : ''}
        </div>
        ${lineSectionHtml}
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:16px;text-align:center">
        <p style="margin:0 0 4px;color:#374151;font-size:14px;font-weight:bold">
        このサービスが役に立ちましたか？
        </p>
        <p style="margin:0 0 12px;color:#6b7280;font-size:12px">
        開発継続のためのご支援をいただけると嬉しいです
        </p>
        <a href="${APP_URL}/ja/donate"
        style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:bold">
        おばさんに寄付する❤️
        </a>
        </div>
        <div style="text-align:center;">
          <img
            src="${APP_URL}/seiza_oba.png"
            alt="ゴミカレキャラクター"
            width="640"
            height="420"
            style="display:block;width:90%;max-width:100%;height:auto;aspect-ratio:640/420;margin:0 auto"
          />
        </div>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">ゴミカレ</p>
      </div>
    `,
  })
  if (error) {
    console.warn('[email] send error:', error)
  } else {
    console.info('[email] completion email sent to', toEmail)
  }
}

async function sendErrorEmail(
  toEmail: string,
  errorMessage: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.APP_FROM_EMAIL ?? 'ゴミカレ <noreply@gomicale.jp>'
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set, skipping email')
    return
  }
  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: 'ゴミカレ - カレンダー登録に失敗しました',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#dc2626;margin-bottom:8px">カレンダー登録でエラーが発生しました</h2>
        <p style="color:#374151;margin-bottom:16px">
          PDFの解析またはGoogleカレンダーへの登録中にエラーが発生しました。
        </p>
        <div style="background:#fef2f2;border-radius:8px;padding:16px;margin-bottom:16px">
          <p style="margin:0;color:#991b1b;font-size:13px;word-break:break-all">${escapeHtml(errorMessage)}</p>
        </div>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">ゴミカレ</p>
      </div>
    `,
  })
  if (error) {
    console.warn('[email] send error:', error)
  } else {
    console.info('[email] error email sent to', toEmail)
  }
}

// JST 基準・4月開始の年度範囲を返す
function getCurrentFiscalYearRange(): { fiscalYearStart: string; fiscalYearEnd: string } {
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const year  = nowJst.getUTCFullYear()
  const month = nowJst.getUTCMonth() + 1
  const fiscalStartYear = month >= 4 ? year : year - 1
  return {
    fiscalYearStart: `${fiscalStartYear}-04-01`,
    fiscalYearEnd:   `${fiscalStartYear + 1}-03-31`,
  }
}

// Cloudflare R2 は S3 互換 API を使用
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// Supabase Service Role クライアント (RLS バイパス)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function dispatchRegistration(review: CalendarImport): Promise<void> {
  return dispatchConfirmedImport(supabase,review,APP_URL,async () => {
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(review.user_id)
      if (user?.email && await isAccountActive(supabase,review.user_id)) await sendErrorEmail(user.email,'登録を開始できませんでした。ダッシュボードの登録履歴から再試行してください。')
    } catch { console.warn('[dispatch] error notification failed') }
  })
}
async function runImportFollowup(review: CalendarImport, title: string | null): Promise<void> {
  if (review.registration_mode !== 'auto') return sendReadyEmail(supabase,review,title,APP_URL)
  return dispatchRegistration(review)
}

async function registerImport(event: LambdaPayload, context?: { getRemainingTimeInMillis(): number }): Promise<void> {
  const token = randomUUID()
  const { data, error: claimError } = await supabase.rpc('claim_calendar_import', { p_job_id: event.jobId, p_user_id: event.userId, p_token: token })
  if (claimError) throw claimError
  const review = data?.[0] as CalendarImport | undefined
  if (!review?.confirmed) return
  try {
    const { data: job, error: jobError } = await supabase.from('jobs').select('id,pdf_hash,parser_mode').eq('id', event.jobId).eq('user_id', event.userId).single()
    if (jobError || !job) throw new Error('Job not found')
    const { data: integration } = await supabase.from('user_integrations').select('google_refresh_token_enc').eq('user_id', event.userId).single()
    if (!integration?.google_refresh_token_enc) throw new CalendarIntegrationError('GOOGLE_REAUTH_REQUIRED', 'Google reauthentication required')
    const accessToken = await refreshAccessToken(integration.google_refresh_token_enc)
    if (review.registration_mode === 'auto') {
      if (review.confirmed.calendarId !== 'primary') throw new Error('CALENDAR_NOT_FOUND')
    } else {
      const calendars = await getOwnedCalendars(accessToken)
      if (!calendars.some(c => c.id === review.confirmed!.calendarId)) throw new Error('CALENDAR_NOT_FOUND')
    }
    const confirmed = review.confirmed
    const selected = confirmed.events.filter(e => e.included)
    await batchInsertGarbageEvents(accessToken, selected.slice(review.registered_count), job.pdf_hash ?? '',
      confirmed.eventTime ?? undefined, confirmed.timezone, confirmed.calendarId, undefined, {
        checkpoint: async count => {
          const { error } = await supabase.from('calendar_imports').update({ registered_count: review.registered_count+count })
            .eq('job_id',event.jobId).eq('lease_token',token)
          if (error) throw error
        }, shouldStop: () => !!context && context.getRemainingTimeInMillis() < 15000,
      })
    const { data: finished, error } = await supabase.rpc('finish_calendar_import', { p_job_id: event.jobId, p_token: token, p_count: selected.length })
    if (error) throw error
    if (!finished) return
    // Only the worker that commits success can issue codes or completion mail.
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(event.userId)
      if (user?.email && await isAccountActive(supabase,event.userId)) {
        const code = job.parser_mode === 'garbage' && !(await isLineLinked(event.userId)) ? (await issueLineLinkCode(event.userId)) ?? undefined : undefined
        await sendCompletionEmail(user.email, selected.length, 0, code)
      }
    } catch { console.warn('[register] completion notification failed') }
  } catch (error) {
    if (error instanceof ImportTimeBudgetError) {
      // Keep the immutable selection/checkpoint and continue with a fresh execution
      // budget, even if the user has already closed the browser.
      const { data: released, error: releaseError } = await supabase.from('calendar_imports').update({ lease_token: null, lease_until: null })
        .eq('job_id',event.jobId).eq('state','registering').eq('lease_token',token).select('*').maybeSingle()
      if (releaseError) throw releaseError
      if (released) await dispatchRegistration(released as CalendarImport)
      return
    }
    const message = error instanceof CalendarIntegrationError || error instanceof GoogleAccessError
      ? error.code : error instanceof Error ? error.message : 'Registration failed'
    const { data: failed } = await supabase.from('calendar_imports').update({ state: 'error', error: message, lease_token: null, lease_until: null })
      .eq('job_id', event.jobId).eq('state','registering').eq('lease_token',token).select('job_id').maybeSingle()
    if (failed) {
      await supabase.from('jobs').update({ status: 'error', error_message: message, result_data: { review_available: true, registration_mode: review.registration_mode } }).eq('id', event.jobId)
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(event.userId)
        if (user?.email && await isAccountActive(supabase,event.userId)) await sendErrorEmail(user.email,message)
      } catch { console.warn('[register] error notification failed') }
    }
    console.error('[register] failed', event.jobId, message)
  }
}

export const handler = async (event: LambdaPayload, context?: { getRemainingTimeInMillis(): number }): Promise<unknown> => {
  if (event.action === 'health') return { protocol: 'calendar-review-v1', revision: 4, readyEmailConfigured: !!process.env.RESEND_API_KEY, testSender: /@resend\.dev/i.test(process.env.APP_FROM_EMAIL ?? '') }
  if (!await isAccountActive(supabase,event.userId)) return
  if (event.action === 'register') return registerImport(event, context)
  if (event.action === 'analyze') {
    const { data: review } = await supabase.from('calendar_imports').select('*').eq('job_id',event.jobId).single()
    const { data: job } = await supabase.from('jobs').select('user_id,r2_object_key,pdf_title').eq('id',event.jobId).single()
    if (!review || review.user_id !== event.userId || job?.user_id !== event.userId || job.r2_object_key !== event.r2ObjectKey) return
    if (review.state === 'ready') return runImportFollowup(review as CalendarImport,job.pdf_title)
    if (review.state === 'registering' && review.registration_mode === 'auto') return runImportFollowup(review as CalendarImport,job.pdf_title)
    if (review.state !== 'analyzing') return
  }
  const {
    jobId,
    userId,
    r2ObjectKey,
    language = 'ja',
    eventTime,
    timezone,
    inputMode = 'pdf',
    manualInstruction,
    fiscalYearStart,
    fiscalYearEnd,
  } = event
  console.info('[handler] start', { jobId, userId, r2ObjectKey, language, eventTime, timezone, inputMode })

  // 判定されたカレンダー種別（後で DB に保存）
  let resolvedParserMode: 'garbage' | 'general' = 'garbage'

  try {
    let events: CalendarEvent[]
    let pdfTitle: string | undefined
    let pdfHash: string
    let typeColors: Record<string, string> = {}

    if (inputMode === 'manual') {
      if (!manualInstruction?.trim() || !fiscalYearStart || !fiscalYearEnd) {
        throw new Error('Manual instruction and fiscal year range are required')
      }

      pdfHash = createHash('sha256')
        .update(JSON.stringify({
          inputMode,
          manualInstruction: manualInstruction.trim(),
          fiscalYearStart,
          fiscalYearEnd,
          language,
        }))
        .digest('hex')
      console.info('[handler] manual hash:', pdfHash)

      const cacheKey = `${pdfHash}_${language}_colors_v1`
      const { data: cached } = await supabase
        .from('parsed_pdfs')
        .select('extracted_json')
        .eq('pdf_hash', cacheKey)
        .maybeSingle()

      if (cached) {
        console.info('[handler] manual cache hit, skip parsing')
        const parsedData = cached.extracted_json as { title?: string, events: CalendarEvent[], parserMode?: string, typeColors?: Record<string, string> }
        typeColors = parsedData.typeColors ?? {}
        events = parsedData.events || []
        pdfTitle = parsedData.title
        resolvedParserMode = 'garbage'
      } else {
        const parseResult = await parseManualGarbageInstruction(
          manualInstruction.trim(),
          fiscalYearStart,
          fiscalYearEnd,
          language,
        )
        typeColors = parseResult.typeColors ?? {}
        events = parseResult.events
        pdfTitle = parseResult.title
        resolvedParserMode = 'garbage'
        console.info('[handler] manual parsed events count:', events.length, 'title:', pdfTitle)

        await supabase.from('parsed_pdfs').upsert({
          pdf_hash: cacheKey,
          extracted_json: { title: pdfTitle, events, typeColors, parserMode: resolvedParserMode },
        })
      }

      if (events.length === 0) {
        throw new Error(
          language === 'en'
            ? 'No calendar events could be generated from the text instruction. Please make the rule more specific.'
            : '入力指示から登録できる予定を生成できませんでした。曜日や収集種別が分かるように、もう少し具体的に入力してください。',
        )
      }
    } else {
      // ── 1. R2 から PDF をダウンロード ──────────────────────────────
      const s3Response = await r2.send(
        new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: r2ObjectKey,
        }),
      )

      const pdfBuffer = Buffer.from(
        await s3Response.Body!.transformToByteArray(),
      )

      // アップロードされたファイルの MIME タイプを判定（PDF / 画像）
      const mimeType = resolveMimeType(r2ObjectKey, s3Response.ContentType)
      console.info('[handler] mimeType:', mimeType)

      // ── 2. ファイルハッシュ計算 ────────────────────────────────────
      pdfHash = createHash('sha256').update(pdfBuffer).digest('hex')
      console.info('[handler] pdfHash:', pdfHash)

      // ── 3. キャッシュチェック（再解析防止） ──────────────────────
      // 言語ごと・年度ごとに結果が異なるため、キーに language と fiscalYearStart を含める
      // （繰り返しルール展開は年度依存。格子カレンダーは年度関係なく安全側に倒す）
      const { fiscalYearStart: pdfFiscalStart, fiscalYearEnd: pdfFiscalEnd } = getCurrentFiscalYearRange()
      const cacheKey = `${pdfHash}_${language}_${pdfFiscalStart}_colors_v1`
      const { data: cached } = await supabase
        .from('parsed_pdfs')
        .select('extracted_json')
        .eq('pdf_hash', cacheKey)
        .maybeSingle()

      if (cached) {
        console.info('[handler] cache hit, skip parsing')
        const parsedData = cached.extracted_json as { title?: string, events: CalendarEvent[], parserMode?: string, typeColors?: Record<string, string> }
        if (Array.isArray(parsedData)) {
          // 古いキャッシュフォーマットへの後方互換（ゴミカレ既定）
          events = parsedData
          pdfTitle = undefined
          resolvedParserMode = 'garbage'
        } else {
          typeColors = parsedData.typeColors ?? {}
        events = parsedData.events || []
          pdfTitle = parsedData.title
          resolvedParserMode = (parsedData.parserMode === 'general' ? 'general' : 'garbage')
        }
      } else {
        // ── 4. LLM で PDF 解析（自動判定パーサー） ───────────────────
        // 年度範囲を渡すことで、繰り返しルール文章も具体日付に展開される
        const parser = createPdfParser(language, pdfFiscalStart, pdfFiscalEnd)
        const parseResult = await parser.parse(pdfBuffer, mimeType)
        typeColors = parseResult.typeColors ?? {}
        events = parseResult.events
        pdfTitle = parseResult.title
        resolvedParserMode = parseResult.parserMode ?? 'garbage'
        console.info('[handler] parsed events count:', events.length, 'title:', pdfTitle, 'mode:', resolvedParserMode)

        // 解析結果をキャッシュに保存（判定モードも含める）
        await supabase.from('parsed_pdfs').upsert({
          pdf_hash: cacheKey,
          extracted_json: { title: pdfTitle, events, typeColors, parserMode: resolvedParserMode },
        })
      }
    }

    if (event.action === 'analyze') {
      const sourceEvents = createSourceEvents(events, typeColors)
      if (!sourceEvents.length) throw new Error('No valid events were found')
      if (sourceEvents.length > 5000) throw new Error('Too many events. Please upload a shorter period.')
      const { error } = await supabase.rpc('prepare_calendar_review', { p_job_id: jobId, p_user_id: userId,
        p_events: sourceEvents, p_hash: pdfHash, p_title: pdfTitle ?? null, p_mode: resolvedParserMode })
      if (error) throw error
      const { data: prepared, error: preparedError } = await supabase.from('calendar_imports').select('*').eq('job_id',jobId).eq('user_id',userId).single()
      if (preparedError) throw new ImportFollowupError('PREPARED_IMPORT_LOAD_FAILED')
      await runImportFollowup(prepared as CalendarImport,pdfTitle ?? null)
      return // Review mode never writes events until confirmation; auto dispatches a fresh worker.
    }

    // ── 5. Supabase からリフレッシュトークンを取得 ────────────────
    const { data: integration, error: tokenError } = await supabase
      .from('user_integrations')
      .select('google_refresh_token_enc')
      .eq('user_id', userId)
      .single()

    if (tokenError || !integration?.google_refresh_token_enc) {
      throw new Error(`No Google refresh token for user: ${userId}`)
    }

    // ── 6. アクセストークンを更新 ─────────────────────────────────
    const accessToken = await refreshAccessToken(
      integration.google_refresh_token_enc,
    )

    // ── 7. Google Calendar にバッチ登録（冪等） ───────────────────
    const { inserted, skipped } = await batchInsertGarbageEvents(
      accessToken,
      events,
      pdfHash,
      eventTime,
      timezone,
    )
    console.info('[handler] calendar insert result:', { inserted, skipped })

    // ── 8. ジョブを completed に更新（判定されたカレンダー種別も保存）──
    await supabase.from('jobs').update({
      status: 'completed',
      pdf_hash: pdfHash,
      pdf_title: pdfTitle,
      parser_mode: resolvedParserMode,
      result_data: {
        calendar_event_count: inserted,
        skipped_count: skipped,
        pdf_hash: pdfHash,
      },
    }).eq('id', jobId)

    console.info('[handler] done', jobId)

    // ── 9. 完了通知メール送信（失敗してもジョブは成功扱い）──────
    try {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId)
      if (authUser?.email && await isAccountActive(supabase,userId)) {
        // ゴミ出しカレンダーかつ LINE 未連携のユーザーにのみコードを発行してメールに添付
        let lineLinkCode: string | undefined
        if (resolvedParserMode === 'garbage') {
          const linked = await isLineLinked(userId)
          if (!linked) {
            lineLinkCode = (await issueLineLinkCode(userId)) ?? undefined
          }
        }
        await sendCompletionEmail(authUser.email, inserted, skipped, lineLinkCode)
      }
    } catch (emailErr) {
      console.warn('[handler] email notification failed:', emailErr)
    }
  } catch (err) {
    if (err instanceof ImportFollowupError) throw err // Retry follow-up without repeating analysis.
    let message = err instanceof Error ? err.message : String(err)
    let errorCode: JobErrorCode = 'UNKNOWN'
    console.error('[handler] error:', message, err)

    if (err instanceof CalendarIntegrationError) {
      errorCode = err.code
    }

    // カレンダー形式でないファイルが送信された場合
    if (err instanceof NotACalendarError) {
      errorCode = 'NOT_A_CALENDAR'
      message = language === 'en'
        ? 'The uploaded file does not appear to be a calendar or schedule. Please upload a garbage collection calendar or event schedule (PDF or photo).'
        : 'カレンダー形式のファイルではありませんでした。ゴミ出しカレンダーや行事予定表などのPDF・写真をアップロードしてください。'
    }

    // Gemini APIの一時的なエラー（503やfetch failed）をユーザーフレンドリーなメッセージに書き換える
    if (message.includes('503 Service Unavailable') || message.includes('high demand') || message.includes('fetch failed')) {
      errorCode = 'GEMINI_TEMPORARY'
      message = language === 'en'
        ? 'AI server is currently experiencing high demand and is temporarily unavailable. Please wait a few minutes and try again.'
        : '現在AIサーバーが混み合っており、一時的に利用できない状態です。数分〜数十分ほど時間を置いてから再度お試しください。'
    }

    // Gemini レスポンスの JSON パース失敗（出力トークン超過による途中切れ等）
    if (err instanceof SyntaxError && message.includes('JSON at position')) {
      errorCode = 'GEMINI_PARSE_ERROR'
      message = language === 'en'
        ? 'The AI could not extract all events from this file. The calendar may contain too many entries. Please try uploading a file covering a shorter period.'
        : 'AIがファイルから予定を正常に抽出できませんでした。カレンダーの収集件数が多すぎる可能性があります。期間を絞ったファイルをお試しください。'
    }

    if (event.action === 'analyze') {
      const { data: failed } = await supabase.from('calendar_imports').update({ state: 'error', error: message })
        .eq('job_id',jobId).eq('user_id',userId).eq('state','analyzing').select('job_id').maybeSingle()
      if (!failed) return
    }
    // ジョブを error に更新
    await supabase.from('jobs').update({
      status: 'error',
      error_message: message,
      result_data: {
        error_code: errorCode,
      },
    }).eq('id', jobId)

    // エラー通知メール送信（失敗しても無視）
    try {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId)
      if (authUser?.email && await isAccountActive(supabase,userId)) {
        await sendErrorEmail(authUser.email, message)
      }
    } catch (emailErr) {
      console.warn('[handler] error email notification failed:', emailErr)
    }
  }
}
