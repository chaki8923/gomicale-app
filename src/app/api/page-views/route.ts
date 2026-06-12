import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { isLikelyBot, parseUserAgent } from '@/lib/device'

const MAX_PATH_LENGTH = 256
const MAX_REFERRER_LENGTH = 2048

type PageViewBody = {
  path?: string
  locale?: string
}

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get('user-agent')

  if (isLikelyBot(userAgent)) {
    return new NextResponse(null, { status: 204 })
  }

  let body: PageViewBody
  try {
    body = await request.json() as PageViewBody
  } catch {
    return new NextResponse(null, { status: 400 })
  }

  const path = typeof body.path === 'string' ? body.path.trim() : ''
  if (!path || path.length > MAX_PATH_LENGTH || !path.startsWith('/')) {
    return new NextResponse(null, { status: 400 })
  }

  const locale =
    typeof body.locale === 'string' && body.locale.length <= 16
      ? body.locale.trim()
      : null

  const referer = request.headers.get('referer')
  const referrer =
    referer && referer.length <= MAX_REFERRER_LENGTH ? referer : null

  const { deviceType, os, browser } = parseUserAgent(userAgent)

  try {
    const supabase = getSupabaseServiceClient()
    const { error } = await supabase.from('page_views').insert({
      path,
      locale,
      device_type: deviceType,
      os,
      browser,
      referrer,
    })

    if (error) {
      console.warn('[page-views] insert failed:', error.message)
    }
  } catch (err) {
    console.warn('[page-views] unexpected error:', err)
  }

  return new NextResponse(null, { status: 204 })
}
