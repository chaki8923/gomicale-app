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

export class ImportTimeBudgetError extends Error {
  constructor() { super('Import continues in a fresh worker'); this.name = 'ImportTimeBudgetError' }
}

export class CalendarIntegrationError extends Error {
  constructor(
    public code: CalendarIntegrationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'CalendarIntegrationError'
  }
}

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

export function buildEventDateTime(date: string, eventTime?: string, timezone?: string) {
  const nextDay = new Date(date+'T00:00:00Z')
  nextDay.setUTCDate(nextDay.getUTCDate()+1)
  if (eventTime) {
    const [hours, minutes] = eventTime.split(':').map(Number)
    const endDate = hours === 23 ? nextDay.toISOString().slice(0,10) : date
    const endTime = `${String((hours+1)%24).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`
    return { start: { dateTime: `${date}T${eventTime}:00`, timeZone: timezone ?? 'Asia/Tokyo' },
      end: { dateTime: `${endDate}T${endTime}:00`, timeZone: timezone ?? 'Asia/Tokyo' } }
  }
  return { start: { date }, end: { date: nextDay.toISOString().slice(0,10) } }
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

/** Fail on every unsuccessful write. Retrying uses the same deterministic IDs. */
export async function batchInsertGarbageEvents(
  accessToken: string, events: CalendarEvent[], _pdfHash: string,
  eventTime?: string, timezone?: string, calendarId = CALENDAR_ID,
  calendar = createCalendarClient(accessToken),
  progress?: { checkpoint: (count: number) => Promise<void>; shouldStop?: () => boolean },
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  for (const ev of events) {
    if (progress?.shouldStop?.()) throw new ImportTimeBudgetError()
    const eventId = buildCalendarEventId({ date: ev.date, garbageType: ev.title })
    const requestBody = {
      summary: addEmojiToTitle(ev.title),
      ...buildEventDateTime(ev.date, eventTime, timezone),
      description: `${ev.description ? ev.description+'\n\n' : ''}ゴミカレにより登録された予定です`,
      colorId: ev.colorId ?? undefined,
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 720 }] },
    }
    try {
      try { await calendar.events.insert({ calendarId, requestBody: { id: eventId, ...requestBody } }) }
      catch (error) {
        if (getGoogleApiStatus(error) !== 409) throw error
        // PUT replaces date/dateTime correctly when switching all-day vs timed.
        await calendar.events.update({ calendarId, eventId, requestBody: { ...requestBody, status: 'confirmed' } })
      }
      inserted++
      if (progress && (inserted % 25 === 0 || inserted === events.length)) await progress.checkpoint(inserted)
    } catch (error) {
      throw mapCalendarApiError(error) ?? new CalendarIntegrationError('GOOGLE_API_TEMPORARY', 'Google Calendar registration failed. Please retry the same import.')
    }
    if (inserted < events.length) await new Promise(resolve => setTimeout(resolve, 120))
  }
  return { inserted, skipped: 0 }
}
