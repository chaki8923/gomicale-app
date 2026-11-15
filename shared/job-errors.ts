const messages = {
  NO_VALID_EVENTS: [
    '登録できる予定が見つかりませんでした。日付と予定名がはっきり分かる資料で、もう一度お試しください。',
    'We couldn’t find any events to import. Try a file that clearly shows the dates and event names.',
  ],
  NO_VALID_MANUAL_EVENTS: [
    '登録できる予定が見つかりませんでした。日付や収集ルールを見直して、もう一度お試しください。',
    'We couldn’t find any events to import. Check the dates or collection rules you entered and try again.',
  ],
  TOO_MANY_EVENTS: [
    '一度に登録できる件数を超えました。対象期間を短くして、もう一度お試しください。',
    'There are too many events to import at once. Try a shorter date range.',
  ],
  NOT_A_CALENDAR: [
    '予定表を読み取れませんでした。日付と予定名が分かるPDFや画像を選んでください。',
    'We couldn’t read a schedule. Choose a PDF or image that shows dates and event names.',
  ],
  GEMINI_PARSE_ERROR: [
    '予定を読み取れませんでした。対象期間を短くした資料で、もう一度お試しください。',
    'We couldn’t read the events. Try a file that covers a shorter period.',
  ],
  GEMINI_TEMPORARY: [
    '現在、予定を読み取れません。少し時間をおいて、もう一度お試しください。',
    'We can’t read your schedule right now. Wait a little and try again.',
  ],
  GOOGLE_REAUTH_REQUIRED: [
    'Googleとの連携を更新してから、もう一度お試しください。',
    'Reconnect your Google account, then try again.',
  ],
  GOOGLE_CALENDAR_SCOPE_MISSING: [
    'Googleとの連携を更新し、同意画面でカレンダーへのアクセスを許可してください。',
    'Reconnect your Google account and allow calendar access when prompted.',
  ],
  GOOGLE_CALENDAR_PERMISSION_DENIED: [
    'Googleカレンダーにアクセスできませんでした。Googleとの連携を更新してください。',
    'We couldn’t access your Google Calendar. Reconnect your Google account.',
  ],
  GOOGLE_CALENDAR_RATE_LIMIT: [
    'Googleカレンダーに一度に登録できる件数を超えました。少し時間をおいて、再試行してください。',
    'Google Calendar is limiting requests. Wait a little and try again.',
  ],
  GOOGLE_API_TEMPORARY: [
    'Googleカレンダーに接続できませんでした。少し時間をおいて、再試行してください。',
    'We couldn’t connect to Google Calendar. Wait a little and try again.',
  ],
  CALENDAR_NOT_FOUND: [
    '登録先のカレンダーにアクセスできません。登録先が削除されている場合は、取り込みを最初からやり直してください。',
    'We couldn’t access the selected calendar. If it was deleted, start a new import.',
  ],
  AUTO_DISPATCH_FAILED: [
    '自動登録を開始できませんでした。登録履歴から同じ内容で再試行してください。',
    'We couldn’t start automatic import. Open your import history and try again.',
  ],
  PROCESSOR_UNAVAILABLE: [
    '処理を開始できませんでした。少し時間をおいて、もう一度お試しください。',
    'We couldn’t start processing. Wait a little and try again.',
  ],
  UPLOAD_FAILED: [
    'ファイルを送信できませんでした。通信環境を確認して、もう一度お試しください。',
    'We couldn’t upload the file. Check your connection and try again.',
  ],
  UNKNOWN: [
    '処理を完了できませんでした。時間をおいて、もう一度お試しください。',
    'We couldn’t complete the request. Wait a little and try again.',
  ],
} as const

export type JobErrorCode = keyof typeof messages | 'NOT_A_GARBAGE_CALENDAR' | 'GOOGLE_OAUTH_CONFIG_ERROR'

export function parseJobErrorCode(value: unknown): JobErrorCode | null {
  if (typeof value !== 'string') return null
  if (value === 'NOT_A_GARBAGE_CALENDAR' || value === 'GOOGLE_OAUTH_CONFIG_ERROR') return value
  return Object.hasOwn(messages, value) ? value as keyof typeof messages : null
}

export function getJobErrorCode(resultData: unknown): JobErrorCode | null {
  if (!resultData || typeof resultData !== 'object' || !('error_code' in resultData)) return null
  return parseJobErrorCode(resultData.error_code)
}

export function isCalendarReauthErrorCode(code: unknown): boolean {
  return code === 'GOOGLE_REAUTH_REQUIRED' || code === 'GOOGLE_CALENDAR_SCOPE_MISSING' ||
    code === 'GOOGLE_CALENDAR_PERMISSION_DENIED'
}

export function jobErrorMessage(code: unknown, locale: string): string {
  const normalized = parseJobErrorCode(code)
  const key = normalized === 'NOT_A_GARBAGE_CALENDAR' ? 'NOT_A_CALENDAR'
    : normalized === 'GOOGLE_OAUTH_CONFIG_ERROR' ? 'UNKNOWN' : normalized ?? 'UNKNOWN'
  return messages[key][locale === 'en' ? 1 : 0]
}

export function storedJobErrorCode(resultData: unknown, detail: unknown, manual = false): JobErrorCode {
  const code = getJobErrorCode(resultData)
  if (code && code !== 'UNKNOWN') return code
  if (detail === 'No valid events were found') return manual ? 'NO_VALID_MANUAL_EVENTS' : 'NO_VALID_EVENTS'
  if (detail === 'Too many events. Please upload a shorter period.') return 'TOO_MANY_EVENTS'
  if (detail === 'No calendar events could be generated from the text instruction. Please make the rule more specific.' ||
      detail === '入力指示から登録できる予定を生成できませんでした。曜日や収集種別が分かるように、もう少し具体的に入力してください。') {
    return 'NO_VALID_MANUAL_EVENTS'
  }
  if (typeof detail === 'string' && detail.startsWith('No Google refresh token for user: ')) return 'GOOGLE_REAUTH_REQUIRED'
  if (typeof detail === 'string' && detail.includes('Googleカレンダーへのアクセス権限')) {
    return 'GOOGLE_CALENDAR_SCOPE_MISSING'
  }
  return parseJobErrorCode(detail) ?? 'UNKNOWN'
}
