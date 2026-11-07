import 'server-only'
import type { getSupabaseServiceClient } from '@/lib/supabase/server'
type CalendarEvent = { date: string; title: string; description?: string }
/** Confirmed user edits take precedence. Legacy jobs retain shared-cache fallback. */
export async function loadUserCalendarEvents(
  db: ReturnType<typeof getSupabaseServiceClient>, userId: string,
  job: { id: string; pdf_hash: string | null }, preferredLanguage: 'ja' | 'en' = 'en',
): Promise<{ events: CalendarEvent[]; lang: 'ja' | 'en' } | null> {
  const { data: review, error } = await db.from('calendar_imports').select('state,confirmed,language').eq('job_id',job.id).eq('user_id',userId).maybeSingle()
  if (error) throw error
  if (review) return review.state === 'completed' && review.confirmed
    ? { events: review.confirmed.events.filter(e => e.included), lang: review.language } : null
  if (!job.pdf_hash) return null
  const { data: rows, error: cacheError } = await db.from('parsed_pdfs').select('pdf_hash,extracted_json').like('pdf_hash',`${job.pdf_hash}%`).order('created_at',{ascending:false})
  if (cacheError) throw cacheError
  const candidates = (rows ?? []).flatMap(row => {
    const suffix = row.pdf_hash.slice(job.pdf_hash!.length)
    const lang = suffix.startsWith('_en') ? 'en' : suffix.startsWith('_ja') || suffix === '' ? 'ja' : null
    return lang ? [{ lang: lang as 'ja'|'en', priority: suffix === '' ? 2 : lang === preferredLanguage ? 0 : 1, extracted: row.extracted_json }] : []
  }).sort((a,b) => a.priority-b.priority)
  const best = candidates[0]
  if (!best) return null
  const raw = best.extracted as {events?:CalendarEvent[]} | CalendarEvent[]
  return { events: Array.isArray(raw) ? raw : raw?.events ?? [], lang: best.lang }
}
