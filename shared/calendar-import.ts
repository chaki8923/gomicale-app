/** Canonical, user-specific import data. Never stored in the shared parser cache. */
export interface ReviewEvent {
  id: string
  category: string
  date: string
  title: string
  description?: string
  sourceColor: string | null
  colorId: string | null
  included: boolean
}
export interface ImportDraft {
  events: ReviewEvent[]
  calendarId: string
  eventTime: string | null
  timezone: string
}
export interface CalendarImport {
  job_id: string
  user_id: string
  state: 'analyzing' | 'ready' | 'registering' | 'completed' | 'error'
  registered_count: number
  revision: number
  source_events: ReviewEvent[]
  draft: ImportDraft
  confirmed: ImportDraft | null
  language: 'ja' | 'en'
  lease_token: string | null
  lease_until: string | null
  error: string | null
  created_at: string
  updated_at: string
}
export type EventColors = Record<string, { background: string; foreground: string }>
// Google's published event palette; refreshed from colors.get in the review API.
export const STANDARD_EVENT_COLORS: EventColors = Object.fromEntries([
  '#a4bdfc','#7ae7bf','#dbadff','#ff887c','#fbd75b','#ffb878',
  '#46d6db','#e1e1e1','#5484ed','#51b749','#dc2127',
].map((background, i) => [String(i + 1), { background, foreground: '#1d1d1d' }]))
export function normalizeColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null
}
export function colorLab(hex: string): number[] {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  const [r,g,b] = rgb
  const xyz = [(r*.4124564+g*.3575761+b*.1804375)/.95047,
    r*.2126729+g*.7151522+b*.072175, (r*.0193339+g*.119192+b*.9503041)/1.08883]
    .map(v => v > 216/24389 ? Math.cbrt(v) : (24389/27*v+16)/116)
  return [116*xyz[1]-16, 500*(xyz[0]-xyz[1]), 200*(xyz[1]-xyz[2])]
}
export function nearestColor(hex: string | null, colors: EventColors = STANDARD_EVENT_COLORS): string | null {
  if (!normalizeColor(hex)) return null
  const lab = colorLab(hex!)
  return Object.entries(colors).filter(([,v]) => normalizeColor(v.background))
    .map(([id,v]) => ({ id, distance: colorLab(v.background).reduce((sum,n,i) => sum+(n-lab[i])**2,0) }))
    .sort((a,b) => a.distance-b.distance)[0]?.id ?? null
}
export function validDate(date: unknown): date is string {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    date >= '1900-01-01' && date <= '2200-12-31' &&
    Number.isFinite(Date.parse(date+'T00:00:00Z')) && new Date(date+'T00:00:00Z').toISOString().slice(0,10) === date
}
export function validateSettings(value: { eventTime?: unknown; timezone?: unknown }) {
  const eventTime = value.eventTime || null
  const timezone = value.timezone ?? 'Asia/Tokyo'
  if (eventTime !== null && (typeof eventTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(eventTime))) throw new Error('INVALID_TIME')
  if (typeof timezone !== 'string' || timezone.length > 100) throw new Error('INVALID_TIMEZONE')
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }) } catch { throw new Error('INVALID_TIMEZONE') }
  return { eventTime: eventTime as string | null, timezone }
}
export function validateDraft(value: unknown, source: ReviewEvent[], colors: EventColors = STANDARD_EVENT_COLORS, confirming = false): ImportDraft {
  if (!value || typeof value !== 'object') throw new Error('INVALID_DRAFT')
  const v = value as ImportDraft
  if (!Array.isArray(v.events) || v.events.length !== source.length || source.length > 5000) throw new Error('INVALID_EVENTS')
  if (typeof v.calendarId !== 'string' || v.calendarId.length > 1024 || (confirming && !v.calendarId)) throw new Error('INVALID_CALENDAR')
  const originals = new Map(source.map(e => [e.id, e]))
  const ids = new Set<string>(), duplicates = new Set<string>()
  const events = v.events.map(e => {
    if (!e || typeof e !== 'object') throw new Error('INVALID_EVENT')
    const original = originals.get(e.id)
    if (!original || ids.has(e.id) || !validDate(e.date) || typeof e.title !== 'string' || !e.title.trim() || e.title.length > 300 || typeof e.included !== 'boolean') throw new Error('INVALID_EVENT')
    if (e.colorId !== null && (typeof e.colorId !== 'string' || !Object.hasOwn(colors, e.colorId))) throw new Error('INVALID_COLOR')
    ids.add(e.id)
    const key = `${e.date}::${e.title.trim()}`
    if (e.included && duplicates.has(key)) throw new Error('DUPLICATE_EVENTS')
    if (e.included) duplicates.add(key)
    return { ...original, date: e.date, title: e.title.trim(), colorId: e.colorId, included: e.included }
  })
  if (confirming && !events.some(e => e.included)) throw new Error('EMPTY_SELECTION')
  return { events, calendarId: v.calendarId, ...validateSettings(v) }
}
export function createSourceEvents(events: Array<{ date: string; title: string; description?: string }>, typeColors: Record<string, string> = {}): ReviewEvent[] {
  const seen = new Set<string>()
  return events.filter(e => {
    const key = `${e.date}::${e.title.trim()}`
    if (!validDate(e.date) || !e.title.trim() || seen.has(key)) return false
    seen.add(key); return true
  }).sort((a,b) => a.date.localeCompare(b.date)).map((e,i) => {
    const sourceColor = normalizeColor(typeColors[e.title])
    return { ...e, id: String(i), category: e.title, sourceColor, colorId: nearestColor(sourceColor), included: true }
  })
}
