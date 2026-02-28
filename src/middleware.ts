import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { updateSession } from './lib/supabase/middleware'
import type { NextRequest } from 'next/server'

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
    '/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
