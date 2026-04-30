import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { updateSession } from './lib/supabase/middleware'
import { NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware(routing)

const MAINTENANCE_PATH = '/maintenance'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Maintenance mode: redirect all non-API traffic to /maintenance
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true'
  const isMaintenancePage = pathname === MAINTENANCE_PATH
  const isApiRoute = pathname.startsWith('/api')
  const isAuthRoute = pathname.startsWith('/auth')
  const isStaticAsset = pathname.startsWith('/_next')

  if (isMaintenanceMode && !isMaintenancePage && !isApiRoute && !isAuthRoute && !isStaticAsset) {
    const url = request.nextUrl.clone()
    url.pathname = MAINTENANCE_PATH
    return NextResponse.redirect(url)
  }

  // If maintenance mode is off but someone visits /maintenance, redirect to home
  if (!isMaintenanceMode && isMaintenancePage) {
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
