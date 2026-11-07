import { NextRequest, NextResponse } from 'next/server'
import { requireImportUser, startAnalysis, ImportError, importErrorResponse, readImportJson } from '@/lib/calendar-import-server'
export async function POST(request: NextRequest) {
  try {
    const { user, db } = await requireImportUser()
    const body = await readImportJson(request)
    if (typeof body.jobId !== 'string') throw new ImportError('INVALID_JOB')
    const { data: job, error } = await db.from('jobs').select('*').eq('id', body.jobId).eq('user_id', user.id).maybeSingle()
    if (error) throw error
    if (!job) throw new ImportError('NOT_FOUND', 404)
    if (job.status !== 'pending') throw new ImportError('ALREADY_STARTED', 409)
    await startAnalysis(user.id, job, body)
    return NextResponse.json({ jobId: job.id, status: 'processing' })
  } catch (error) { return importErrorResponse(error) }
}
