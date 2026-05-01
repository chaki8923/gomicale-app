import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { updateSession } from './lib/supabase/middleware'
import { NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware(routing)

const MAINTENANCE_PATH = '/maintenance'
// Matches /maintenance or /ja/maintenance, /en/maintenance, etc.
const MAINTENANCE_RE = /^(\/[a-z]{2})?\/maintenance(\/|$)/

function withMaintenanceNoindex(response: NextResponse) {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true'
  const isApiRoute = pathname.startsWith('/api')
  const isAuthRoute = pathname.startsWith('/auth')
  const isStaticAsset = pathname.startsWith('/_next')
  const isMaintenancePath = MAINTENANCE_RE.test(pathname)

  if (isMaintenanceMode && !isApiRoute && !isAuthRoute && !isStaticAsset) {
    if (pathname !== MAINTENANCE_PATH) {
      // Redirect everything (including /ja/maintenance) to bare /maintenance
      const url = request.nextUrl.clone()
      url.pathname = MAINTENANCE_PATH
      return withMaintenanceNoindex(NextResponse.redirect(url))
    }
    // Serve /maintenance directly without going through intl routing
    return withMaintenanceNoindex(NextResponse.next())
  }

  // If maintenance mode is off but someone visits /maintenance (any locale), redirect to home
  if (!isMaintenanceMode && isMaintenancePath) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // External webhooks: bypass Supabase session update entirely
  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next()
  }

  // API routes and auth callback don't need locale routing
  if (pathname.startsWith('/api') || pathname.startsWith('/auth')) {
    return updateSession(request)
  }

  // Apply next-intl locale routing
  const intlResponse = intlMiddleware(request)

  // If it's a redirect (adding locale prefix), return immediately
  if (intlResponse.headers.get('location')) {
    return intlResponse
  }

  // Apply Supabase session update and carry over intl headers
  const supabaseResponse = await updateSession(request)
  intlResponse.headers.forEach((value, key) => {
    supabaseResponse.headers.set(key, value)
  })

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest|sw\\.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
