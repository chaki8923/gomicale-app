export const SUPPORT_AMOUNTS = [300, 500, 1000, 3000] as const
export const DEFAULT_SUPPORT_AMOUNT = 500

export const SUPPORT_SOURCES = [
  'donate_page',
  'job_completed',
  'classification_milestone',
] as const

export type SupportSource = (typeof SUPPORT_SOURCES)[number]

export const REVENUE_EVENTS = [
  'support_cta_impression',
  'support_cta_click',
  'support_cta_dismissed',
  'checkout_created',
  'payment_completed',
  'payment_failed',
] as const

export type RevenueEventName = (typeof REVENUE_EVENTS)[number]

export function isSupportSource(value: unknown): value is SupportSource {
  return typeof value === 'string' && SUPPORT_SOURCES.includes(value as SupportSource)
}

export function isRevenueEventName(value: unknown): value is RevenueEventName {
  return typeof value === 'string' && REVENUE_EVENTS.includes(value as RevenueEventName)
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
