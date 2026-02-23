import { google } from 'googleapis'
import { buildCalendarEventId } from './idempotency'
import { addEmojiToTitle } from './emoji'
import type { CalendarEvent } from '../types'

const CALENDAR_ID = 'primary'

// Phase 1: insert の間隔 (120ms = 8.3 req/sec、上限10 req/sec に余裕)
const PHASE1_INTERVAL_MS = 120

// Phase 2: conflict の get+patch 間隔 (200ms = 5 req/sec)
const PHASE2_INTERVAL_MS = 200

interface BatchInsertResult {
  inserted: number
  skipped: number
}

type InsertOutcome =
  | { kind: 'inserted' }
  | { kind: 'conflict'; ev: CalendarEvent; eventId: string; displayTitle: string; descriptionText: string }
  | { kind: 'error' }

type ConflictOutcome = 'inserted' | 'skipped' | 'error'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

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
 * Phase 1: 1件の insert を試みる
 * 成功 → { kind: 'inserted' }
 * 409  → { kind: 'conflict', ... } (Phase 2 へ引き渡す)
 * その他エラー → { kind: 'error' }
 */
async function attemptInsert(
  calendar: ReturnType<typeof createCalendarClient>,
  ev: CalendarEvent,
  eventId: string,
  displayTitle: string,
  descriptionText: string,
): Promise<InsertOutcome> {
  try {
    await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        id:      eventId,
        summary: displayTitle,
        start:   { date: ev.date },
        end:     { date: ev.date },
        description: descriptionText,
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 720 }],
        },
      },
    })
    return { kind: 'inserted' }
  } catch (err) {
    const code = (err as { code?: number })?.code
    if (code === 409) {
      return { kind: 'conflict', ev, eventId, displayTitle, descriptionText }
    }
    console.error('[calendar] insert error:', err)
    return { kind: 'error' }
  }
}

/**
 * Phase 2: 409 だったイベントを get で状態確認し、
 * cancelled なら patch で再アクティブ化、confirmed なら skip
 */
async function handleConflict(
  calendar: ReturnType<typeof createCalendarClient>,
  ev: CalendarEvent,
  eventId: string,
  displayTitle: string,
  descriptionText: string,
): Promise<ConflictOutcome> {
  try {
    const existing = await calendar.events.get({ calendarId: CALENDAR_ID, eventId })
    if (existing.data.status === 'cancelled') {
      // delete は不可（410 Gone）なので patch で再アクティブ化
      await calendar.events.patch({
        calendarId: CALENDAR_ID,
        eventId,
        requestBody: {
          status:      'confirmed',
          summary:     displayTitle,
          start:       { date: ev.date },
          end:         { date: ev.date },
          description: descriptionText,
          reminders: {
            useDefault: false,
            overrides: [{ method: 'popup', minutes: 720 }],
          },
        },
      })
      return 'inserted'
    }
    return 'skipped' // アクティブな真の重複
  } catch (err) {
    console.error('[calendar] conflict handler error:', err)
    return 'error'
  }
}

/**
 * Google Calendar API にイベントを2フェーズ逐次で登録する
 *
 * Phase 1: 全件を120ms間隔で逐次 insert (8.3 req/sec、レート制限10 req/sec以内)
 * Phase 2: 409 だったものだけ200ms間隔で逐次 get→patch
 *
 * 冪等性: イベント ID に buildCalendarEventId() で生成した固定ハッシュを使用。
 * 絵文字: displayTitle に付与するが、ID 生成にはオリジナルタイトルを使う。
 */
export async function batchInsertGarbageEvents(
  accessToken: string,
  events: CalendarEvent[],
  pdfHash: string,
): Promise<BatchInsertResult> {
  const calendar = createCalendarClient(accessToken)

  // 各イベントのメタデータを事前計算
  const items = events.map((ev) => {
    const eventId      = buildCalendarEventId({ date: ev.date, garbageType: ev.title })
    const displayTitle = addEmojiToTitle(ev.title)
    const descriptionText = ev.description
      ? `${ev.description}\n\nゴミカレアプリにより自動登録 (PDF: ${pdfHash.slice(0, 8)}...)`
      : `ゴミカレアプリにより自動登録 (PDF: ${pdfHash.slice(0, 8)}...)`
    return { ev, eventId, displayTitle, descriptionText }
  })

  // ── Phase 1: 逐次 insert ──────────────────────────────────────
  let inserted = 0
  let skipped  = 0
  const conflicts: Array<{ ev: CalendarEvent; eventId: string; displayTitle: string; descriptionText: string }> = []

  for (let i = 0; i < items.length; i++) {
    const item    = items[i]
    const outcome = await attemptInsert(
      calendar, item.ev, item.eventId, item.displayTitle, item.descriptionText,
    )
    if (outcome.kind === 'inserted') {
      inserted++
    } else if (outcome.kind === 'conflict') {
      conflicts.push({
        ev:              outcome.ev,
        eventId:         outcome.eventId,
        displayTitle:    outcome.displayTitle,
        descriptionText: outcome.descriptionText,
      })
    } else {
      skipped++
    }
    if (i < items.length - 1) await sleep(PHASE1_INTERVAL_MS)
  }

  // ── Phase 2: 409 だったもののみ get→patch (逐次) ───────────────
  for (let i = 0; i < conflicts.length; i++) {
    const item    = conflicts[i]
    const outcome = await handleConflict(
      calendar, item.ev, item.eventId, item.displayTitle, item.descriptionText,
    )
    if (outcome === 'inserted') inserted++
    else skipped++
    if (i < conflicts.length - 1) await sleep(PHASE2_INTERVAL_MS)
  }

  return { inserted, skipped }
}
