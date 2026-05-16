import { google } from 'googleapis'
import { buildCalendarEventId } from './idempotency'
import { addEmojiToTitle } from './emoji'
import type { CalendarEvent } from '../types'

const CALENDAR_ID = 'primary'

export type CalendarIntegrationErrorCode =
  | 'GOOGLE_REAUTH_REQUIRED'
  | 'GOOGLE_CALENDAR_SCOPE_MISSING'
  | 'GOOGLE_CALENDAR_PERMISSION_DENIED'
  | 'GOOGLE_CALENDAR_RATE_LIMIT'
  | 'GOOGLE_API_TEMPORARY'
  | 'GOOGLE_OAUTH_CONFIG_ERROR'

export class CalendarIntegrationError extends Error {
  constructor(
    public code: CalendarIntegrationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'CalendarIntegrationError'
  }
}

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

function getGoogleApiStatus(err: unknown): number | undefined {
  const e = err as { code?: number; response?: { status?: number } }
  return e?.code ?? e?.response?.status
}

function getGoogleApiReason(err: unknown): string | undefined {
  const e = err as {
    response?: { data?: { error?: { errors?: Array<{ reason?: string }> } } }
    errors?: Array<{ reason?: string }>
  }
  return e?.response?.data?.error?.errors?.[0]?.reason ?? e?.errors?.[0]?.reason
}

function mapCalendarApiError(err: unknown): CalendarIntegrationError | null {
  const status = getGoogleApiStatus(err)
  const reason = getGoogleApiReason(err)

  if (status === 401) {
    return new CalendarIntegrationError(
      'GOOGLE_REAUTH_REQUIRED',
      'Google認証の有効期限が切れています。再認証してください。',
    )
  }

  if (status === 403) {
    if (reason === 'insufficientPermissions') {
      return new CalendarIntegrationError(
        'GOOGLE_CALENDAR_SCOPE_MISSING',
        'Googleカレンダーへのアクセス権限がありません。一度ログアウトし、再ログイン時にカレンダーへのアクセスを許可してください。',
      )
    }
    if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
      return new CalendarIntegrationError(
        'GOOGLE_CALENDAR_RATE_LIMIT',
        'Google Calendar API のレート制限に達しました。しばらくしてから再試行してください。',
      )
    }
    return new CalendarIntegrationError(
      'GOOGLE_CALENDAR_PERMISSION_DENIED',
      'Googleカレンダーへのアクセスが拒否されました。再認証をお試しください。',
    )
  }

  if (status != null && status >= 500) {
    return new CalendarIntegrationError(
      'GOOGLE_API_TEMPORARY',
      'Google API が一時的に利用できません。時間をおいて再試行してください。',
    )
  }

  return null
}

function buildEventDateTime(date: string, eventTime?: string, timezone?: string) {
  if (eventTime) {
    const tz = timezone ?? 'Asia/Tokyo'
    const [hours, minutes] = eventTime.split(':').map(Number)
    let endHours = hours + 1
    let endMinutes = minutes
    if (endHours >= 24) {
      endHours = 23
      endMinutes = 59
    }
    const endHoursStr = endHours.toString().padStart(2, '0')
    const endMinutesStr = endMinutes.toString().padStart(2, '0')
    const endTime = `${endHoursStr}:${endMinutesStr}`
    return {
      start: { dateTime: `${date}T${eventTime}:00`, timeZone: tz },
      end:   { dateTime: `${date}T${endTime}:00`,   timeZone: tz },
    }
  }
  return {
    start: { date },
    end:   { date },
  }
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

  try {
    const { credentials } = await oauth2Client.refreshAccessToken()
    if (!credentials.access_token) {
      throw new Error('Failed to refresh Google access token')
    }
    return credentials.access_token
  } catch (err) {
    const e = err as {
      response?: { status?: number; data?: { error?: string } }
      code?: number
    }
    const status = e?.response?.status ?? e?.code
    const oauthError = e?.response?.data?.error

    if (oauthError === 'invalid_grant' || status === 401) {
      throw new CalendarIntegrationError(
        'GOOGLE_REAUTH_REQUIRED',
        'Google認証の有効期限が切れています。再認証してください。',
      )
    }

    if (oauthError === 'invalid_client' || oauthError === 'unauthorized_client') {
      throw new CalendarIntegrationError(
        'GOOGLE_OAUTH_CONFIG_ERROR',
        'Google OAuth 設定に問題があります。管理者にお問い合わせください。',
      )
    }

    if (status != null && status >= 500) {
      throw new CalendarIntegrationError(
        'GOOGLE_API_TEMPORARY',
        'Google API が一時的に利用できません。時間をおいて再試行してください。',
      )
    }

    throw err
  }
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
  eventTime?: string,
  timezone?: string,
): Promise<InsertOutcome> {
  try {
    await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        id:      eventId,
        summary: displayTitle,
        ...buildEventDateTime(ev.date, eventTime, timezone),
        description: descriptionText,
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 720 }],
        },
      },
    })
    return { kind: 'inserted' }
  } catch (err) {
    const mapped = mapCalendarApiError(err)
    if (mapped) {
      if (mapped.code === 'GOOGLE_CALENDAR_RATE_LIMIT' || mapped.code === 'GOOGLE_API_TEMPORARY') {
        console.warn('[calendar] temporary insert issue:', mapped.message)
        return { kind: 'error' }
      }
      throw mapped
    }
    const code = getGoogleApiStatus(err)
    if (code === 409) {
      return { kind: 'conflict', ev, eventId, displayTitle, descriptionText }
    }
    console.error('[calendar] insert error:', err)
    return { kind: 'error' }
  }
}

/**
 * Phase 2: 409 だったイベントは常に patch で時刻などを最新状態に更新する。
 * （cancelled イベントも status: 'confirmed' となることで再アクティブ化される）
 */
async function handleConflict(
  calendar: ReturnType<typeof createCalendarClient>,
  ev: CalendarEvent,
  eventId: string,
  displayTitle: string,
  descriptionText: string,
  eventTime?: string,
  timezone?: string,
): Promise<ConflictOutcome> {
  try {
    // PATCH ではなく UPDATE (PUT) を使うことで、既存イベントの start.date フィールドを
    // 完全に置き換える。PATCH だと旧 date フィールドが残り "Invalid start time" になる。
    await calendar.events.update({
      calendarId: CALENDAR_ID,
      eventId,
      requestBody: {
        status:      'confirmed',
        summary:     displayTitle,
        ...buildEventDateTime(ev.date, eventTime, timezone),
        description: descriptionText,
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 720 }],
        },
      },
    })
    return 'inserted'
  } catch (err) {
    const mapped = mapCalendarApiError(err)
    if (mapped) {
      if (mapped.code === 'GOOGLE_CALENDAR_RATE_LIMIT' || mapped.code === 'GOOGLE_API_TEMPORARY') {
        console.warn('[calendar] temporary conflict issue:', mapped.message)
        return 'error'
      }
      throw mapped
    }
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
  eventTime?: string,
  timezone?: string,
): Promise<BatchInsertResult> {
  const calendar = createCalendarClient(accessToken)

  // 各イベントのメタデータを事前計算
  const items = events.map((ev) => {
    const eventId      = buildCalendarEventId({ date: ev.date, garbageType: ev.title })
    const displayTitle = addEmojiToTitle(ev.title)
    const descriptionText = ev.description
      ? `${ev.description}\n\nゴミカレにより自動登録された予定です`
      : `ゴミカレにより自動登録された予定です`
    return { ev, eventId, displayTitle, descriptionText }
  })

  // ── Phase 1: 逐次 insert ──────────────────────────────────────
  let inserted = 0
  let skipped  = 0
  const conflicts: Array<{ ev: CalendarEvent; eventId: string; displayTitle: string; descriptionText: string }> = []

  for (let i = 0; i < items.length; i++) {
    const item    = items[i]
    const outcome = await attemptInsert(
      calendar, item.ev, item.eventId, item.displayTitle, item.descriptionText, eventTime, timezone
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
      calendar, item.ev, item.eventId, item.displayTitle, item.descriptionText, eventTime, timezone
    )
    if (outcome === 'inserted') inserted++
    else skipped++
    if (i < conflicts.length - 1) await sleep(PHASE2_INTERVAL_MS)
  }

  return { inserted, skipped }
}
