import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  // getSupabaseServerClient は cookies() from next/headers を使用しており、
  // setAll → cookieStore.set() で書き込まれたクッキーは Next.js が
  // レスポンスに自動付与するため、手動のクッキー操作は不要
  const supabase = await getSupabaseServerClient()

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

  return NextResponse.redirect(data.url)
}
