import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai'
import type { PdfParser } from './base'
import type { CalendarEvent, Language, ParseResult } from '../types'

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
PDF全体を表すタイトルと、日付ごとの予定一覧を含む以下のJSON形式のみ返してください：

{
  "title": "ゴミ収集カレンダーの名称（例: 〇〇市 ゴミ収集カレンダー令和X年度）",
  "events": [
    { "date": "YYYY-MM-DD", "title": "ゴミの種類", "description": "出せるごみの内訳（例: ポリ袋・トレイ・ボトル類）" },
    ...
  ]
}

## 注意事項
- title (トップレベル) はPDFのタイトルや内容を要約した短い名称にしてください
- events 内の date は ISO 8601 形式 (YYYY-MM-DD) で返すこと
- events 内の title は原文のまま返すこと（略称・記号もそのまま）
- events 内の title が空になる場合は絶対に出力しないこと（そのエントリ自体を除外すること）
- description はPDFに収集品目の内訳・説明が記載されている場合のみ設定すること。記載がなければ空文字 "" にすること
- 年が記載されていない場合は近隣セルの年・月から推定すること
- 1つの日付に複数の収集種別がある場合は別々のオブジェクトとして出力すること
- 上記のJSON構造以外は一切出力しないこと
`.trim()

const GENERAL_PROMPT = `
あなたはPDFから予定を抽出するAIです。
添付のPDFに記載されている「日付」と「予定タイトル」をすべて抽出し、
PDF全体のタイトルと共に以下のJSON形式のみで返してください。説明文は不要です。

{
  "title": "予定表の名称（例: 〇〇学校 年間行事予定表）",
  "events": [
    { "date": "YYYY-MM-DD", "title": "予定のタイトル" },
    ...
  ]
}

注意:
- title (トップレベル) はPDFのタイトルや内容を要約した短い名称にしてください
- events 内の date は ISO 8601 形式 (YYYY-MM-DD) で返すこと
- events 内の title は原文のまま返すこと
- 年が不明な場合は文書内の他の日付や文脈から推定すること
- 1つの日付に複数の予定がある場合は別々のオブジェクトとして出力すること
- 上記のJSON構造以外は一切出力しないこと
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

async function parseWithPrompt(prompt: string, pdfBuffer: Buffer): Promise<ParseResult> {
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

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error(`Gemini returned unexpected format: ${text.slice(0, 200)}`)
  }

  const raw = JSON.parse(match[0]) as { title?: string, events: Array<Record<string, string>> }

  const events: CalendarEvent[] = (raw.events || [])
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

  return { title: raw.title, events }
}

const GARBAGE_PROMPT_EN = `
You are an AI for extracting data from garbage collection calendars.
The attached PDF is a garbage collection calendar distributed by a municipality.

## Critical Instructions
- Extract ALL collection dates without missing any
- Include collections fixed on specific days of the week (e.g., every Tuesday)
- The title must NEVER be empty. If unclear, use the text visible in the PDF cell as-is

## PDF Structure
- Multiple months' calendars may be arranged side by side
- Each month's calendar has a header with day-of-week names
- Each week often alternates between "date rows" and "collection type rows"
- Collection type cells may be color-coded or use symbols

## Common Collection Types (for reference)
Burnable garbage, Non-burnable garbage, Plastic, Cans/Bottles/PET bottles,
Recyclables, Bulky waste, Paper, Cardboard, etc.

## Output Format
Return ONLY a JSON object containing the overall calendar title and an array of events:

{
  "title": "Name of the calendar (e.g. City Name Garbage Collection Calendar 202X)",
  "events": [
    { "date": "YYYY-MM-DD", "title": "Collection Type (in English)", "description": "Details if specified in PDF (e.g., plastic bags, trays, bottles)" },
    ...
  ]
}

## Notes
- title (top level) should be a concise English summary of the PDF's purpose
- events date must be in ISO 8601 format (YYYY-MM-DD)
- events title should be translated to natural English (e.g., "Burnable Garbage", "Plastic Recycling", "Cans & Bottles")
- Never output an empty title inside events (exclude the entire entry)
- description only if the PDF lists specific items; otherwise use empty string ""
- If the year is not shown, estimate from surrounding dates
- If multiple collection types occur on one date, output them as separate objects
- Output only the JSON object, nothing else
`.trim()

const GENERAL_PROMPT_EN = `
You are an AI that extracts schedule information from PDFs.
Extract the overall title and all "dates" and "event titles" listed in the attached PDF.
Return them ONLY in the following JSON format. No explanatory text needed.

{
  "title": "Name of the schedule (e.g. School Annual Events Calendar)",
  "events": [
    { "date": "YYYY-MM-DD", "title": "Event Title (in English)" },
    ...
  ]
}

Notes:
- title (top level) should be a concise English summary of the PDF's content
- events date must be in ISO 8601 format (YYYY-MM-DD)
- events title should be translated to natural English
- If the year is unknown, estimate from other dates or context in the document
- If multiple events occur on one date, output them as separate objects
- Output only the JSON object, nothing else
`.trim()

export class GeminiGarbageParser implements PdfParser {
  constructor(private readonly language: Language = 'ja') {}

  async parse(pdfBuffer: Buffer): Promise<ParseResult> {
    const prompt = this.language === 'en' ? GARBAGE_PROMPT_EN : GARBAGE_PROMPT
    return parseWithPrompt(prompt, pdfBuffer)
  }
}

export class GeminiGeneralParser implements PdfParser {
  constructor(private readonly language: Language = 'ja') {}

  async parse(pdfBuffer: Buffer): Promise<ParseResult> {
    const prompt = this.language === 'en' ? GENERAL_PROMPT_EN : GENERAL_PROMPT
    return parseWithPrompt(prompt, pdfBuffer)
  }
}

// 後方互換
export const GeminiPdfParser = GeminiGarbageParser
