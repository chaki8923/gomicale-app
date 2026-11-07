import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { invokeProcessor, readImportJson, importErrorResponse, ImportError } from '@/lib/calendar-import-server'
/** Per-job capability supplied only to the worker, never to the browser. */
export async function POST(request: NextRequest) {
  try {
    const supplied = request.headers.get('authorization')?.replace(/^Bearer /,'') ?? ''
    if (!/^[\da-f-]{36}$/i.test(supplied)) throw new ImportError('UNAUTHORIZED',401)
    const body = await readImportJson(request)
    if (typeof body.jobId !== 'string' || !/^[\da-f-]{36}$/i.test(body.jobId)) throw new ImportError('UNAUTHORIZED',401)
    const db = getSupabaseServiceClient()
    const { data: task, error } = await db.from('calendar_import_tasks').select('dispatch_token').eq('job_id',body.jobId).maybeSingle()
    if (error) throw error
    if (!task || !timingSafeEqual(Buffer.from(supplied),Buffer.from(task.dispatch_token))) throw new ImportError('UNAUTHORIZED',401)
    const { data: review, error: reviewError } = await db.from('calendar_imports').select('*').eq('job_id',body.jobId).maybeSingle()
    if (reviewError) throw reviewError
    if (!review || !review.confirmed || (review.registration_mode === 'auto' && review.confirmed.calendarId !== 'primary')) throw new ImportError('FORBIDDEN',403)
    if (review.state === 'registering' && (!review.lease_until || Date.parse(review.lease_until) < Date.now())) {
      await invokeProcessor({ action: 'register', jobId: review.job_id, userId: review.user_id })
    }
    return NextResponse.json({ accepted: true }, { status: 202 })
  } catch (error) { return importErrorResponse(error) }
}
