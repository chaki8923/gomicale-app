export function inquiryPostId(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null
}

export function inquiryLoginReturn(pathname: string, value: unknown): string | undefined {
  const locale = pathname.match(/^\/(ja|en)\/?$/)?.[1]
  const postId = inquiryPostId(value)
  return locale && postId ? `/${locale}/dashboard?inquiry=${postId}` : undefined
}
