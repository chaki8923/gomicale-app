import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai'
import type { PdfParser } from './base'
import { NotACalendarError } from './base'
import type { CalendarEvent, Language, ParseResult } from '../types'

// ─────────────────────────────────────────────
// プロンプト（日本語）
// ─────────────────────────────────────────────

/**
 * 対象期間（年度）が渡された場合の繰り返しルール展開セクションを生成する。
 * 格子状カレンダーではなく文章でルールが書かれたファイル向け。
 */
function buildRecurringRulesSection(fiscalYearStart: string, fiscalYearEnd: string): string {
  return `
### 収集曜日ルールのみが書かれた分別パンフレット・お知らせの場合

格子状のカレンダーではなく、「毎週火曜日は燃えるゴミ」「第2・第4月曜日は燃えないごみ」のような
収集曜日ルールが文章・表・箇条書きで記載されている場合も、isCalendar: true, isGarbageCalendar: true として扱う。

対象期間内の全ての該当日を展開して events に出力すること。

対象期間:
- 開始日: ${fiscalYearStart}
- 終了日: ${fiscalYearEnd}

展開ルール:
- 「毎週○曜日」: 対象期間内のその曜日を全て列挙する
- 「第2・第4○曜日」: 各月の第2・第4の該当曜日のみ出力する
- 「第1・第3○曜日」: 各月の第1・第3の該当曜日のみ出力する
- 曜日・第n曜日の判定は日本時間（JST）のカレンダーとして扱う
- 1つの日付に複数の収集種別がある場合は別々のオブジェクトとして出力する
- 対象期間外の日付は絶対に出力しない

出力形式は「ゴミ収集カレンダーの場合」と同じ。
`.trim()
}

function buildRecurringRulesSectionEn(fiscalYearStart: string, fiscalYearEnd: string): string {
  return `
### If the file contains only recurring collection day rules (not a grid calendar)

If the file contains recurring rules written as text, lists, or tables — such as
"Burnables every Tuesday", "Non-burnables on the 2nd and 4th Monday" — treat it as
isCalendar: true, isGarbageCalendar: true and expand all matching dates within the target period.

Target period:
- Start: ${fiscalYearStart}
- End: ${fiscalYearEnd}

Expansion rules:
- "Every [weekday]": list all occurrences of that weekday within the target period
- "2nd and 4th [weekday]": only the 2nd and 4th occurrences of that weekday each month
- "1st and 3rd [weekday]": only the 1st and 3rd occurrences each month
- Use Japan Standard Time (JST) when determining weekday occurrences
- If multiple collection types fall on the same date, output them as separate objects
- Never output dates outside the target period

Use the same output format as "garbage collection calendar" above.
`.trim()
}

/**
 * 統合プロンプト（日本語）
 * Gemini がファイルを解析し、カレンダー種別を自動判定しながら予定を抽出する。
 * - isCalendar: false → カレンダーでない
 * - isGarbageCalendar: true → ゴミ収集カレンダー (description 付き)
 * - isGarbageCalendar: false → 一般予定表 (date + title のみ)
 */
function buildAutoPrompt(fiscalYearStart?: string, fiscalYearEnd?: string): string {
  const recurringSection = (fiscalYearStart && fiscalYearEnd)
    ? `\n\n${buildRecurringRulesSection(fiscalYearStart, fiscalYearEnd)}`
    : ''

  return `
あなたはファイル（PDFまたは画像）から予定を抽出するAIです。

## Step 1: ファイル種別を判定する
添付ファイルが「スケジュール表・予定表・カレンダー・収集曜日ルール」のいずれでもない場合（例: 契約書・請求書・写真集など）は、
他の処理を行わず以下のJSONのみを返してください：
{ "isCalendar": false }

添付ファイルがカレンダー・予定表であるかどうかを判定し、さらに**自治体が配布するゴミ収集カレンダー**であるかどうかを判定してください。

## Step 2: 予定を抽出する

### ゴミ収集カレンダーの場合
ファイルに記載された**全ての**収集日を**一件も漏らさず**抽出し、以下の形式で返してください。

{
  "isCalendar": true,
  "isGarbageCalendar": true,
  "title": "ゴミ収集カレンダーの名称（例: 〇〇市 ゴミ収集カレンダー令和X年度）",
  "events": [
    { "date": "YYYY-MM-DD", "title": "ゴミの種類", "description": "出せるごみの内訳（例: ポリ袋・トレイ・ボトル類）" }
  ]
}

注意:
- 火曜日・水曜日など特定の曜日に固定されている収集も全て含めること
- title は**絶対に空にしてはいけない**。不明瞭な場合もファイルの該当セルに見える文字をそのまま使うこと
- 複数ヶ月分のカレンダーが横に並んでいる場合がある
- 各月のカレンダーは「日 月 火 水 木 金 土」のヘッダーを持つ
- 各週は「日付の行」と「収集種別の行」が交互に並ぶことが多い
- description はPDFに収集品目の内訳・説明が記載されている場合のみ設定すること。記載がなければ空文字 "" にすること
- 1つの日付に複数の収集種別がある場合は別々のオブジェクトとして出力すること
- 年が記載されていない場合は近隣セルの年・月から推定すること${recurringSection}

### ゴミ収集カレンダー以外の予定表（学校行事・地域イベント・シフト表など）の場合

{
  "isCalendar": true,
  "isGarbageCalendar": false,
  "title": "予定表の名称（例: 〇〇学校 年間行事予定表）",
  "events": [
    { "date": "YYYY-MM-DD", "title": "予定のタイトル" }
  ]
}

注意:
- 日付と予定タイトルをすべて抽出すること
- 1つの日付に複数の予定がある場合は別々のオブジェクトとして出力すること
- 年が不明な場合は文書内の他の日付や文脈から推定すること

## 共通の注意事項
- title (トップレベル) はファイルのタイトルや内容を要約した短い名称にすること
- events 内の date は ISO 8601 形式 (YYYY-MM-DD) で返すこと
- events 内の title は原文のまま返すこと（略称・記号もそのまま）
- events 内の title が空になる場合は絶対に出力しないこと（そのエントリ自体を除外すること）
- 上記のJSON構造以外は一切出力しないこと
`.trim()
}

function buildAutoPromptEn(fiscalYearStart?: string, fiscalYearEnd?: string): string {
  const recurringSection = (fiscalYearStart && fiscalYearEnd)
    ? `\n\n${buildRecurringRulesSectionEn(fiscalYearStart, fiscalYearEnd)}`
    : ''

  return `
You are an AI that extracts schedule information from files (PDF or image).

## Step 1: Determine the file type
If the attached file is NOT a schedule, calendar, event table, or collection day rules (e.g., a contract, invoice, or photo book),
return ONLY the following JSON without any other processing:
{ "isCalendar": false }

Determine whether the file is a calendar or schedule, and further determine whether it is a **garbage collection calendar distributed by a municipality**.

## Step 2: Extract events

### If it is a garbage collection calendar

{
  "isCalendar": true,
  "isGarbageCalendar": true,
  "title": "Name of the calendar (e.g. City Name Garbage Collection Calendar 202X)",
  "events": [
    { "date": "YYYY-MM-DD", "title": "Collection Type (in English)", "description": "Details if specified (e.g., plastic bags, trays, bottles)" }
  ]
}

Notes:
- Extract ALL collection dates without missing any, including recurring weekly collections
- The title must NEVER be empty inside events
- Multiple months may be arranged side by side
- description only if the file lists specific items; otherwise use empty string ""
- If multiple collection types occur on one date, output them as separate objects
- If the year is not shown, estimate from surrounding dates${recurringSection}

### If it is a general schedule (school events, community calendar, shift roster, etc.)

{
  "isCalendar": true,
  "isGarbageCalendar": false,
  "title": "Name of the schedule (e.g. School Annual Events Calendar)",
  "events": [
    { "date": "YYYY-MM-DD", "title": "Event Title (in English)" }
  ]
}

Notes:
- Extract all dates and event titles
- If multiple events occur on one date, output them as separate objects
- If the year is unknown, estimate from other dates or context in the document

## Common rules
- title (top level) should be a concise summary of the file's purpose
- events date must be in ISO 8601 format (YYYY-MM-DD)
- Never output an empty title inside events (exclude the entire entry)
- Output only the JSON object, nothing else
`.trim()
}

// ─────────────────────────────────────────────
// JSON 修復ユーティリティ
// ─────────────────────────────────────────────

/**
 * Gemini の thinking モデルが稀に末尾の `]` / `}` を省略したまま
 * finishReason=STOP を返すことがある。
 * このユーティリティは未閉じのブラケット・ブレースをカウントして補完する。
 */
function repairTruncatedJson(jsonStr: string): string {
  let braces = 0
  let brackets = 0
  let inString = false
  let i = 0

  while (i < jsonStr.length) {
    const ch = jsonStr[i]
    if (inString) {
      if (ch === '\\') { i += 2; continue }
      if (ch === '"') inString = false
    } else {
      if (ch === '"') inString = true
      else if (ch === '{') braces++
      else if (ch === '}') braces--
      else if (ch === '[') brackets++
      else if (ch === ']') brackets--
    }
    i++
  }

  let result = jsonStr.trimEnd()
  if (result.endsWith(',')) result = result.slice(0, -1)
  for (let j = 0; j < brackets; j++) result += ']'
  for (let j = 0; j < braces; j++) result += '}'
  return result
}

// ─────────────────────────────────────────────
// Gemini モデル生成
// ─────────────────────────────────────────────

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
      maxOutputTokens: 65536,
    },
  })
}

function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

// ─────────────────────────────────────────────
// 自動判定パーサー
// ─────────────────────────────────────────────

async function parseWithAutoPrompt(
  prompt: string,
  fileBuffer: Buffer,
  mimeType: string,
  fiscalYearStart?: string,
  fiscalYearEnd?: string,
): Promise<ParseResult> {
  const model = createGeminiModel()
  const base64Data = fileBuffer.toString('base64')

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
  ])

  const candidate = result.response.candidates?.[0]
  const finishReason = candidate?.finishReason
  const text = result.response.text().trim()
  console.info('[gemini] finishReason=%s responseChars=%d usage=%o',
    finishReason, text.length, result.response.usageMetadata)

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error(`Gemini returned unexpected format: ${text.slice(0, 200)}`)
  }

  let raw: {
    isCalendar?: boolean
    isGarbageCalendar?: boolean
    title?: string
    events?: Array<Record<string, string>>
  }
  try {
    raw = JSON.parse(match[0]) as typeof raw
  } catch (e) {
    console.error('[gemini] JSON parse failed. finishReason=%s tail=%s',
      finishReason, match[0].slice(-300))
    // finishReason=STOP でも末尾の ] / } が欠落する場合があるため修復を試みる
    const repaired = repairTruncatedJson(match[0])
    console.info('[gemini] Attempting JSON repair. originalLen=%d repairedLen=%d',
      match[0].length, repaired.length)
    raw = JSON.parse(repaired) as typeof raw
  }

  if ('isCalendar' in raw && raw.isCalendar === false) {
    throw new NotACalendarError()
  }

  const isGarbage = raw.isGarbageCalendar === true
  const hasFiscalRange = !!(fiscalYearStart && fiscalYearEnd)

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
      // 対象期間が指定されている場合: ISO 形式チェック＋期間内フィルタ
      if (hasFiscalRange) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) {
          console.warn('[gemini] skipping event with invalid date format:', ev)
          return false
        }
        if (!isDateInRange(ev.date, fiscalYearStart!, fiscalYearEnd!)) {
          console.warn('[gemini] skipping out-of-range event:', ev)
          return false
        }
      }
      return true
    })

  return {
    title: raw.title,
    events,
    parserMode: isGarbage ? 'garbage' : 'general',
  }
}

// ─────────────────────────────────────────────
// 手入力プロンプト（既存）
// ─────────────────────────────────────────────

function buildManualInstructionPrompt(
  instruction: string,
  fiscalYearStart: string,
  fiscalYearEnd: string,
  language: Language,
): string {
  if (language === 'en') {
    return `
You are an AI that converts natural-language garbage collection rules into concrete Google Calendar events.

## User instruction
${instruction}

## Target period
- Start date: ${fiscalYearStart}
- End date: ${fiscalYearEnd}

## Critical rules
- Expand recurring rules into ALL concrete dates within the target period.
- Interpret rules such as "every Tuesday", "Mondays and Thursdays", "2nd and 4th Friday", "first/third Wednesday", and equivalent Japanese expressions.
- Use the weekday and ordinal occurrence within each month in the local Japan calendar.
- If multiple garbage types occur on the same date, output separate event objects.
- Do not output dates outside the target period.
- If the instruction is ambiguous, infer conservatively and keep the original wording in description.

## Output
Return ONLY this JSON object:
{
  "title": "Manual garbage collection rules",
  "events": [
    { "date": "YYYY-MM-DD", "title": "Collection type", "description": "Source rule if useful" }
  ]
}
`.trim()
  }

  return `
あなたは自然文で書かれたゴミ収集ルールを、Googleカレンダー登録用の具体的な予定一覧へ変換するAIです。

## ユーザーの入力指示
${instruction}

## 対象期間
- 開始日: ${fiscalYearStart}
- 終了日: ${fiscalYearEnd}

## 最重要ルール
- 入力指示に含まれる繰り返しルールを、対象期間内のすべての具体日付へ展開してください。
- 「毎週火曜日」「月曜と木曜」「第2・4金」「第1・第3水曜」のような表現を正しく解釈してください。
- 「第2金曜」はその月の2回目の金曜日という意味です。
- 曜日・第n曜日の判定は日本時間のカレンダーとして扱ってください。
- 1つの日付に複数の収集種別がある場合は、別々のイベントとして出力してください。
- 対象期間外の日付は絶対に出力しないでください。
- 迷う表現がある場合は保守的に解釈し、description に元のルールを残してください。

## 出力形式
以下のJSONオブジェクトのみを返してください。説明文は不要です。
{
  "title": "手入力: ゴミ収集ルール",
  "events": [
    { "date": "YYYY-MM-DD", "title": "収集種別", "description": "必要に応じて元ルール" }
  ]
}
`.trim()
}

export async function parseManualGarbageInstruction(
  instruction: string,
  fiscalYearStart: string,
  fiscalYearEnd: string,
  language: Language = 'ja',
): Promise<ParseResult> {
  const model = createGeminiModel()
  const prompt = buildManualInstructionPrompt(instruction, fiscalYearStart, fiscalYearEnd, language)

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error(`Gemini returned unexpected format: ${text.slice(0, 200)}`)
  }

  const raw = JSON.parse(match[0]) as { title?: string; events?: Array<Record<string, string>> }
  const events: CalendarEvent[] = (raw.events || [])
    .map((item) => {
      const desc = (item.description ?? '').trim()
      return {
        date:        (item.date ?? '').trim(),
        title:       (item.title ?? item['garbage_type'] ?? '').trim(),
        description: desc || undefined,
      }
    })
    .filter((ev) => {
      if (!ev.date || !ev.title) {
        console.warn('[gemini/manual] skipping event with empty field:', ev)
        return false
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.date) || !isDateInRange(ev.date, fiscalYearStart, fiscalYearEnd)) {
        console.warn('[gemini/manual] skipping out-of-range event:', ev)
        return false
      }
      return true
    })

  return {
    title: raw.title ?? (language === 'en' ? 'Manual garbage collection rules' : '手入力: ゴミ収集ルール'),
    events,
    parserMode: 'garbage',
  }
}

// ─────────────────────────────────────────────
// GeminiAutoParser クラス
// ─────────────────────────────────────────────

export class GeminiAutoParser implements PdfParser {
  constructor(
    private readonly language: Language = 'ja',
    private readonly fiscalYearStart?: string,
    private readonly fiscalYearEnd?: string,
  ) {}

  async parse(fileBuffer: Buffer, mimeType: string): Promise<ParseResult> {
    const prompt = this.language === 'en'
      ? buildAutoPromptEn(this.fiscalYearStart, this.fiscalYearEnd)
      : buildAutoPrompt(this.fiscalYearStart, this.fiscalYearEnd)
    return parseWithAutoPrompt(prompt, fileBuffer, mimeType, this.fiscalYearStart, this.fiscalYearEnd)
  }
}

// 後方互換
export const GeminiPdfParser = GeminiAutoParser
export const GeminiGarbageParser = GeminiAutoParser
export const GeminiGeneralParser = GeminiAutoParser
