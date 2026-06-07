export const GOOGLE_CALENDAR_EVENTS_SCOPE =
  'https://www.googleapis.com/auth/calendar.events'

type TokenInfoResponse = {
  scope?: string
  error?: string
  error_description?: string
}

/**
 * アクセストークンが calendar.events スコープを持つか確認する。
 * - true  : スコープあり
 * - false : スコープなし
 * - null  : 通信失敗・トークン無効など不明（フラグを誤更新しないために null を返す）
 */
export async function accessTokenHasCalendarScope(
  accessToken: string,
): Promise<boolean | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    )

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as TokenInfoResponse
      // 401 = トークン無効。スコープの有無は判定できないので null を返す
      if (res.status === 401 || body.error === 'invalid_token') {
        return null
      }
      // その他の HTTP エラーも不明扱い
      return null
    }

    const body = await res.json() as TokenInfoResponse
    if (!body.scope) return false

    const scopes = new Set(body.scope.split(/\s+/).filter(Boolean))
    return scopes.has(GOOGLE_CALENDAR_EVENTS_SCOPE)
  } catch {
    // ネットワークエラー等は不明扱い
    return null
  }
}
