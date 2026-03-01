import type { ParseResult } from '../types'

/**
 * PDF 解析の Strategy インターフェース
 * 新しい LLM プロバイダー（OpenAI 等）を追加する場合は
 * このインターフェースを実装するだけでよい
 */
export interface PdfParser {
  parse(pdfBuffer: Buffer): Promise<ParseResult>
}
