import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { JOB_ERROR_CODES, type JobErrorCode } from '@/lib/job-errors'
import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from '@aws-sdk/client-lambda'
import type { Job } from '@/types/database'

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION ?? 'ap-northeast-1',
  credentials: {
    accessKeyId:     process.env.AWS_LAMBDA_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_LAMBDA_SECRET_ACCESS_KEY!,
  },
})

type GoogleTokenResponse = {
  access_token?: string
}

type GoogleApiErrorResponse = {
  error?: {
    errors?: Array<{ reason?: string }>
  }
  error_description?: string
}

type GoogleTokenInfoResponse = {
  scope?: string
}

type PreflightFailure = {
  errorCode: JobErrorCode
  message: string
}

const BLOCKING_PRECHECK_ERROR_CODES: ReadonlySet<JobErrorCode> = new Set([
  JOB_ERROR_CODES.GOOGLE_REAUTH_REQUIRED,
  JOB_ERROR_CODES.GOOGLE_CALENDAR_SCOPE_MISSING,
  JOB_ERROR_CODES.GOOGLE_CALENDAR_PERMISSION_DENIED,
  JOB_ERROR_CODES.GOOGLE_OAUTH_CONFIG_ERROR,
])

function mapGoogleCalendarPreflightError(
  status: number,
  reason?: string,
): PreflightFailure | null {
  if (status === 401) {
    return {
      errorCode: JOB_ERROR_CODES.GOOGLE_REAUTH_REQUIRED,
      message: 'Google認証の有効期限が切れています。再認証してください。',
    }
  }

  if (status === 403) {
    if (reason === 'insufficientPermissions') {
      return {
        errorCode: JOB_ERROR_CODES.GOOGLE_CALENDAR_SCOPE_MISSING,
        message: 'Googleカレンダーへのアクセス権限がありません。一度ログアウトし、再ログイン時にカレンダーへのアクセスを許可してください。',
      }
    }
    if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
      return {
        errorCode: JOB_ERROR_CODES.GOOGLE_CALENDAR_RATE_LIMIT,
        message: 'Google Calendar API のレート制限に達しました。しばらくしてから再試行してください。',
      }
    }
    return {
      errorCode: JOB_ERROR_CODES.GOOGLE_CALENDAR_PERMISSION_DENIED,
      message: 'Googleカレンダーへのアクセスが拒否されました。再認証をお試しください。',
    }
  }

  if (status >= 500) {
    return {
      errorCode: JOB_ERROR_CODES.GOOGLE_API_TEMPORARY,
      message: 'Google API が一時的に利用できません。時間をおいて再試行してください。',
    }
  }

  return null
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!tokenRes.ok) {
    let oauthError = ''
    try {
      const body = await tokenRes.json() as { error?: string }
      oauthError = body.error ?? ''
    } catch {
      oauthError = ''
    }
    if (oauthError === 'invalid_grant' || tokenRes.status === 401) {
      throw {
        errorCode: JOB_ERROR_CODES.GOOGLE_REAUTH_REQUIRED,
        message: 'Google認証の有効期限が切れています。再認証してください。',
      } satisfies PreflightFailure
    }
    if (oauthError === 'invalid_client' || oauthError === 'unauthorized_client') {
      throw {
        errorCode: JOB_ERROR_CODES.GOOGLE_OAUTH_CONFIG_ERROR,
        message: 'Google OAuth 設定に問題があります。管理者にお問い合わせください。',
      } satisfies PreflightFailure
    }
    const mapped = mapGoogleCalendarPreflightError(tokenRes.status)
    if (mapped) throw mapped
    throw {
      errorCode: JOB_ERROR_CODES.UNKNOWN,
      message: 'Googleアクセストークンの更新に失敗しました。',
    } satisfies PreflightFailure
  }

  const tokenBody = await tokenRes.json() as GoogleTokenResponse
  if (!tokenBody.access_token) {
    throw {
      errorCode: JOB_ERROR_CODES.UNKNOWN,
      message: 'Googleアクセストークンの更新に失敗しました。',
    } satisfies PreflightFailure
  }
  return tokenBody.access_token
}

async function checkGoogleCalendarScope(accessToken: string): Promise<PreflightFailure | null> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
  )

  if (res.ok) {
    const body = await res.json() as GoogleTokenInfoResponse
    const scopes = new Set((body.scope ?? '').split(/\s+/).filter(Boolean))
    return scopes.has('https://www.googleapis.com/auth/calendar.events')
      ? null
      : {
          errorCode: JOB_ERROR_CODES.GOOGLE_CALENDAR_SCOPE_MISSING,
          message: 'Googleカレンダーへのアクセス権限がありません。一度ログアウトし、再ログイン時にカレンダーへのアクセスを許可してください。',
        }
  }

  let reason: string | undefined
  try {
    const body = await res.json() as GoogleApiErrorResponse
    reason = body.error?.errors?.[0]?.reason ?? body.error_description
  } catch {
    reason = undefined
  }
  return mapGoogleCalendarPreflightError(res.status, reason) ?? {
    errorCode: JOB_ERROR_CODES.UNKNOWN,
    message: 'Googleカレンダーへの接続確認に失敗しました。',
  }
}

// POST /api/jobs/start
// R2 アップロード完了後に呼ばれる。Lambda を非同期で invoke する。
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const serviceClient = getSupabaseServiceClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { jobId: string; language?: string; eventTime?: string; timezone?: string }
  if (!body.jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
  }

  // job が自分のものかを確認
  const { data: jobData, error: jobError } = await supabase
    .from('jobs')
    .select('id, user_id, status, r2_object_key')
    .eq('id', body.jobId)
    .eq('user_id', user.id)
    .single()

  if (jobError || !jobData) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const job = jobData as Job

  if (job.status !== 'pending') {
    return NextResponse.json({ error: 'Job is not in pending state' }, { status: 409 })
  }

  // 事前に Google トークンと Calendar API 権限を検証して、失敗しそうなジョブを早期に止める
  const { data: integration } = await serviceClient
    .from('user_integrations')
    .select('google_refresh_token_enc')
    .eq('user_id', user.id)
    .single()

  if (!integration?.google_refresh_token_enc) {
    const message = 'Google認証情報が見つかりません。再認証してください。'
    await serviceClient
      .from('jobs')
      .update({
        status: 'error' as const,
        error_message: message,
        result_data: { error_code: JOB_ERROR_CODES.GOOGLE_REAUTH_REQUIRED },
      })
      .eq('id', job.id)
    return NextResponse.json(
      { error: 'google_reauth_required', errorCode: JOB_ERROR_CODES.GOOGLE_REAUTH_REQUIRED, message },
      { status: 409 },
    )
  }

  let preflightFailure: PreflightFailure | null = null
  let preflightAccessToken: string | null = null
  try {
    preflightAccessToken = await refreshGoogleAccessToken(integration.google_refresh_token_enc)
    preflightFailure = await checkGoogleCalendarScope(preflightAccessToken)
  } catch (err) {
    preflightFailure = err as PreflightFailure
  }

  // preflight 結果を google_calendar_scope_ok フラグに反映する
  if (preflightFailure?.errorCode === JOB_ERROR_CODES.GOOGLE_CALENDAR_SCOPE_MISSING) {
    await serviceClient
      .from('user_integrations')
      .update({ google_calendar_scope_ok: false })
      .eq('user_id', user.id)
  } else if (preflightAccessToken && preflightFailure === null) {
    await serviceClient
      .from('user_integrations')
      .update({ google_calendar_scope_ok: true })
      .eq('user_id', user.id)
  }

  const isBlockingFailure =
    preflightFailure != null &&
    BLOCKING_PRECHECK_ERROR_CODES.has(preflightFailure.errorCode)

  if (isBlockingFailure && preflightFailure) {
    await serviceClient
      .from('jobs')
      .update({
        status: 'error' as const,
        error_message: preflightFailure.message,
        result_data: { error_code: preflightFailure.errorCode },
      })
      .eq('id', job.id)

    return NextResponse.json(
      { error: 'google_calendar_preflight_failed', errorCode: preflightFailure.errorCode, message: preflightFailure.message },
      { status: 409 },
    )
  }

  // status を processing に更新（parser_mode は Lambda の判定後に書き込む）
  await supabase
    .from('jobs')
    .update({
      status: 'processing' as const,
    })
    .eq('id', job.id)

  // Lambda を非同期 (Event) で呼び出す（レスポンスを待たない）
  const language = (body.language === 'en' ? 'en' : 'ja') as 'ja' | 'en'
  const payload = JSON.stringify({
    jobId:       job.id,
    userId:      user.id,
    r2ObjectKey: job.r2_object_key,
    language,
    eventTime:   body.eventTime,
    timezone:    body.timezone,
  })

  await lambdaClient.send(
    new InvokeCommand({
      FunctionName:   process.env.LAMBDA_FUNCTION_NAME!,
      InvocationType: InvocationType.Event,
      Payload:        Buffer.from(payload),
    }),
  )

  return NextResponse.json({ jobId: job.id, status: 'processing' })
}
