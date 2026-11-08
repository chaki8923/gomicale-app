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
  const host = request.nextUrl.hostname

  // Canonical host: force www -> apex so OAuth start/callback share same host cookie jar
  if (host === 'www.gomicale.jp') {
    const url = request.nextUrl.clone()
    url.hostname = 'gomicale.jp'
    url.protocol = 'https:'
    return NextResponse.redirect(url, 301)
  }

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

  // Supabase OAuth が Redirect URLs 未登録により Site URL にフォールバックした場合の救済
  // /, /ja, /en に ?code= 付きでリダイレクトされてきた場合は /auth/callback に転送する
  const codeParam = request.nextUrl.searchParams.get('code')
  const isHomePage = pathname === '/' || pathname === '/ja' || pathname === '/en'
  if (codeParam && isHomePage) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    return NextResponse.redirect(url)
  }

  // External webhooks: bypass Supabase session update entirely
  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next()
  }

  // Auth routes must bypass middleware session updates so PKCE callback cookies are untouched
  if (pathname.startsWith('/auth')) {
    return NextResponse.next()
  }

  // API routes don't need locale routing
  if (pathname.startsWith('/api')) {
    // Each API validates its own user and can refresh cookies in its Route Handler.
    return NextResponse.next()
  }

  // Apply next-intl locale routing
  const intlResponse = intlMiddleware(request)

  // If it's a redirect (adding locale prefix), return immediately
  if (intlResponse.headers.get('location')) {
    return intlResponse
  }

  // Anonymous public pages need no Auth round-trip or per-user rendering.
  const hasSession = request.cookies.getAll().some(({name})=>/^sb-.+-auth-token(?:\.\d+)?$/.test(name))
  const protectedPage = /^(?:\/(?:ja|en))?\/(?:dashboard|admin)(?:\/|$)/.test(pathname)
  if (!hasSession && !protectedPage) return intlResponse

  const supabaseResponse = await updateSession(request)
  if (supabaseResponse.headers.has('location')) return supabaseResponse
  const overrides = new Set((supabaseResponse.headers.get('x-middleware-override-headers') ?? '').split(',').map(s=>s.trim()).filter(Boolean))
  intlResponse.headers.forEach((value, key) => {
    // Preserve refreshed Auth cookies and forwarded request cookies when composing middleware.
    if (key==='set-cookie') return
    if (key==='x-middleware-override-headers') {
      value.split(',').forEach(name=>overrides.add(name.trim()))
      return
    }
    if (key==='x-middleware-request-cookie' && supabaseResponse.headers.has(key)) return
    supabaseResponse.headers.set(key, value)
  })
  if (overrides.size) supabaseResponse.headers.set('x-middleware-override-headers',[...overrides].join(','))
  intlResponse.cookies.getAll().forEach(cookie=>supabaseResponse.cookies.set(cookie))
  supabaseResponse.headers.set('Cache-Control','private, no-store')

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest|sw\\.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
