const JOB_ERROR_CODES = {
  GOOGLE_REAUTH_REQUIRED: 'GOOGLE_REAUTH_REQUIRED',
  GOOGLE_CALENDAR_SCOPE_MISSING: 'GOOGLE_CALENDAR_SCOPE_MISSING',
  GOOGLE_CALENDAR_PERMISSION_DENIED: 'GOOGLE_CALENDAR_PERMISSION_DENIED',
  GOOGLE_CALENDAR_RATE_LIMIT: 'GOOGLE_CALENDAR_RATE_LIMIT',
  GOOGLE_API_TEMPORARY: 'GOOGLE_API_TEMPORARY',
  GOOGLE_OAUTH_CONFIG_ERROR: 'GOOGLE_OAUTH_CONFIG_ERROR',
  NOT_A_CALENDAR: 'NOT_A_CALENDAR',
  NOT_A_GARBAGE_CALENDAR: 'NOT_A_GARBAGE_CALENDAR',
  GEMINI_TEMPORARY: 'GEMINI_TEMPORARY',
  UNKNOWN: 'UNKNOWN',
} as const

export type JobErrorCode = (typeof JOB_ERROR_CODES)[keyof typeof JOB_ERROR_CODES]

export type JobResultDataLike = {
  calendar_event_count?: number
  skipped_count?: number
  pdf_hash?: string
  error_code?: JobErrorCode
}

const CALENDAR_REAUTH_ERROR_CODES: ReadonlySet<JobErrorCode> = new Set([
  JOB_ERROR_CODES.GOOGLE_REAUTH_REQUIRED,
  JOB_ERROR_CODES.GOOGLE_CALENDAR_SCOPE_MISSING,
  JOB_ERROR_CODES.GOOGLE_CALENDAR_PERMISSION_DENIED,
])

export function getJobErrorCode(resultData: unknown): JobErrorCode | null {
  if (!resultData || typeof resultData !== 'object' || Array.isArray(resultData)) {
    return null
  }
  const code = (resultData as { error_code?: unknown }).error_code
  if (typeof code !== 'string') {
    return null
  }
  return (Object.values(JOB_ERROR_CODES) as string[]).includes(code)
    ? (code as JobErrorCode)
    : null
}

export function isCalendarReauthErrorCode(code: JobErrorCode | null): boolean {
  return code != null && CALENDAR_REAUTH_ERROR_CODES.has(code)
}

export { JOB_ERROR_CODES }
