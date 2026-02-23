import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { Resend } from 'resend'
import type { LambdaPayload } from './types'
import { createPdfParser } from './parsers/factory'
import { refreshAccessToken, batchInsertGarbageEvents } from './calendar/client'

const APP_URL = process.env.APP_URL ?? 'https://gomicale-app.vercel.app'

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
        <a href="${APP_URL}/dashboard"
           style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">
          ダッシュボードで確認する
        </a>
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
        <a href="${APP_URL}/dashboard"
           style="display:inline-block;background:#6b7280;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">
          ダッシュボードで確認する
        </a>
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
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
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
  const { jobId, userId, r2ObjectKey } = event
  console.info('[handler] start', { jobId, userId, r2ObjectKey })

  try {
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

    // ── 2. PDF ハッシュ計算 ────────────────────────────────────────
    const pdfHash = createHash('sha256').update(pdfBuffer).digest('hex')
    console.info('[handler] pdfHash:', pdfHash)

    // ── 3. キャッシュチェック（再解析防止） ──────────────────────
    let events
    const { data: cached } = await supabase
      .from('parsed_pdfs')
      .select('extracted_json')
      .eq('pdf_hash', pdfHash)
      .maybeSingle()

    if (cached) {
      console.info('[handler] cache hit, skip parsing')
      events = cached.extracted_json
    } else {
      // ── 4. LLM で PDF 解析（Strategy パターン） ──────────────────
      const parser = createPdfParser(event.parserMode ?? 'garbage')
      events = await parser.parse(pdfBuffer)
      console.info('[handler] parsed events count:', events.length)

      // 解析結果をキャッシュに保存
      await supabase.from('parsed_pdfs').upsert({
        pdf_hash: pdfHash,
        extracted_json: events,
      })
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
    )
    console.info('[handler] calendar insert result:', { inserted, skipped })

    // ── 8. ジョブを completed に更新 ──────────────────────────────
    await supabase.from('jobs').update({
      status: 'completed',
      pdf_hash: pdfHash,
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
    const message = err instanceof Error ? err.message : String(err)
    console.error('[handler] error:', message, err)

    // ジョブを error に更新
    await supabase.from('jobs').update({
      status: 'error',
      error_message: message,
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
