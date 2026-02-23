import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai'
import type { PdfParser } from './base'
import type { CalendarEvent } from '../types'

const GARBAGE_PROMPT = `
あなたはゴミ出しカレンダーのデータ抽出AIです。
添付の PDF は自治体が配布するゴミ収集カレンダーです。

## 最重要指示
- PDFに記載された**全ての**収集日を**一件も漏らさず**抽出すること
- 火曜日・水曜日など特定の曜日に固定されている収集も全て含めること
- title は**絶対に空にしてはいけない**。不明瞭な場合もPDFの該当セルに見える文字をそのまま使うこと

## PDFの構造
- 複数ヶ月分のカレンダーが横に並んでいる場合がある
- 各月のカレンダーは「日 月 火 水 木 金 土」のヘッダーを持つ
- 各週は「日付の行」と「収集種別の行」が交互に並ぶことが多い
- 収集種別のセルは色分けや記号で表現されている場合もある
- 収集種別が記載されていない日はその週に収集なし

## 収集種別の代表例（参考）
もやすごみ、もやさないごみ、燃えるごみ、燃えないごみ、プラスチック、
缶・びん・ペットボトル、資源ごみ、粗大ごみ、紙類、段ボール など

## 出力形式
日付と収集種別を1件1行で、以下のJSON配列のみ返してください：

[
  { "date": "YYYY-MM-DD", "title": "ゴミの種類", "description": "出せるごみの内訳（例: ポリ袋・トレイ・ボトル類）" },
  ...
]

## 注意事項
- date は ISO 8601 形式 (YYYY-MM-DD) で返すこと
- title は原文のまま返すこと（略称・記号もそのまま）
- title が空になる場合は絶対に出力しないこと（そのエントリ自体を除外すること）
- description はPDFに収集品目の内訳・説明が記載されている場合のみ設定すること。記載がなければ空文字 "" にすること
- 年が記載されていない場合は近隣セルの年・月から推定すること
- 1つの日付に複数の収集種別がある場合は別々のオブジェクトとして出力すること
- JSON配列以外は一切出力しないこと
`.trim()

const GENERAL_PROMPT = `
あなたはPDFから予定を抽出するAIです。
添付のPDFに記載されている「日付」と「予定タイトル」をすべて抽出し、
以下のJSON配列形式のみで返してください。説明文は不要です。

[
  { "date": "YYYY-MM-DD", "title": "予定のタイトル" },
  ...
]

注意:
- date は ISO 8601 形式 (YYYY-MM-DD) で返すこと
- title は原文のまま返すこと
- 年が不明な場合は文書内の他の日付や文脈から推定すること
- 1つの日付に複数の予定がある場合は別々のオブジェクトとして出力すること
- JSON配列以外は一切出力しないこと
`.trim()

function createGeminiModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-3.1-pro-preview',
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
    },
  })
}

async function parseWithPrompt(prompt: string, pdfBuffer: Buffer): Promise<CalendarEvent[]> {
  const model = createGeminiModel()
  const base64Pdf = pdfBuffer.toString('base64')

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Pdf,
      },
    },
  ])

  const text = result.response.text().trim()

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) {
    throw new Error(`Gemini returned unexpected format: ${text.slice(0, 200)}`)
  }

  const raw = JSON.parse(match[0]) as Array<Record<string, string>>

  const events: CalendarEvent[] = raw
    .map((item) => {
      const desc = (item.description ?? '').trim()
      return {
        date:        (item.date  ?? '').trim(),
        title:       (item.title ?? item['garbage_type'] ?? '').trim(),
        description: desc || undefined,
      }
    })
    .filter((ev) => {
      if (!ev.date || !ev.title) {
        console.warn('[gemini] skipping event with empty field:', ev)
        return false
      }
      return true
    })

  return events
}

export class GeminiGarbageParser implements PdfParser {
  async parse(pdfBuffer: Buffer): Promise<CalendarEvent[]> {
    return parseWithPrompt(GARBAGE_PROMPT, pdfBuffer)
  }
}

export class GeminiGeneralParser implements PdfParser {
  async parse(pdfBuffer: Buffer): Promise<CalendarEvent[]> {
    return parseWithPrompt(GENERAL_PROMPT, pdfBuffer)
  }
}

// 後方互換
export const GeminiPdfParser = GeminiGarbageParser
