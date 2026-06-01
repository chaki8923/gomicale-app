import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { Resend } from 'resend'
import type { LambdaPayload, CalendarEvent } from './types'
import { createPdfParser } from './parsers/factory'
import { parseManualGarbageInstruction } from './parsers/gemini'
import { NotACalendarError } from './parsers/base'
import {
  refreshAccessToken,
  batchInsertGarbageEvents,
  CalendarIntegrationError,
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
  | 'UNKNOWN'

async function sendCompletionEmail(
  toEmail: string,
  inserted: number,
  skipped: number,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.APP_FROM_EMAIL ?? 'ゴミカレ <onboarding@resend.dev>'
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set, skipping email')
    return
  }
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
            style="display:block;width:90%;max-width:100%;margin:0 auto"
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
  const fromEmail = process.env.APP_FROM_EMAIL ?? 'ゴミカレ <onboarding@resend.dev>'
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
          <p style="margin:0;color:#991b1b;font-size:13px;word-break:break-all">${errorMessage}</p>
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

export const handler = async (event: LambdaPayload): Promise<void> => {
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

      const cacheKey = `${pdfHash}_${language}`
      const { data: cached } = await supabase
        .from('parsed_pdfs')
        .select('extracted_json')
        .eq('pdf_hash', cacheKey)
        .maybeSingle()

      if (cached) {
        console.info('[handler] manual cache hit, skip parsing')
        const parsedData = cached.extracted_json as { title?: string, events: CalendarEvent[], parserMode?: string }
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
        events = parseResult.events
        pdfTitle = parseResult.title
        resolvedParserMode = 'garbage'
        console.info('[handler] manual parsed events count:', events.length, 'title:', pdfTitle)

        await supabase.from('parsed_pdfs').upsert({
          pdf_hash: cacheKey,
          extracted_json: { title: pdfTitle, events, parserMode: resolvedParserMode },
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
      // 言語ごとに異なる解析結果になるため、キーに language を含める
      const cacheKey = `${pdfHash}_${language}`
      const { data: cached } = await supabase
        .from('parsed_pdfs')
        .select('extracted_json')
        .eq('pdf_hash', cacheKey)
        .maybeSingle()

      if (cached) {
        console.info('[handler] cache hit, skip parsing')
        const parsedData = cached.extracted_json as { title?: string, events: CalendarEvent[], parserMode?: string }
        if (Array.isArray(parsedData)) {
          // 古いキャッシュフォーマットへの後方互換（ゴミカレ既定）
          events = parsedData
          pdfTitle = undefined
          resolvedParserMode = 'garbage'
        } else {
          events = parsedData.events || []
          pdfTitle = parsedData.title
          resolvedParserMode = (parsedData.parserMode === 'general' ? 'general' : 'garbage')
        }
      } else {
        // ── 4. LLM で PDF 解析（自動判定パーサー） ───────────────────
        const parser = createPdfParser(language)
        const parseResult = await parser.parse(pdfBuffer, mimeType)
        events = parseResult.events
        pdfTitle = parseResult.title
        resolvedParserMode = parseResult.parserMode ?? 'garbage'
        console.info('[handler] parsed events count:', events.length, 'title:', pdfTitle, 'mode:', resolvedParserMode)

        // 解析結果をキャッシュに保存（判定モードも含める）
        await supabase.from('parsed_pdfs').upsert({
          pdf_hash: cacheKey,
          extracted_json: { title: pdfTitle, events, parserMode: resolvedParserMode },
        })
      }
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
      if (authUser?.email) {
        await sendCompletionEmail(authUser.email, inserted, skipped)
      }
    } catch (emailErr) {
      console.warn('[handler] email notification failed:', emailErr)
    }
  } catch (err) {
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
      if (authUser?.email) {
        await sendErrorEmail(authUser.email, message)
      }
    } catch (emailErr) {
      console.warn('[handler] error email notification failed:', emailErr)
    }
  }
}
