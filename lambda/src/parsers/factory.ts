import type { PdfParser } from './base'
import { GeminiGarbageParser, GeminiGeneralParser } from './gemini'
import type { ParserMode, Language } from '../types'

export type ParserProvider = 'gemini' // | 'openai' // 将来拡張時に追加

/**
 * parserMode と language に応じて適切なパーサーを返す
 * - 'garbage': ゴミ出しカレンダー専用パーサー
 * - 'general': 汎用予定PDF パーサー
 */
export function createPdfParser(mode: ParserMode = 'garbage', language: Language = 'ja'): PdfParser {
  if (mode === 'general') return new GeminiGeneralParser(language)
  return new GeminiGarbageParser(language)
}
