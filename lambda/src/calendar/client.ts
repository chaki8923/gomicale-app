import { google } from 'googleapis'
import { buildCalendarEventId } from './idempotency'
import type { CalendarEvent } from '../types'

const CALENDAR_ID = 'primary'

// 1リクエストごとに待機するミリ秒（250ms = 4 req/sec、レート制限10 req/secに対して余裕）
const REQUEST_INTERVAL_MS = 250

interface BatchInsertResult {
  inserted: number
  skipped: number
}

/**
 * Google Calendar API クライアントを生成する
 */
export function createCalendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.calendar({ version: 'v3', auth })
}

/**
 * リフレッシュトークンからアクセストークンを取得する
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
  )
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const { credentials } = await oauth2Client.refreshAccessToken()
  if (!credentials.access_token) {
    throw new Error('Failed to refresh Google access token')
  }
  return credentials.access_token
}

/**
 * Google Calendar API にイベントを1件ずつ順番に登録する
 *
 * 冪等性: イベント ID に buildCalendarEventId() で生成した固定ハッシュを使用。
 * 同一イベントが既に存在する場合は 409 Conflict が返るが、それは正常として無視する。
 * レート制限対策として REQUEST_INTERVAL_MS ごとに1件ずつ処理する。
 */
export async function batchInsertGarbageEvents(
  accessToken: string,
  events: CalendarEvent[],
  pdfHash: string,
): Promise<BatchInsertResult> {
  const calendar = createCalendarClient(accessToken)

  let inserted = 0
  let skipped  = 0

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]

    const eventId = buildCalendarEventId({
      date:        ev.date,
      garbageType: ev.title,
    })

    try {
      await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: {
          id:      eventId,
          summary: ev.title,
          start:   { date: ev.date },
          end:     { date: ev.date },
          description: ev.description
            ? `${ev.description}\n\nゴミカレアプリにより自動登録 (PDF: ${pdfHash.slice(0, 8)}...)`
            : `ゴミカレアプリにより自動登録 (PDF: ${pdfHash.slice(0, 8)}...)`,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 720 },
            ],
          },
        },
      })
      inserted++
    } catch (err) {
      const code = (err as { code?: number })?.code
      if (code === 409) {
        skipped++
      } else {
        console.error('[calendar] insert error:', err)
        skipped++
      }
    }

    // 最後の1件以外は待機してレート制限を回避
    if (i < events.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS))
    }
  }

  return { inserted, skipped }
}
