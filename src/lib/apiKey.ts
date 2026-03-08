import { createHash, randomBytes } from 'crypto'

/** APIキーのプレフィックス */
const PREFIX = 'gmc_'

/**
 * 新しいAPIキーを生成する（平文）
 * 例: gmc_a1b2c3d4e5f6...
 */
export function generateApiKey(): string {
  const raw = randomBytes(32).toString('hex')
  return `${PREFIX}${raw}`
}

/**
 * APIキーを SHA-256 でハッシュ化して hex 文字列で返す
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex')
}

/**
 * Authorization ヘッダーから Bearer トークンを取得する
 * "Bearer gmc_xxx..." → "gmc_xxx..."
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}
