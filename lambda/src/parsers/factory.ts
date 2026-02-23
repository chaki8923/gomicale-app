import type { PdfParser } from './base'
import { GeminiGarbageParser, GeminiGeneralParser } from './gemini'
import type { ParserMode } from '../types'

export type ParserProvider = 'gemini' // | 'openai' // 将来拡張時に追加

/**
 * parserMode に応じて適切なパーサーを返す
 * - 'garbage': ゴミ出しカレンダー専用パーサー
 * - 'general': 汎用予定PDF パーサー
 */
export function createPdfParser(mode: ParserMode = 'garbage'): PdfParser {
  if (mode === 'general') return new GeminiGeneralParser()
  return new GeminiGarbageParser()
}
