import type { PdfParser } from './base'
import { GeminiAutoParser } from './gemini'
import type { Language } from '../types'

export type ParserProvider = 'gemini' // | 'openai' // 将来拡張時に追加

/**
 * ファイル種別を自動判定する統合パーサーを返す。
 * Gemini がゴミ収集カレンダー / 一般予定表を自動で識別し、
 * ParseResult.parserMode に判定結果を設定して返す。
 */
export function createPdfParser(language: Language = 'ja'): PdfParser {
  return new GeminiAutoParser(language)
}
