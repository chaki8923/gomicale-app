import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

// Google OAuth コールバック処理
// ・セッション確立
// ・リフレッシュトークンを user_integrations に upsert
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await getSupabaseServerClient()

  // 認証コードをセッションに交換
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.session) {
    console.error('[auth/callback] exchangeCodeForSession error:', error)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const { session, user } = data

  // Google provider_token (アクセストークン) と provider_refresh_token を保存
  // Supabase は OAuth セッション確立時にプロバイダートークンを session に含める
  const providerRefreshToken = session.provider_refresh_token
  const providerAccessToken  = session.provider_token

  if (providerRefreshToken) {
    const serviceClient = getSupabaseServiceClient()

    // RLS をバイパスして Service Role でトークンを保存
    // 暗号化は Supabase Edge Function または DB 関数で行う（ここではプレーンストア、本番要暗号化）
    const { error: upsertError } = await serviceClient
      .from('user_integrations')
      .upsert(
        {
          user_id: user.id,
          // 本番環境では pgp_sym_encrypt を通じて暗号化すること
          google_refresh_token_enc: providerRefreshToken,
          google_access_token_enc:  providerAccessToken ?? null,
          token_expires_at: session.expires_at
            ? new Date(session.expires_at * 1000).toISOString()
            : null,
        },
        { onConflict: 'user_id' },
      )

    if (upsertError) {
      console.error('[auth/callback] upsert user_integrations error:', upsertError)
      // トークン保存に失敗してもログイン自体は継続させる
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
