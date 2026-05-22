import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
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

function getCurrentFiscalYearRange() {
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const year = nowJst.getUTCFullYear()
  const month = nowJst.getUTCMonth() + 1
  const fiscalStartYear = month >= 4 ? year : year - 1
  return {
    fiscalYearStart: `${fiscalStartYear}-04-01`,
    fiscalYearEnd: `${fiscalStartYear + 1}-03-31`,
  }
}

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

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const serviceClient = getSupabaseServiceClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { instruction?: string; language?: string; eventTime?: string; timezone?: string }
  const instruction = body.instruction?.trim() ?? ''
  if (!instruction) {
    return NextResponse.json({ error: 'instruction_required', message: '入力指示を入力してください。' }, { status: 400 })
  }
  if (instruction.length > 2000) {
    return NextResponse.json({ error: 'instruction_too_long', message: '入力指示は2000文字以内で入力してください。' }, { status: 400 })
  }

  // 1日の実行回数チェック（PDFアップロードと同じ扱い、JST基準、エラー除く）
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const todayJstMidnight = new Date(
    Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate()) - 9 * 60 * 60 * 1000,
  )
  const { count: uploadCount } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('status', 'error')
    .gte('created_at', todayJstMidnight.toISOString())

  if ((uploadCount ?? 0) >= 5) {
    return NextResponse.json({ error: 'limit_exceeded', message: '1日の登録上限（5回）に達しました。明日またお試しください。' }, { status: 429 })
  }

  const jobObjectKey = `manual/${user.id}/${randomUUID()}.json`
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      user_id: user.id,
      status: 'pending' as const,
      r2_object_key: jobObjectKey,
      parser_mode: 'garbage',
      pdf_title: body.language === 'en' ? 'Manual: garbage collection rules' : '手入力: ゴミ収集ルール',
    })
    .select()
    .single()

  if (jobError || !job) {
    console.error('[manual-schedules/start] insert job error:', jobError)
    return NextResponse.json({ error: 'failed_to_create_job', message: 'ジョブの作成に失敗しました。' }, { status: 500 })
  }

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
      .eq('id', (job as Job).id)
    return NextResponse.json({ jobId: (job as Job).id, status: 'error' })
  }

  let preflightFailure: PreflightFailure | null = null
  try {
    const accessToken = await refreshGoogleAccessToken(integration.google_refresh_token_enc)
    preflightFailure = await checkGoogleCalendarScope(accessToken)
  } catch (err) {
    preflightFailure = err as PreflightFailure
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
      .eq('id', (job as Job).id)
    return NextResponse.json({ jobId: (job as Job).id, status: 'error' })
  }

  const { fiscalYearStart, fiscalYearEnd } = getCurrentFiscalYearRange()
  const language = (body.language === 'en' ? 'en' : 'ja') as 'ja' | 'en'
  const payload = JSON.stringify({
    jobId: (job as Job).id,
    userId: user.id,
    r2ObjectKey: jobObjectKey,
    parserMode: 'garbage',
    language,
    eventTime: body.eventTime,
    timezone: body.timezone,
    inputMode: 'manual',
    manualInstruction: instruction,
    fiscalYearStart,
    fiscalYearEnd,
  })

  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: process.env.LAMBDA_FUNCTION_NAME!,
      InvocationType: InvocationType.Event,
      Payload: Buffer.from(payload),
    }),
  )

  await supabase
    .from('jobs')
    .update({ status: 'processing' as const })
    .eq('id', (job as Job).id)

  return NextResponse.json({ jobId: (job as Job).id, status: 'processing' })
}
