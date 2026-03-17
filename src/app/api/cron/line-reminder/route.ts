import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

type CalendarEvent = {
  date: string
  title: string
  description?: string
}

function getTomorrowJST(): string {
  const now = new Date()
  // Shift to JST then advance 1 day
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

export async function GET(request: NextRequest) {
  // Cron secret 検証（CRON_SECRET 未設定の場合は検証スキップ）
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const serviceClient = getSupabaseServiceClient()
  const tomorrowStr = getTomorrowJST()

  // LINE 連携済みユーザーを全取得
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
      // ユーザーの最新ゴミカレジョブを取得
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

      // parsed_pdfs からカレンダーデータ取得（ja → サフィックスなし の順）
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

      if (!parsedData.data) continue

      const extracted = parsedData.data.extracted_json as unknown
      const events: CalendarEvent[] = Array.isArray(extracted)
        ? (extracted as CalendarEvent[])
        : ((extracted as { events?: CalendarEvent[] })?.events ?? [])

      const tomorrowEvents = events.filter((ev) => ev.date === tomorrowStr)
      if (tomorrowEvents.length === 0) continue

      const lines = tomorrowEvents
        .map((ev) => `・${ev.title}${ev.description ? `（${ev.description}）` : ''}`)
        .join('\n')

      // 月2回以下の収集種別に希少フラグを付与（例: 段ボール）
      const hasRare = tomorrowEvents.some((ev) => {
        const monthCount = events.filter((e) => e.title === ev.title).length
        return monthCount <= 2
      })

      // お母さんスタイルのメッセージ
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

      const message = [
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
