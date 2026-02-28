import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type CalendarEvent = {
  date: string
  title: string
  description?: string
}

type ClassifyResult = {
  category: string
  nextDates: { date: string; title: string; description?: string }[]
}

function buildPrompt(
  events: CalendarEvent[],
  query: string,
  today: string
): string {
  const today_dt = new Date(today)

  // 今日以降のイベントに絞り、種別ごとにまとめてリストアップ
  const upcoming = events
    .filter((ev) => new Date(ev.date) >= today_dt)
    .sort((a, b) => a.date.localeCompare(b.date))

  // 種別一覧（重複除去）
  const categories = [...new Set(events.map((ev) => ev.title))].join('、')

  // 直近100件までに絞って渡す（トークン節約）
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

function buildPromptEn(
  events: CalendarEvent[],
  query: string,
  today: string
): string {
  const today_dt = new Date(today)

  const upcoming = events
    .filter((ev) => new Date(ev.date) >= today_dt)
    .sort((a, b) => a.date.localeCompare(b.date))

  const categories = [...new Set(events.map((ev) => ev.title))].join(', ')

  const scheduleText = upcoming
    .slice(0, 200)
    .map((ev) => `${ev.date} ${ev.title}${ev.description ? ` (${ev.description})` : ''}`)
    .join('\n')

  return `You are a garbage classification expert.
Based on the garbage collection calendar below, identify what type of garbage the user's item belongs to and give the next 2 collection dates.

## Categories in this calendar
${categories}

## Upcoming schedule (up to 200 entries)
${scheduleText}

## User's question
"${query}"

## Rules
- Choose the most appropriate category from those listed in the calendar
- If the item does not match any category in the calendar, or if it is uncollectible like cars or large appliances, set category to "Unclassifiable (Please contact your local municipality)" and nextDates to an empty array.
- Pick the 2 nearest upcoming dates from today (${today}) in the calendar
- Return ONLY the following JSON (no explanations)

{
  "category": "category name",
  "nextDates": [
    { "date": "YYYY-MM-DD", "title": "category name" },
    { "date": "YYYY-MM-DD", "title": "category name" }
  ]
}`
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // multipart/form-data でテキストと任意の画像を受け取る
  let query = ''
  let imageBase64: string | null = null
  let imageMimeType: string | null = null
  let locale = 'ja'

  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    query = (formData.get('query') as string) ?? ''
    locale = (formData.get('locale') as string) ?? 'ja'
    const imageFile = formData.get('image') as File | null
    if (imageFile && imageFile.size > 0) {
      const arrayBuffer = await imageFile.arrayBuffer()
      imageBase64 = Buffer.from(arrayBuffer).toString('base64')
      imageMimeType = imageFile.type || 'image/jpeg'
    }
  } else {
    const body = await request.json() as { query?: string; locale?: string }
    query = body.query ?? ''
    locale = body.locale ?? 'ja'
  }

  if (!query && !imageBase64) {
    return NextResponse.json({ error: 'query or image is required' }, { status: 400 })
  }

  // ユーザーの最新のゴミカレンダーjob（完了済み）を取得
  const { data: job } = await supabase
    .from('jobs')
    .select('pdf_hash, parser_mode')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .or('parser_mode.eq.garbage,parser_mode.is.null')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!job?.pdf_hash) {
    return NextResponse.json({ error: 'no_garbage_calendar' }, { status: 404 })
  }

  // parsed_pdfs から extracted_json を取得（_ja → _en の順でフォールバック）
  const hashWithLang = `${job.pdf_hash}_${locale}`
  const hashFallback = `${job.pdf_hash}_${locale === 'ja' ? 'en' : 'ja'}`

  let parsedData = await supabase
    .from('parsed_pdfs')
    .select('extracted_json')
    .eq('pdf_hash', hashWithLang)
    .single()

  if (!parsedData.data) {
    parsedData = await supabase
      .from('parsed_pdfs')
      .select('extracted_json')
      .eq('pdf_hash', hashFallback)
      .single()
  }

  // hash にサフィックスがないパターンにも対応
  if (!parsedData.data) {
    parsedData = await supabase
      .from('parsed_pdfs')
      .select('extracted_json')
      .eq('pdf_hash', job.pdf_hash)
      .single()
  }

  if (!parsedData.data) {
    return NextResponse.json({ error: 'no_garbage_calendar' }, { status: 404 })
  }

  const events = parsedData.data.extracted_json as CalendarEvent[]
  if (!events || events.length === 0) {
    return NextResponse.json({ error: 'no_garbage_calendar' }, { status: 404 })
  }

  // Gemini でゴミ分類
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const prompt = locale === 'en'
    ? buildPromptEn(events, query || '画像のアイテム', today)
    : buildPrompt(events, query || '画像のアイテム', today)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_CLASSIFY_MODEL ?? 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
    },
  })

  const parts: Parameters<typeof model.generateContent>[0] = []

  if (imageBase64 && imageMimeType) {
    parts.push({
      inlineData: {
        mimeType: imageMimeType as 'image/jpeg' | 'image/png' | 'image/webp',
        data: imageBase64,
      },
    })
    if (query) {
      parts.push({ text: `${prompt}\n\n上記の画像のアイテムについて回答してください。ユーザーの補足: ${query}` })
    } else {
      parts.push({ text: `${prompt}\n\n上記の画像に写っているアイテムのゴミ分類を回答してください。` })
    }
  } else {
    parts.push({ text: prompt })
  }

  const result = await model.generateContent(parts)
  const text = result.response.text().trim()

  let parsed: ClassifyResult
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found')
    parsed = JSON.parse(match[0]) as ClassifyResult
  } catch {
    return NextResponse.json({ error: 'parse_error', raw: text }, { status: 500 })
  }

  return NextResponse.json(parsed)
}
