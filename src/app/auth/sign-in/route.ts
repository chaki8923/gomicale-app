import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  // code_verifier を Set-Cookie で書き込むためのダミーレスポンスを用意する
  // 実際のリダイレクト先は後で data.url に差し替える
  const dummyResponse = NextResponse.redirect(`${origin}/`)

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            dummyResponse.cookies.set(name, value, options),
          )
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

  // code_verifier クッキー (Set-Cookie ヘッダー) を保持しつつ Google にリダイレクト
  return NextResponse.redirect(data.url, { headers: dummyResponse.headers })
}
