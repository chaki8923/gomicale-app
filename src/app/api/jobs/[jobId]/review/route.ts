import { NextRequest, NextResponse } from 'next/server'
import { ownImport, ImportError, importErrorResponse, readImportJson } from '@/lib/calendar-import-server'
import { validateDraft } from '../../../../../../shared/calendar-import'
type Context = { params: Promise<{ jobId: string }> }
export async function GET(_request: NextRequest, context: Context) {
  try {
    const { review, db } = await ownImport((await context.params).jobId)
    const { data: task } = await db.from('calendar_import_tasks').select('email_status,email_first_attempt_at').eq('job_id',review.job_id).maybeSingle()
    // Lease tokens are internal. The browser only needs the expiry for recovery.
    return NextResponse.json({ ...review, lease_token: undefined, ready_email_status: task?.email_first_attempt_at ? task.email_status : null }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return importErrorResponse(error) }
}
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { db, review, user } = await ownImport((await context.params).jobId)
    const body = await readImportJson(request)
    if (review.state !== 'ready' || review.confirmed) throw new ImportError('IMPORT_LOCKED', 409)
    if (typeof body.revision !== 'number' || !Number.isInteger(body.revision) || body.revision !== review.revision) throw new ImportError('EDIT_CONFLICT', 409)
    const draft = validateDraft(body.draft, review.source_events)
    const { data, error } = await db.from('calendar_imports').update({ draft, revision: review.revision + 1 })
      .eq('job_id', review.job_id).eq('user_id', user.id).eq('state', 'ready').eq('revision', body.revision).is('confirmed', null).select('revision').maybeSingle()
    if (error) throw error
    if (!data) throw new ImportError('EDIT_CONFLICT', 409)
    return NextResponse.json(data)
  } catch (error) { return importErrorResponse(error) }
}
