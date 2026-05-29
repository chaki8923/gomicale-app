import type { ParseResult } from '../types'

/**
 * ファイル（PDF / 画像）解析の Strategy インターフェース
 * 新しい LLM プロバイダー（OpenAI 等）を追加する場合は
 * このインターフェースを実装するだけでよい
 * @param fileBuffer 解析対象のバイナリ
 * @param mimeType   ファイルの MIME タイプ（例: application/pdf, image/jpeg）
 */
export interface PdfParser {
  parse(fileBuffer: Buffer, mimeType: string): Promise<ParseResult>
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
