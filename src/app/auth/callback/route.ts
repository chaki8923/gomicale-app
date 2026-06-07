import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { accessTokenHasCalendarScope } from '@/lib/google-calendar-access'
import type { Database } from '@/types/database'

// Google OAuth コールバック処理
// ・セッション確立（クッキーをリダイレクトレスポンスに明示的に設定）
// ・リフレッシュトークンを user_integrations に upsert
// ・provider_token で calendar.events スコープを検証し google_calendar_scope_ok を保存
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // next-intl のロケール cookie を参照（なければデフォルト 'ja'）
  const locale = request.cookies.get('NEXT_LOCALE')?.value ?? 'ja'
  const next = searchParams.get('next') ?? `/${locale}/dashboard`

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieNames = request.cookies.getAll().map(({ name }) => name)
  const hasPkceVerifierCookie = cookieNames.some((name) =>
    name.includes('code-verifier') || name.includes('code_verifier'),
  )
  const userAgent = request.headers.get('user-agent') ?? 'unknown'
  console.info('[auth/callback] pkce precheck', {
    hasCode: Boolean(code),
    hasPkceVerifierCookie,
    cookieNames,
    userAgent: userAgent.slice(0, 120),
  })

  // リダイレクトレスポンスを先に生成し、setAll でクッキーを直接このレスポンスに書き込む。
  // getSupabaseServerClient() (cookies() from next/headers) だと Route Handler の
  // NextResponse.redirect() にクッキーが確実に含まれないケースがあるため、
  // middleware.ts と同様のパターンで明示的に設定する。
  const response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // 認証コードをセッションに交換（setAll 経由でクッキーが response に書き込まれる）
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

  // calendar.events スコープの確認（provider_token があるときのみ実施）
  let calendarScopeOk: boolean | null = null
  if (providerAccessToken) {
    calendarScopeOk = await accessTokenHasCalendarScope(providerAccessToken)
    console.info('[auth/callback] calendar scope check:', calendarScopeOk)
  }

  if (providerRefreshToken) {
    const serviceClient = getSupabaseServiceClient()

    // RLS をバイパスして Service Role でトークンを保存
    // 暗号化は Supabase Edge Function または DB 関数で行う（ここではプレーンストア、本番要暗号化）
    const upsertData: {
      user_id: string
      google_refresh_token_enc: string
      google_access_token_enc: string | null
      token_expires_at: string | null
      google_calendar_scope_ok?: boolean
    } = {
      user_id: user.id,
      // 本番環境では pgp_sym_encrypt を通じて暗号化すること
      google_refresh_token_enc: providerRefreshToken,
      google_access_token_enc:  providerAccessToken ?? null,
      token_expires_at: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
    }

    // スコープが確定しているときのみフラグを設定（null の場合は既存値を保持）
    if (calendarScopeOk !== null) {
      upsertData.google_calendar_scope_ok = calendarScopeOk
    }

    const { error: upsertError } = await serviceClient
      .from('user_integrations')
      .upsert(upsertData, { onConflict: 'user_id' })

    if (upsertError) {
      console.error('[auth/callback] upsert user_integrations error:', upsertError)
      // トークン保存に失敗してもログイン自体は継続させる
    }
  } else if (providerAccessToken && calendarScopeOk !== null) {
    // refresh token が無い（再ログイン等）でも scope フラグのみ更新する
    const serviceClient = getSupabaseServiceClient()
    const { error: updateError } = await serviceClient
      .from('user_integrations')
      .update({ google_calendar_scope_ok: calendarScopeOk })
      .eq('user_id', user.id)
    if (updateError) {
      console.error('[auth/callback] update scope flag error:', updateError)
    }
  }

  // スコープが明確に欠落している場合は dashboard に query param を付けてリダイレクト
  if (calendarScopeOk === false) {
    // next に既に query が付いている場合を考慮して URL を組み立てる
    const redirectUrl = new URL(`${origin}${next}`)
    redirectUrl.searchParams.set('calendar_permission', 'required')
    return NextResponse.redirect(redirectUrl.toString(), {
      headers: response.headers,
    })
  }

  return response
}
