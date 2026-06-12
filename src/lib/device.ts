export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown'

export type ParsedUserAgent = {
  deviceType: DeviceType
  os: string | null
  browser: string | null
}

function detectOs(ua: string): string | null {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows NT/i.test(ua)) return 'Windows'
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS'
  if (/CrOS/i.test(ua)) return 'ChromeOS'
  if (/Linux/i.test(ua)) return 'Linux'
  return null
}

function detectBrowser(ua: string): string | null {
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/OPR\/|Opera/i.test(ua)) return 'Opera'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/CriOS|Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome'
  if (/Safari\//i.test(ua) && !/Chrome|CriOS|Chromium/i.test(ua)) return 'Safari'
  return null
}

function detectDeviceType(ua: string): DeviceType {
  if (!ua.trim()) return 'unknown'

  const isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua))
  const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua)
  if (isIPad || isAndroidTablet) return 'tablet'

  if (/Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return 'mobile'
  }

  return 'desktop'
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  const ua = userAgent ?? ''
  return {
    deviceType: detectDeviceType(ua),
    os: detectOs(ua),
    browser: detectBrowser(ua),
  }
}

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? '').toLowerCase()
  if (!ua) return true
  return /bot|crawler|spider|slurp|headless|lighthouse|preview|facebookexternalhit|bingpreview|googlebot|yandex|baiduspider|semrush|ahrefs|petalbot|bytespider|gptbot|claudebot|anthropic/i.test(ua)
}
