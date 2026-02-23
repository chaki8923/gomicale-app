import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import type { LambdaPayload } from './types'
import { createPdfParser } from './parsers/factory'
import { refreshAccessToken, batchInsertGarbageEvents } from './calendar/client'

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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[handler] error:', message, err)

    // ジョブを error に更新
    await supabase.from('jobs').update({
      status: 'error',
      error_message: message,
    }).eq('id', jobId)
  }
}
