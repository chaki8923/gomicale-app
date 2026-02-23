import { createHash } from 'crypto'

/**
 * Google Calendar API のイベント ID 仕様:
 * - 5〜1024 文字
 * - 使用可能文字: a-v, 0-9 (base32hex: RFC 4648)
 * - グローバルにユニークである必要がある
 *
 * 重複防止のため「日付 + PDFハッシュ + ゴミ種別」から決定論的に生成する
 */
export function buildCalendarEventId(params: {
  date: string        // "2026-04-01"
  garbageType: string // イベントタイトル
}): string {
  const raw = `${params.date}::${params.garbageType}`

  // SHA-256 → 先頭 40 文字を base32hex (RFC 4648, 小文字) に変換
  const hashBytes = createHash('sha256').update(raw, 'utf8').digest()

  // Base32hex エンコード (a-v, 0-9)
  const BASE32HEX_CHARS = '0123456789abcdefghijklmnopqrstuv'
  let result = ''

  for (let i = 0; i < 5; i++) {
    // 5バイト (40bit) ずつ処理 → 8文字
    const offset = i * 5
    const b0 = hashBytes[offset]     ?? 0
    const b1 = hashBytes[offset + 1] ?? 0
    const b2 = hashBytes[offset + 2] ?? 0
    const b3 = hashBytes[offset + 3] ?? 0
    const b4 = hashBytes[offset + 4] ?? 0

    result += BASE32HEX_CHARS[(b0 >> 3) & 0x1f]
    result += BASE32HEX_CHARS[((b0 & 0x07) << 2) | (b1 >> 6)]
    result += BASE32HEX_CHARS[(b1 >> 1) & 0x1f]
    result += BASE32HEX_CHARS[((b1 & 0x01) << 4) | (b2 >> 4)]
    result += BASE32HEX_CHARS[((b2 & 0x0f) << 1) | (b3 >> 7)]
    result += BASE32HEX_CHARS[(b3 >> 2) & 0x1f]
    result += BASE32HEX_CHARS[((b3 & 0x03) << 3) | (b4 >> 5)]
    result += BASE32HEX_CHARS[b4 & 0x1f]
  }

  // 40文字の base32hex 文字列 (Calendar API の 5〜1024 文字制限を満たす)
  return result
}
