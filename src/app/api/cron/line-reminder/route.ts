import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

type Lang = 'ja' | 'en'

type CalendarEvent = {
  date: string
  title: string
  description?: string
}

function getTomorrowJST(): string {
  const now = new Date()
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000
  const jstNow = new Date(jstMs)
  const tomorrow = new Date(jstNow)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return tomorrow.toISOString().slice(0, 10)
}

async function sendPushMessage(to: string, text: string): Promise<void> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!accessToken) return

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LINE push failed: ${res.status} ${body}`)
  }
}

/**
 * parsed_pdfs を _en → _ja → bare の順で検索し、イベントと言語を返す
 */
async function fetchParsedDataWithLang(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  pdfHash: string
): Promise<{ events: CalendarEvent[]; lang: Lang } | null> {
  for (const [suffix, lang] of [['_en', 'en'], ['_ja', 'ja'], ['', 'ja']] as [string, Lang][]) {
    const { data } = await supabase
      .from('parsed_pdfs')
      .select('extracted_json')
      .eq('pdf_hash', `${pdfHash}${suffix}`)
      .single()
    if (data) {
      const extracted = data.extracted_json as unknown
      const events: CalendarEvent[] = Array.isArray(extracted)
        ? (extracted as CalendarEvent[])
        : ((extracted as { events?: CalendarEvent[] })?.events ?? [])
      return { events, lang }
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const serviceClient = getSupabaseServiceClient()
  const tomorrowStr = getTomorrowJST()

  const { data: lineLinks, error } = await serviceClient
    .from('line_links')
    .select('user_id, line_source_id')

  if (error || !lineLinks || lineLinks.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, date: tomorrowStr })
  }

  let sentCount = 0
  const errors: string[] = []

  for (const link of lineLinks) {
    try {
      const { data: job } = await serviceClient
        .from('jobs')
        .select('pdf_hash, parser_mode')
        .eq('user_id', link.user_id)
        .eq('status', 'completed')
        .or('parser_mode.eq.garbage,parser_mode.is.null')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!job?.pdf_hash) continue

      const parsedResult = await fetchParsedDataWithLang(serviceClient, job.pdf_hash)
      if (!parsedResult) continue

      const { events, lang } = parsedResult

      const tomorrowEvents = events.filter((ev) => ev.date === tomorrowStr)
      if (tomorrowEvents.length === 0) continue

      const hasRare = tomorrowEvents.some((ev) => {
        const monthCount = events.filter((e) => e.title === ev.title).length
        return monthCount <= 2
      })

      let message: string

      if (lang === 'en') {
        const lines = tomorrowEvents
          .map((ev) => `- ${ev.title}${ev.description ? ` (${ev.description})` : ''}`)
          .join('\n')

        const openings = [
          "Hey! Don't forget to take out the trash tomorrow!",
          "Heads up! Tomorrow is garbage day — don't sleep through it.",
          "Just a reminder — trash goes out tomorrow morning!",
          "Don't forget: garbage day is tomorrow!",
          "Good work today! Reminder: trash goes out tomorrow 🗑️",
        ]
        const opening = openings[Math.floor(Math.random() * openings.length)]

        const closings = [
          "Don't forget to sort it properly!",
          "Seriously, don't miss it again!",
          "Set an alarm if you have to!",
          "You always cut it close in the morning — prep tonight!",
        ]
        const closing = closings[Math.floor(Math.random() * closings.length)]

        message = [
          opening,
          '',
          `📅 ${tomorrowStr} (Tomorrow) collection`,
          lines,
          hasRare ? '\n⚠️ This only happens a few times a month — absolutely do not miss it!' : '',
          '',
          closing,
        ]
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      } else {
        const lines = tomorrowEvents
          .map((ev) => `・${ev.title}${ev.description ? `（${ev.description}）` : ''}`)
          .join('\n')

        const openings = [
          'あんた！明日のゴミ出し忘れないでね！',
          'あら、明日なんのゴミの日か覚えてる？起きたら準備してね',
          '明日のゴミの準備はした？お母さん朝いないからよろしくね！',
          '明日のゴミ出し、ちゃんと覚えてるかしら？',
          '今日もおつかれ様！明日ゴミの日だから忘れないでね！',
        ]
        const opening = openings[Math.floor(Math.random() * openings.length)]

        const closings = [
          'ゴミ出し忘れたら臭くなるんだから気をつけてね！',
          'ちゃんと分別ルール守るのよアンタ！しょーもないんだから',
          '袋に入れて玄関置いときなさい！あんたどうせ忘れるんだから',
          'あんた朝いっつもギリギリなんだから準備しときなさいね！しょーもない',
        ]
        const closing = closings[Math.floor(Math.random() * closings.length)]

        message = [
          opening,
          '',
          `📅 ${tomorrowStr}（明日）の収集`,
          lines,
          hasRare ? '\n⚠️ 月数回しかない日だから絶対に忘れないでね！' : '',
          '',
          closing,
        ]
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      }

      await sendPushMessage(link.line_source_id, message)
      sentCount++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${link.line_source_id}: ${msg}`)
      console.error(`Failed to send LINE reminder to ${link.line_source_id}:`, err)
    }
  }

  return NextResponse.json({
    ok: true,
    sent: sentCount,
    total: lineLinks.length,
    date: tomorrowStr,
    ...(errors.length > 0 ? { errors } : {}),
  })
}
