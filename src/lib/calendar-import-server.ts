import 'server-only'
import { NextResponse } from 'next/server'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { GoogleAccessError } from '../../shared/google-calendars'
import { accessTokenHasCalendarScope } from '@/lib/google-calendar-access'
import { validateSettings } from '../../shared/calendar-import'

export class ImportError extends Error {
  constructor(public code: string, public status = 400) { super(code) }
}
export function importErrorResponse(error: unknown) {
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  if (error instanceof ImportError || error instanceof GoogleAccessError) return NextResponse.json({ error: error.code }, { status: error.status })
  // Validation errors contain codes, never provider credentials or internal details.
  if (error instanceof Error && /^(INVALID_|DUPLICATE_EVENTS|EMPTY_SELECTION)/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 })
  console.error('[calendar-import]', error instanceof Error ? error.name : 'Unknown error')
  return NextResponse.json({ error: 'REQUEST_FAILED' }, { status: 500 })
}
export async function readImportJson(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) throw new ImportError('FORBIDDEN', 403)
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ImportError('INVALID_JSON', 415)
  if (Number(request.headers.get('content-length') ?? 0) > 4_000_000) throw new ImportError('REQUEST_TOO_LARGE', 413)
  const raw = await request.text()
  if (Buffer.byteLength(raw) > 4_000_000) throw new ImportError('REQUEST_TOO_LARGE', 413)
  const value = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ImportError('INVALID_JSON')
  return value
}
export async function requireImportUser() {
  const auth = await getSupabaseServerClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user) throw new ImportError('UNAUTHORIZED', 401)
  return { user, db: getSupabaseServiceClient() }
}
export async function ownImport(jobId: string) {
  const { user, db } = await requireImportUser()
  if (!/^[\da-f-]{36}$/i.test(jobId)) throw new ImportError('NOT_FOUND', 404)
  const { data: review, error } = await db.from('calendar_imports').select('*').eq('job_id', jobId).eq('user_id', user.id).maybeSingle()
  if (error) throw error
  if (!review) throw new ImportError('NOT_FOUND', 404)
  return { user, db, review }
}
export async function googleToken(userId: string, db: ReturnType<typeof getSupabaseServiceClient>) {
  const { data, error } = await db.from('user_integrations').select('google_refresh_token_enc,selected_calendar_id').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data?.google_refresh_token_enc) throw new GoogleAccessError('GOOGLE_REAUTH_REQUIRED')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: data.google_refresh_token_enc, grant_type: 'refresh_token' }), signal: AbortSignal.timeout(20000),
  })
  const token = await response.json() as { access_token?: string; error?: string }
  if (token.error === 'invalid_grant' || response.status === 401) throw new GoogleAccessError('GOOGLE_REAUTH_REQUIRED')
  if (!response.ok || !token.access_token) throw new GoogleAccessError('GOOGLE_API_TEMPORARY', 503)
  const scopeOK = await accessTokenHasCalendarScope(token.access_token)
  if (scopeOK === false) throw new GoogleAccessError('GOOGLE_CALENDAR_SCOPE_MISSING')
  if (scopeOK === null) throw new GoogleAccessError('GOOGLE_API_TEMPORARY', 503)
  return { accessToken: token.access_token, selectedCalendarId: data.selected_calendar_id }
}
export async function invokeProcessor(payload: object) {
  const client = new LambdaClient({ region: process.env.AWS_REGION ?? 'ap-northeast-1', credentials: {
    accessKeyId: process.env.AWS_LAMBDA_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_LAMBDA_SECRET_ACCESS_KEY!,
  } })
  const result = await client.send(new InvokeCommand({ FunctionName: process.env.LAMBDA_FUNCTION_NAME!, InvocationType: 'Event', Payload: Buffer.from(JSON.stringify(payload)) }))
  if (result.StatusCode !== 202) throw new ImportError('PROCESSOR_UNAVAILABLE', 503)
}
export async function startAnalysis(userId: string, job: { id: string; r2_object_key: string }, body: { language?: unknown; eventTime?: unknown; timezone?: unknown }, extra: object = {}) {
  const db = getSupabaseServiceClient()
  const settings = validateSettings(body)
  const language = body.language === 'en' ? 'en' : 'ja'
  const { error } = await db.from('calendar_imports').insert({ job_id: job.id, user_id: userId, language,
    draft: { events: [], calendarId: '', ...settings } })
  if (error?.code === '23505') throw new ImportError('ALREADY_STARTED', 409)
  if (error) throw error
  const { error: jobError } = await db.from('jobs').update({ status: 'processing' }).eq('id', job.id).eq('user_id', userId)
  if (jobError) throw jobError
  try {
    await invokeProcessor({ ...extra, action: 'analyze', jobId: job.id, userId, r2ObjectKey: job.r2_object_key, language, ...settings })
  } catch (error) {
    await db.from('calendar_imports').update({ state: 'error', error: 'PROCESSOR_UNAVAILABLE' }).eq('job_id', job.id)
    await db.from('jobs').update({ status: 'error', error_message: 'PROCESSOR_UNAVAILABLE' }).eq('id', job.id)
    throw error
  }
}
