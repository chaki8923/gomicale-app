import { NextRequest, NextResponse } from 'next/server'
import { validateSignature } from '@line/bot-sdk'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ============================================================
// 型定義
// ============================================================

type LineEventSource = { type: string; userId?: string }

type LineTextMessage = {
  type: 'text'
  id: string
  text: string
}

type LineImageMessage = {
  type: 'image'
  id: string
}

type LineMessageEvent = {
  type: 'message'
  replyToken: string
  source: LineEventSource
  message: LineTextMessage | LineImageMessage
}

type LineOtherEvent = {
  type: Exclude<string, 'message'>
  replyToken?: string
  source: LineEventSource
}

type LineEvent = LineMessageEvent | LineOtherEvent

type LineWebhookBody = {
  events: LineEvent[]
  destination?: string
}

type CalendarEvent = {
  date: string
  title: string
  description?: string
}

// ============================================================
// LINE Messaging API helpers
// ============================================================

async function replyText(replyToken: string, text: string): Promise<void> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!accessToken) return

  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  })
}

/**
 * LINE Content API から画像バイナリを取得し base64 に変換する
 */
async function fetchImageAsBase64(messageId: string): Promise<{ base64: string; mimeType: string } | null> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!accessToken) return null

  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) return null
  const buffer = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  return { base64: Buffer.from(buffer).toString('base64'), mimeType: contentType }
}

// ============================================================
// Gemini 分類ロジック
// ============================================================

function buildPrompt(events: CalendarEvent[], query: string, today: string): string {
  const today_dt = new Date(today)
  const upcoming = events
    .filter((ev) => new Date(ev.date) >= today_dt)
    .sort((a, b) => a.date.localeCompare(b.date))
  const categories = [...new Set(events.map((ev) => ev.title))].join('、')
  const scheduleText = upcoming
    .slice(0, 200)
    .map((ev) => `${ev.date} ${ev.title}${ev.description ? `（${ev.description}）` : ''}`)
    .join('\n')

  return `あなたはゴミ分別の専門家です。
以下のゴミ収集カレンダーをもとに、ユーザーが入力したアイテムが何のゴミに分類されるかと、直近の収集日を2件教えてください。

## このカレンダーに登録されているゴミの種別
${categories}

## 今日以降の収集スケジュール（上から最大200件）
${scheduleText}

## ユーザーの質問
「${query}」

## 回答ルール
- 上記カレンダーに存在する収集種別の中から最も適切な1つを選ぶこと
- カレンダーに該当する種別がない場合や、自動車・大型家電などの粗大ごみ・収集不可なアイテムの場合は、categoryに「判定不可（お住まいの自治体にお問い合わせください）」、nextDatesを空配列にしてください。
- 直近の収集日はカレンダーから「今日（${today}）以降」で最も近い2件を選ぶこと
- 以下のJSON形式のみで返すこと（説明文不要）

{
  "category": "収集種別名",
  "nextDates": [
    { "date": "YYYY-MM-DD", "title": "収集種別名" },
    { "date": "YYYY-MM-DD", "title": "収集種別名" }
  ]
}`
}

async function classifyWithGemini(
  events: CalendarEvent[],
  query: string,
  imageBase64?: string,
  imageMimeType?: string
): Promise<{ category: string; nextDates: { date: string; title: string }[] } | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const today = new Date().toISOString().slice(0, 10)
  const prompt = buildPrompt(events, query, today)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_CLASSIFY_MODEL ?? 'gemini-3-flash-preview',
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  })

  const parts: Parameters<typeof model.generateContent>[0] = []

  if (imageBase64 && imageMimeType) {
    parts.push({ inlineData: { mimeType: imageMimeType as 'image/jpeg', data: imageBase64 } })
    parts.push({
      text: query
        ? `${prompt}\n\n上記の画像のアイテムについて回答してください。ユーザーの補足: ${query}`
        : `${prompt}\n\n上記の画像に写っているアイテムのゴミ分類を回答してください。`,
    })
  } else {
    parts.push({ text: prompt })
  }

  const result = await model.generateContent(parts)
  const text = result.response.text().trim()

  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

// ============================================================
// イベントハンドラ
// ============================================================

async function handleMessageEvent(event: LineMessageEvent) {
  const lineUserId = event.source.userId
  if (!lineUserId || !event.replyToken) return

  const serviceClient = getSupabaseServiceClient()

  // ============================================================
  // 1. 6桁コードによるアカウント連携
  // ============================================================
  if (event.message.type === 'text') {
    const text = event.message.text.trim()

    if (/^\d{6}$/.test(text)) {
      const now = new Date().toISOString()
      const { data: linkCode } = await serviceClient
        .from('line_link_codes')
        .select('id, user_id, expires_at, used_at')
        .eq('code', text)
        .single()

      if (!linkCode) {
        await replyText(event.replyToken, 'コードが見つかりませんでした。ゴミカレのダッシュボードで新しいコードを発行してください。')
        return
      }
      if (linkCode.used_at) {
        await replyText(event.replyToken, 'このコードはすでに使用済みです。ゴミカレのダッシュボードで新しいコードを発行してください。')
        return
      }
      if (new Date(linkCode.expires_at) < new Date(now)) {
        await replyText(event.replyToken, 'コードの有効期限が切れています。ゴミカレのダッシュボードで新しいコードを発行してください。')
        return
      }

      // user_integrations に line_user_id を保存（upsert）
      await serviceClient
        .from('user_integrations')
        .upsert({ user_id: linkCode.user_id, line_user_id: lineUserId }, { onConflict: 'user_id' })

      // コードを使用済みにする
      await serviceClient
        .from('line_link_codes')
        .update({ used_at: now })
        .eq('id', linkCode.id)

      await replyText(event.replyToken, '✅ ゴミカレとのLINE連携が完了しました！\n\nこれからはLINEでゴミの分別を調べられます。\n例：「ペットボトル」「電池」と送ってみてください 🗑️')
      return
    }
  }

  // ============================================================
  // 2. ゴミ分類
  // ============================================================

  // LINE ユーザーIDからゴミカレのユーザーを特定
  const { data: integration } = await serviceClient
    .from('user_integrations')
    .select('user_id')
    .eq('line_user_id', lineUserId)
    .single()

  if (!integration) {
    await replyText(
      event.replyToken,
      'まだゴミカレと連携されていません。\nゴミカレのダッシュボード（https://gomicale.jp/dashboard）にアクセスし、「LINEと連携」から6桁のコードを取得して送信してください。'
    )
    return
  }

  const userId = integration.user_id

  // ユーザーの最新ゴミカレジョブを取得
  const { data: job } = await serviceClient
    .from('jobs')
    .select('pdf_hash, parser_mode')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .or('parser_mode.eq.garbage,parser_mode.is.null')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!job?.pdf_hash) {
    await replyText(
      event.replyToken,
      'ゴミ出しカレンダーが登録されていません。\nゴミカレ（https://gomicale.jp/dashboard）でPDFをアップロードしてください。'
    )
    return
  }

  // parsed_pdfs から extracted_json を取得
  let parsedData = await serviceClient
    .from('parsed_pdfs')
    .select('extracted_json')
    .eq('pdf_hash', `${job.pdf_hash}_ja`)
    .single()

  if (!parsedData.data) {
    parsedData = await serviceClient
      .from('parsed_pdfs')
      .select('extracted_json')
      .eq('pdf_hash', job.pdf_hash)
      .single()
  }

  if (!parsedData.data) {
    await replyText(event.replyToken, 'カレンダーデータの取得に失敗しました。')
    return
  }

  const extracted = parsedData.data.extracted_json as any
  const events_data: CalendarEvent[] = Array.isArray(extracted)
    ? extracted
    : (extracted?.events || [])

  if (!events_data || events_data.length === 0) {
    await replyText(event.replyToken, 'カレンダーにデータが見つかりませんでした。')
    return
  }

  let query = ''
  let imageBase64: string | undefined
  let imageMimeType: string | undefined

  if (event.message.type === 'text') {
    query = event.message.text.trim()
  } else if (event.message.type === 'image') {
    const img = await fetchImageAsBase64(event.message.id)
    if (img) {
      imageBase64 = img.base64
      imageMimeType = img.mimeType
    }
  }

  const classifyResult = await classifyWithGemini(events_data, query, imageBase64, imageMimeType)

  if (!classifyResult) {
    await replyText(event.replyToken, 'ゴミの分類に失敗しました。もう一度お試しください。')
    return
  }

  const { category, nextDates } = classifyResult

  let replyMessage = `🗑️ 分類：${category}`
  if (nextDates && nextDates.length > 0) {
    const dateLines = nextDates
      .map((d) => {
        const dt = new Date(d.date)
        const formatted = dt.toLocaleDateString('ja-JP', {
          month: 'long',
          day: 'numeric',
          weekday: 'short',
          timeZone: 'Asia/Tokyo',
        })
        return `📅 ${formatted}（${d.title}）`
      })
      .join('\n')
    replyMessage += `\n\n直近の収集日：\n${dateLines}`
  } else {
    replyMessage += '\n\n⚠️ お住まいの自治体にお問い合わせください。'
  }

  await replyText(event.replyToken, replyMessage)
}

// ============================================================
// Route Handler
// ============================================================

export async function POST(request: NextRequest) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  if (!channelSecret) {
    return NextResponse.json({ error: 'LINE not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature') ?? ''

  // LINE 署名検証
  if (!validateSignature(rawBody, channelSecret, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as LineWebhookBody

  // イベントを並列処理（reply token は各イベントで独立）
  await Promise.all(
    body.events.map(async (event) => {
      try {
        if (event.type === 'message') {
          await handleMessageEvent(event as LineMessageEvent)
        }
      } catch (err) {
        console.error('LINE webhook event error:', err)
      }
    })
  )

  return NextResponse.json({ ok: true })
}
