import { NextRequest, NextResponse } from 'next/server'
import { validateSignature } from '@line/bot-sdk'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { detectSodaiGomi, updateUserStreak, buildXShareUrl } from '@/lib/garbage-classify'
import { getSodaiGomiSearchUrl } from '@/lib/sodai-gomi-urls'

// ============================================================
// 型定義
// ============================================================

type Lang = 'ja' | 'en'

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

const RICH_MENU_COMMANDS_EN = {
  TODAY: "Today's Garbage",
  TOMORROW: "Tomorrow's Garbage",
} as const

function getCollectionsByDate(events: CalendarEvent[], dateStr: string, label: string, lang: Lang): string {
  const items = events.filter((ev) => ev.date === dateStr)
  if (lang === 'en') {
    if (items.length === 0) return `No collection on ${dateStr}.`
    const lines = items.map((ev) => `- ${ev.title}${ev.description ? ` (${ev.description})` : ''}`).join('\n')
    return `Collection on ${dateStr} (${label}):\n${lines}`
  }
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

/**
 * parsed_pdfs を _en → _ja → bare の順で検索し、イベントと言語を返す
 */
async function fetchParsedDataWithLang(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  pdfHash: string
): Promise<{ events: CalendarEvent[]; lang: Lang } | null> {
  // {hash}% の前方一致で一括取得（新形式 {hash}_{lang}_{fiscalYear}、旧形式 {hash}_{lang}、bare {hash} をすべて拾う）
  const { data: rows } = await supabase
    .from('parsed_pdfs')
    .select('pdf_hash, extracted_json')
    .like('pdf_hash', `${pdfHash}%`)
    .order('created_at', { ascending: false })

  if (!rows || rows.length === 0) return null

  // サフィックスから優先度と言語を決定（en=0 > ja=1 > bare=2、それ以外はスキップ）
  type Candidate = { priority: number; lang: Lang; extracted: unknown }
  const candidates: Candidate[] = []

  for (const row of rows) {
    const suffix = row.pdf_hash.slice(pdfHash.length)
    if (suffix.startsWith('_en')) {
      candidates.push({ priority: 0, lang: 'en', extracted: row.extracted_json })
    } else if (suffix.startsWith('_ja')) {
      candidates.push({ priority: 1, lang: 'ja', extracted: row.extracted_json })
    } else if (suffix === '') {
      candidates.push({ priority: 2, lang: 'ja', extracted: row.extracted_json })
    }
    // それ以外のサフィックスはスキップ
  }

  if (candidates.length === 0) return null

  // 最小優先度を採用（同点は created_at 降順で先頭の行を使う＝rows の順序で先に出てくるもの）
  candidates.sort((a, b) => a.priority - b.priority)
  const best = candidates[0]

  const extracted = best.extracted as unknown
  const events: CalendarEvent[] = Array.isArray(extracted)
    ? (extracted as CalendarEvent[])
    : ((extracted as { events?: CalendarEvent[] })?.events ?? [])

  return { events, lang: best.lang }
}

// ============================================================
// Gemini 分類ロジック
// ============================================================

function buildPrompt(events: CalendarEvent[], query: string, today: string, lang: Lang): string {
  const today_dt = new Date(today)
  const upcoming = events
    .filter((ev) => new Date(ev.date) >= today_dt)
    .sort((a, b) => a.date.localeCompare(b.date))
  const categories = [...new Set(events.map((ev) => ev.title))].join(lang === 'en' ? ', ' : '、')
  const scheduleText = upcoming
    .slice(0, 200)
    .map((ev) => `${ev.date} ${ev.title}${ev.description ? (lang === 'en' ? ` (${ev.description})` : `（${ev.description}）`) : ''}`)
    .join('\n')

  if (lang === 'en') {
    return `You are a garbage sorting expert.
Based on the collection calendar below, tell the user what category the item (or image) belongs to and provide the next 2 collection dates.

## Garbage categories in this calendar
${categories}

## Upcoming collection schedule (up to 200 entries from today)
${scheduleText}

## User's question
"${query}"

## Answer rules
- If an image is attached, analyze it and write the identified item name in \`itemName\`. For text-only queries, also write the recognized item name.
- Choose the single most appropriate category from the categories listed above.
- If no matching category exists, or if the item is bulky waste / cannot be collected regularly, set category to "Cannot classify (please contact your local municipality)" and nextDates to an empty array.
- Choose the 2 nearest collection dates on or after today (${today}) from the calendar.
- Return ONLY the following JSON (no explanation):

{
  "itemName": "name of the item from the image or question",
  "category": "collection category name",
  "nextDates": [
    { "date": "YYYY-MM-DD", "title": "collection category name" },
    { "date": "YYYY-MM-DD", "title": "collection category name" }
  ]
}`
  }

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
  lang: Lang,
  imageBase64?: string,
  imageMimeType?: string
): Promise<{ itemName?: string; category: string; nextDates: { date: string; title: string }[] } | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const today = new Date().toISOString().slice(0, 10)
  const prompt = buildPrompt(events, query, today, lang)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_CLASSIFY_MODEL ?? 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  })

  const parts: Parameters<typeof model.generateContent>[0] = []

  if (imageBase64 && imageMimeType) {
    parts.push({ inlineData: { mimeType: imageMimeType as 'image/jpeg', data: imageBase64 } })
    if (lang === 'en') {
      parts.push({
        text: query
          ? `${prompt}\n\nPlease answer about the item in the image above. User note: ${query}`
          : `${prompt}\n\nPlease classify the item shown in the image above.`,
      })
    } else {
      parts.push({
        text: query
          ? `${prompt}\n\n上記の画像のアイテムについて回答してください。ユーザーの補足: ${query}`
          : `${prompt}\n\n上記の画像に写っているアイテムのゴミ分類を回答してください。`,
      })
    }
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
        await replyText(
          event.replyToken,
          'Code not found. Please issue a new code from the GomiCale dashboard.\n\nコードが見つかりませんでした。ゴミカレのダッシュボードで新しいコードを発行してください。'
        )
        return
      }
      if (linkCode.used_at) {
        await replyText(
          event.replyToken,
          'This code has already been used. Please issue a new code from the GomiCale dashboard.\n\nこのコードはすでに使用済みです。ゴミカレのダッシュボードで新しいコードを発行してください。'
        )
        return
      }
      if (new Date(linkCode.expires_at) < new Date(now)) {
        await replyText(
          event.replyToken,
          'The code has expired. Please issue a new code from the GomiCale dashboard.\n\nコードの有効期限が切れています。ゴミカレのダッシュボードで新しいコードを発行してください。'
        )
        return
      }

      await serviceClient
        .from('line_links')
        .upsert({ user_id: linkCode.user_id, line_source_id: lineSourceId }, { onConflict: 'line_source_id' })

      if (event.source.type === 'user' && event.source.userId) {
        await serviceClient
          .from('user_integrations')
          .upsert({ user_id: linkCode.user_id, line_user_id: event.source.userId }, { onConflict: 'user_id' })
      }

      await serviceClient
        .from('line_link_codes')
        .update({ used_at: now })
        .eq('id', linkCode.id)

      await replyText(
        event.replyToken,
        '✅ GomiCale LINE integration complete!\n\nYou can now look up garbage sorting via LINE.\nTry sending "plastic bottle" or "battery" 🗑️\n\n✅ ゴミカレとのLINE連携が完了しました！\n\nこれからはLINEでゴミの分別を調べられます。\n例：「ペットボトル」「電池」と送ってみてください 🗑️'
      )
      return
    }
  }

  // ============================================================
  // 2. カレンダーデータ取得（リッチメニュー・ゴミ分類共通）
  // ============================================================

  const { data: lineLink } = await serviceClient
    .from('line_links')
    .select('user_id')
    .eq('line_source_id', lineSourceId)
    .single()

  let userId: string

  if (lineLink) {
    userId = lineLink.user_id
  } else {
    const { data: integration } = await serviceClient
      .from('user_integrations')
      .select('user_id')
      .eq('line_user_id', lineSourceId)
      .single()

    if (integration) {
      userId = integration.user_id
      await serviceClient
        .from('line_links')
        .upsert({ user_id: userId, line_source_id: lineSourceId }, { onConflict: 'line_source_id' })
    } else {
      await replyText(
        event.replyToken,
        'GomiCale is not linked yet.\nVisit https://gomicale.jp/dashboard, go to "LINE Integration", and send the 6-digit code here.\n\nまだゴミカレと連携されていません。\nゴミカレのダッシュボード（https://gomicale.jp/dashboard）にアクセスし、「LINEと連携」から6桁のコードを取得して送信してください。'
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
      'No garbage collection calendar registered.\nPlease upload a PDF at GomiCale: https://gomicale.jp/dashboard\n\nゴミ出しカレンダーが登録されていません。\nゴミカレ（https://gomicale.jp/dashboard）でPDFをアップロードしてください。'
    )
    return
  }

  // parsed_pdfs から _en → _ja → bare の順で取得し言語を判定
  const parsedResult = await fetchParsedDataWithLang(serviceClient, job.pdf_hash)

  if (!parsedResult) {
    await replyText(
      event.replyToken,
      'Failed to retrieve calendar data. / カレンダーデータの取得に失敗しました。'
    )
    return
  }

  const { events: events_data, lang } = parsedResult

  if (events_data.length === 0) {
    await replyText(
      event.replyToken,
      lang === 'en'
        ? 'No data found in the calendar.'
        : 'カレンダーにデータが見つかりませんでした。'
    )
    return
  }

  // ============================================================
  // 3. リッチメニュー（今日のゴミ / 明日のゴミ）
  // ============================================================
  if (event.message.type === 'text') {
    const text = event.message.text.trim()

    const isToday =
      text === RICH_MENU_COMMANDS.TODAY || text === RICH_MENU_COMMANDS_EN.TODAY
    const isTomorrow =
      text === RICH_MENU_COMMANDS.TOMORROW || text === RICH_MENU_COMMANDS_EN.TOMORROW

    if (isToday || isTomorrow) {
      const targetDate = new Date()
      targetDate.setHours(targetDate.getHours() + 9)
      if (isTomorrow) targetDate.setDate(targetDate.getDate() + 1)

      const dateStr = targetDate.toISOString().slice(0, 10)
      const label = lang === 'en'
        ? (isTomorrow ? 'Tomorrow' : 'Today')
        : (isTomorrow ? '明日' : '今日')

      const replyMessage = getCollectionsByDate(events_data, dateStr, label, lang)
      await replyText(event.replyToken, replyMessage)
      return
    }
  }

  // ============================================================
  // 4. ゴミ分類 (Gemini)
  // ============================================================

  const today = new Date().toISOString().slice(0, 10)
  const { data: usageLimit } = await serviceClient
    .from('gemini_usage_limits')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  const currentCount = usageLimit ? usageLimit.count : 0

  if (currentCount >= 5) {
    await replyText(
      event.replyToken,
      lang === 'en'
        ? "⚠️ You've reached today's AI classification limit (5 times).\n\nYou can still use 'Today's Garbage' and 'Tomorrow's Garbage'. AI classification will be available again tomorrow."
        : '⚠️ 本日のAI画像判別機能の利用上限（5回）に達しました。\n\n「今日のゴミ」「明日のゴミ」などの検索機能は引き続きご利用いただけます。\nAI判別機能は明日またご利用ください。'
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

  const classifyResult = await classifyWithGemini(events_data, query, lang, imageBase64, imageMimeType)

  if (!classifyResult) {
    await replyText(
      event.replyToken,
      lang === 'en'
        ? 'Failed to classify the item. Please try again.'
        : 'ゴミの分類に失敗しました。もう一度お試しください。'
    )
    return
  }

  // 利用回数インクリメントとストリーク更新を並行実行
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
    replyMessage += lang === 'en' ? `📦 Item: ${itemName}\n` : `📦 対象物：${itemName}\n`
  }
  replyMessage += lang === 'en' ? `🗑️ Category: ${category}` : `🗑️ 分類：${category}`

  if (nextDates && nextDates.length > 0) {
    const dateLines = nextDates
      .map((d) => {
        const dt = new Date(d.date)
        const formatted = lang === 'en'
          ? dt.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              weekday: 'short',
              timeZone: 'Asia/Tokyo',
            })
          : dt.toLocaleDateString('ja-JP', {
              month: 'long',
              day: 'numeric',
              weekday: 'short',
              timeZone: 'Asia/Tokyo',
            })
        return lang === 'en'
          ? `- ${formatted} (${d.title})`
          : `・${formatted}（${d.title}）`
      })
      .join('\n')
    replyMessage += lang === 'en'
      ? `\n\nNext collection dates:\n${dateLines}`
      : `\n\n直近の収集日：\n${dateLines}`
  }

  // ---- 粗大ゴミ判定 ----
  const isSodai = detectSodaiGomi(category, nextDates?.length ?? 0)
  if (isSodai) {
    replyMessage += lang === 'en'
      ? `\n\n🚛 For bulky waste collection:\n${getSodaiGomiSearchUrl('en')}`
      : `\n\n🚛 粗大ゴミ収集の申し込みはこちら:\n${getSodaiGomiSearchUrl('ja')}`
  } else if (!nextDates || nextDates.length === 0) {
    replyMessage += lang === 'en'
      ? '\n\n⚠️ Please contact your local municipality.'
      : '\n\n⚠️ お住まいの自治体にお問い合わせください。'
  }

  // ---- ストリーク（2日連続以上の場合のみ表示）----
  if (streak && streak.current_streak >= 2) {
    replyMessage += lang === 'en'
      ? `\n\n🔥 ${streak.current_streak}-day streak! Total: ${streak.total_classifications} times`
      : `\n\n🔥 ${streak.current_streak}日連続！累計${streak.total_classifications}回`
  }

  // ---- SNS シェアリンク ----
  const firstDate = nextDates?.[0]
    ? new Date(nextDates[0].date).toLocaleDateString(
        lang === 'en' ? 'en-US' : 'ja-JP',
        { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' }
      )
    : undefined

  const shareUrl = buildXShareUrl({ itemName, category, nextDate: firstDate, locale: lang })
  replyMessage += lang === 'en'
    ? `\n\n📢 Share on X:\n${shareUrl}`
    : `\n\n📢 Xでシェア:\n${shareUrl}`

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

  if (!validateSignature(rawBody, channelSecret, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as LineWebhookBody

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
