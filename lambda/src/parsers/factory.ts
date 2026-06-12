import type { PdfParser } from './base'
import { GeminiAutoParser } from './gemini'
import type { Language } from '../types'

export type ParserProvider = 'gemini' // | 'openai' // 将来拡張時に追加

/**
 * ファイル種別を自動判定する統合パーサーを返す。
 * Gemini がゴミ収集カレンダー / 一般予定表 / 繰り返しルール文章 を自動で識別し、
 * ParseResult.parserMode に判定結果を設定して返す。
 *
 * fiscalYearStart / fiscalYearEnd を渡すと、格子カレンダーでなく繰り返しルールが
 * 文章で書かれたファイルも対象期間内の具体日付に展開して返す。
 */
export function createPdfParser(
  language: Language = 'ja',
  fiscalYearStart?: string,
  fiscalYearEnd?: string,
): PdfParser {
  return new GeminiAutoParser(language, fiscalYearStart, fiscalYearEnd)
}
