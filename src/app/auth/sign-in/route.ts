import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

type CookieToSet = {
  name: string
  value: string
  options?: Record<string, unknown>
}

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  // Supabase が setAll で書き込むクッキー（code_verifier 等）を一旦配列に収集する。
  // NextResponse.redirect(url, { headers }) に Headers オブジェクトを渡すと
  // Set-Cookie が欠落するため、response.cookies.set() で明示的に適用する。
  const pendingCookies: CookieToSet[] = []

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach((c) => pendingCookies.push(c))
        },
      },
    },
  )

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      scopes: [
        'https://www.googleapis.com/auth/calendar.events',
        'openid',
        'email',
        'profile',
      ].join(' '),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error || !data.url) {
    console.error('[auth/sign-in] signInWithOAuth error:', error)
    return NextResponse.redirect(`${origin}/login?error=oauth_init_failed`)
  }

  // Google へのリダイレクトレスポンスに code_verifier クッキーを確実に付与する
  const response = NextResponse.redirect(data.url)
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]),
  )
  return response
}
