import { NextRequest, NextResponse } from 'next/server'
import { ownImport, googleToken, invokeProcessor, ImportError, importErrorResponse, readImportJson } from '@/lib/calendar-import-server'
import { validateDraft } from '../../../../../../shared/calendar-import'
import { getOwnedCalendars, getEventColors } from '../../../../../../shared/google-calendars'
export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { user, db, review } = await ownImport((await context.params).jobId)
    const body = await readImportJson(request)
    if (review.state === 'completed') return NextResponse.json({ state: review.state })
    // Duplicate clicks do not enqueue another active worker. A lost invocation or
    // an expired Lambda claim can be dispatched again using the frozen snapshot.
    if (review.state === 'registering' && (review.lease_until ? Date.parse(review.lease_until) > Date.now() : Date.parse(review.updated_at) > Date.now()-60000)) {
      return NextResponse.json({ state: 'registering' }, { status: 202 })
    }
    if (!review.confirmed && (review.state !== 'ready' || body.revision !== review.revision)) throw new ImportError('EDIT_CONFLICT', 409)
    if (review.state === 'analyzing' || (review.state === 'error' && !review.confirmed)) throw new ImportError('IMPORT_NOT_READY', 409)
    const { accessToken } = await googleToken(user.id, db)
    const [calendars, colors] = await Promise.all([getOwnedCalendars(accessToken), getEventColors(accessToken)])
    const confirmed = validateDraft(review.confirmed ?? review.draft, review.source_events, colors, true)
    if (!calendars.some(c => c.id === confirmed.calendarId)) throw new ImportError('CALENDAR_NOT_FOUND', 409)
    const { data, error } = await db.from('calendar_imports').update({ state: 'registering', confirmed, error: null, lease_token: null, lease_until: null })
      .eq('job_id', review.job_id).eq('user_id', user.id).eq('revision', review.revision).eq('state', review.state)
      .eq('updated_at', review.updated_at).select('job_id').maybeSingle()
    if (error) throw error
    if (!data) throw new ImportError('EDIT_CONFLICT', 409)
    await db.from('user_integrations').update({ selected_calendar_id: confirmed.calendarId }).eq('user_id', user.id)
    await db.from('jobs').update({ status: 'processing', error_message: null }).eq('id', review.job_id).eq('user_id', user.id)
    try { await invokeProcessor({ action: 'register', jobId: review.job_id, userId: user.id }) }
    catch (error) {
      await db.from('calendar_imports').update({ state: 'error', error: 'PROCESSOR_UNAVAILABLE' }).eq('job_id', review.job_id).eq('state', 'registering').is('lease_token', null)
      throw error
    }
    return NextResponse.json({ state: 'registering' }, { status: 202 })
  } catch (error) { return importErrorResponse(error) }
}
