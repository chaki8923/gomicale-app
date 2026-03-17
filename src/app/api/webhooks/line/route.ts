import { NextRequest, NextResponse } from 'next/server'
import { validateSignature } from '@line/bot-sdk'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { detectSodaiGomi, updateUserStreak, buildXShareUrl } from '@/lib/garbage-classify'
import { getSodaiGomiSearchUrl } from '@/lib/sodai-gomi-urls'

// ============================================================
// 型定義
// ============================================================

type LineEventSource = {
  type: string
  userId?: string
  groupId?: string
  roomId?: string
}

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

// ============================================================
// ユーティリティ関数
// ============================================================

const RICH_MENU_COMMANDS = {
  TODAY: '今日のゴミ',
  TOMORROW: '明日のゴミ',
} as const

function getCollectionsByDate(events: CalendarEvent[], dateStr: string, label: string): string {
  const items = events.filter((ev) => ev.date === dateStr)
  if (items.length === 0) return `${label}（${dateStr}）は収集はありません。`
  const lines = items.map((ev) => `・${ev.title}${ev.description ? `（${ev.description}）` : ''}`).join('\n')
  return `${label}（${dateStr}）の収集:\n${lines}`
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
以下のゴミ収集カレンダーをもとに、ユーザーが入力したアイテム（または画像）が何のゴミに分類されるかと、直近の収集日を2件教えてください。

## このカレンダーに登録されているゴミの種別
${categories}

## 今日以降の収集スケジュール（上から最大200件）
${scheduleText}

## ユーザーの質問
「${query}」

## 回答ルール
- 画像が添付されている場合は、AIが画像を解析して「何であるか（対象物の一般的な名称）」を \`itemName\` に記載すること。テキストのみの場合でも判別できた名称を記載すること。
- 上記カレンダーに存在する収集種別の中から最も適切な1つを選ぶこと
- カレンダーに該当する種別がない場合や、自動車・大型家電などの粗大ごみ・収集不可なアイテムの場合は、categoryに「判定不可（お住まいの自治体にお問い合わせください）」、nextDatesを空配列にしてください。
- 直近の収集日はカレンダーから「今日（${today}）以降」で最も近い2件を選ぶこと
- 以下のJSON形式のみで返すこと（説明文不要）

{
  "itemName": "画像または質問から判別した対象物の名前",
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
): Promise<{ itemName?: string; category: string; nextDates: { date: string; title: string }[] } | null> {
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

function getSourceId(source: LineEventSource): string | undefined {
  if (source.type === 'group' && source.groupId) return source.groupId
  if (source.type === 'room' && source.roomId) return source.roomId
  return source.userId
}

async function handleMessageEvent(event: LineMessageEvent) {
  const lineSourceId = getSourceId(event.source)
  if (!lineSourceId || !event.replyToken) return

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

      // line_links に line_source_id を保存（すでに他のユーザーに紐づいている場合はエラーにするか上書きするか）
      // 今回は upsert で「このトークルームを新しいユーザーに紐付け直す」挙動にする
      await serviceClient
        .from('line_links')
        .upsert({ user_id: linkCode.user_id, line_source_id: lineSourceId }, { onConflict: 'line_source_id' })

      // （後方互換性のため、個人の場合は user_integrations にも保存しておく）
      if (event.source.type === 'user' && event.source.userId) {
        await serviceClient
          .from('user_integrations')
          .upsert({ user_id: linkCode.user_id, line_user_id: event.source.userId }, { onConflict: 'user_id' })
      }

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
  // 2. カレンダーデータ取得（リッチメニュー・ゴミ分類共通）
  // ============================================================

  // LINE 送信元IDからゴミカレのユーザーを特定
  const { data: lineLink } = await serviceClient
    .from('line_links')
    .select('user_id')
    .eq('line_source_id', lineSourceId)
    .single()

  let userId: string

  if (lineLink) {
    userId = lineLink.user_id
  } else {
    // line_links にない場合、後方互換性のため user_integrations をフォールバックとして探す
    const { data: integration } = await serviceClient
      .from('user_integrations')
      .select('user_id')
      .eq('line_user_id', lineSourceId)
      .single()

    if (integration) {
      userId = integration.user_id
      // ついでに line_links にマイグレーションしておく
      await serviceClient
        .from('line_links')
        .upsert({ user_id: userId, line_source_id: lineSourceId }, { onConflict: 'line_source_id' })
    } else {
      await replyText(
        event.replyToken,
        'まだゴミカレと連携されていません。\nゴミカレのダッシュボード（https://gomicale.jp/dashboard）にアクセスし、「LINEと連携」から6桁のコードを取得して送信してください。'
      )
      return
    }
  }

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

  // ============================================================
  // 3. リッチメニュー（今日のゴミ / 明日のゴミ）
  // ============================================================
  if (event.message.type === 'text') {
    const text = event.message.text.trim()

    if (text === RICH_MENU_COMMANDS.TODAY || text === RICH_MENU_COMMANDS.TOMORROW) {
      const targetDate = new Date()
      // JSTの現在時刻を取得
      targetDate.setHours(targetDate.getHours() + 9)

      if (text === RICH_MENU_COMMANDS.TOMORROW) {
        targetDate.setDate(targetDate.getDate() + 1)
      }

      const dateStr = targetDate.toISOString().slice(0, 10)
      const label = text === RICH_MENU_COMMANDS.TODAY ? '今日' : '明日'

      const replyMessage = getCollectionsByDate(events_data, dateStr, label)
      await replyText(event.replyToken, replyMessage)
      return
    }
  }

  // ============================================================
  // 4. ゴミ分類 (Gemini)
  // ============================================================

  // Gemini 利用制限の確認 (1ユーザーにつき1日5回まで)
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const { data: usageLimit, error: usageError } = await serviceClient
    .from('gemini_usage_limits')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  // usageLimit が取得できない場合はエラー（レコードが存在しない場合は0回として扱うので、後で新規作成する）
  const currentCount = usageLimit ? usageLimit.count : 0

  if (currentCount >= 5) {
    await replyText(
      event.replyToken,
      '⚠️ 本日のAI画像判別機能の利用上限（5回）に達しました。\n\n「今日のゴミ」「明日のゴミ」などの検索機能は引き続きご利用いただけます。\nAI判別機能は明日またご利用ください。'
    )
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

  // Gemini呼び出し成功時、利用回数インクリメントとストリーク更新を並行実行
  const [, streakResult] = await Promise.allSettled([
    serviceClient
      .from('gemini_usage_limits')
      .upsert({ user_id: userId, date: today, count: currentCount + 1 }, { onConflict: 'user_id, date' }),
    updateUserStreak(serviceClient, userId),
  ])

  const streak = streakResult.status === 'fulfilled' ? streakResult.value : null

  const { itemName, category, nextDates } = classifyResult

  let replyMessage = ''
  if (itemName) {
    replyMessage += `📦 対象物：${itemName}\n`
  }
  replyMessage += `🗑️ 分類：${category}`

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
        return `・${formatted}（${d.title}）`
      })
      .join('\n')
    replyMessage += `\n\n直近の収集日：\n${dateLines}`
  }

  // ---- 粗大ゴミ判定 ----
  const isSodai = detectSodaiGomi(category, nextDates?.length ?? 0)
  if (isSodai) {
    replyMessage += `\n\n🚛 粗大ゴミ収集の申し込みはこちら:\n${getSodaiGomiSearchUrl('ja')}`
  } else if (!nextDates || nextDates.length === 0) {
    replyMessage += '\n\n⚠️ お住まいの自治体にお問い合わせください。'
  }

  // ---- ストリーク（2日連続以上の場合のみ表示）----
  if (streak && streak.current_streak >= 2) {
    replyMessage += `\n\n🔥 ${streak.current_streak}日連続！累計${streak.total_classifications}回`
  }

  // ---- SNS シェアリンク ----
  const firstDate = nextDates?.[0]
    ? new Date(nextDates[0].date).toLocaleDateString('ja-JP', {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
        timeZone: 'Asia/Tokyo',
      })
    : undefined

  const shareUrl = buildXShareUrl({ itemName, category, nextDate: firstDate, locale: 'ja' })
  replyMessage += `\n\n📢 Xでシェア:\n${shareUrl}`

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
