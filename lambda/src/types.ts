export type ParserMode = 'garbage' | 'general'
export type Language = 'ja' | 'en'

export interface LambdaPayload {
  jobId: string
  userId: string
  r2ObjectKey: string
  parserMode?: ParserMode
  language?: Language
}

export interface CalendarEvent {
  date: string         // ISO 8601: "2026-04-01"
  title: string        // イベントタイトル
  description?: string // 詳細説明（PDF記載がある場合のみ）
}

// 後方互換
export type GarbageEvent = CalendarEvent

export interface ParseResult {
  title?: string
  events: CalendarEvent[]
}
