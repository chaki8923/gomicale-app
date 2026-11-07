import type { EventColors } from './calendar-import'
export interface OwnedCalendar { id: string; summary: string; primary: boolean }
export class GoogleAccessError extends Error {
  constructor(public code: string, public status = 409) { super(code) }
}
export async function googleJson<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) {
    if (response.status === 401) throw new GoogleAccessError('GOOGLE_REAUTH_REQUIRED')
    if (response.status === 403) {
      const body = await response.json().catch(() => ({})) as { error?: { errors?: Array<{ reason?: string }> } }
      const reason = body.error?.errors?.[0]?.reason
      if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') throw new GoogleAccessError('GOOGLE_API_TEMPORARY', 503)
      throw new GoogleAccessError('GOOGLE_CALENDAR_SCOPE_MISSING')
    }
    if (response.status === 404) throw new GoogleAccessError('CALENDAR_NOT_FOUND')
    throw new GoogleAccessError('GOOGLE_API_TEMPORARY', 503)
  }
  return response.json() as Promise<T>
}
export async function getOwnedCalendars(accessToken: string): Promise<OwnedCalendar[]> {
  const calendars: OwnedCalendar[] = []
  let pageToken = ''
  const seen = new Set<string>()
  do {
    if (seen.has(pageToken)) throw new GoogleAccessError('GOOGLE_API_TEMPORARY', 503)
    seen.add(pageToken)
    const data = await googleJson<{ items?: Array<{ id?: string; summary?: string; accessRole?: string; primary?: boolean; deleted?: boolean }>; nextPageToken?: string }>(accessToken,
      `users/me/calendarList?minAccessRole=owner&maxResults=250${pageToken ? '&pageToken='+encodeURIComponent(pageToken) : ''}`)
    calendars.push(...(data.items ?? []).filter(c => c.id && c.accessRole === 'owner' && !c.deleted)
      .map(c => ({ id: c.id!, summary: c.summary || c.id!, primary: !!c.primary })))
    pageToken = data.nextPageToken ?? ''
  } while (pageToken)
  return calendars.sort((a,b) => Number(b.primary)-Number(a.primary) || a.summary.localeCompare(b.summary))
}
export async function getEventColors(accessToken: string): Promise<EventColors> {
  const data = await googleJson<{ event?: EventColors }>(accessToken, 'colors')
  if (!data.event || !Object.keys(data.event).length) throw new GoogleAccessError('GOOGLE_API_TEMPORARY', 503)
  return data.event
}
