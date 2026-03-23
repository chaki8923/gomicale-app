import type { ParseResult } from '../types'

/**
 * PDF 解析の Strategy インターフェース
 * 新しい LLM プロバイダー（OpenAI 等）を追加する場合は
 * このインターフェースを実装するだけでよい
 */
export interface PdfParser {
  parse(pdfBuffer: Buffer): Promise<ParseResult>
}

/**
 * アップロードされた PDF がカレンダー・スケジュール表でない場合にスローされるエラー
 */
export class NotACalendarError extends Error {
  constructor() {
    super('NOT_A_CALENDAR')
    this.name = 'NotACalendarError'
  }
}

/**
 * ゴミ収集カレンダーモードでアップロードされた PDF が
 * カレンダー・予定表ではあるがゴミ収集カレンダーではない場合にスローされるエラー
 */
export class NotAGarbageCalendarError extends Error {
  constructor() {
    super('NOT_A_GARBAGE_CALENDAR')
    this.name = 'NotAGarbageCalendarError'
  }
}
