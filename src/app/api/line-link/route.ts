import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

/** POST /api/line-link — LINE連携用の6桁コードを生成する */
export async function POST() {
  const supabase = await getSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = getSupabaseServiceClient()

  // 既存の未使用コードを削除（1ユーザー1コード）
  await serviceClient
    .from('line_link_codes')
    .delete()
    .eq('user_id', user.id)

  // 6桁のランダム数字コードを生成
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10分後

  const { data, error } = await serviceClient
    .from('line_link_codes')
    .insert({ user_id: user.id, code, expires_at: expiresAt })
    .select('code, expires_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ code: data.code, expiresAt: data.expires_at })
}

/** GET /api/line-link — LINE連携状態を返す */
export async function GET() {
  const supabase = await getSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = getSupabaseServiceClient()
  const { data } = await serviceClient
    .from('user_integrations')
    .select('line_user_id')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ linked: !!data?.line_user_id })
}

/** DELETE /api/line-link — LINE連携を解除する */
export async function DELETE(_request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = getSupabaseServiceClient()
  await serviceClient
    .from('user_integrations')
    .update({ line_user_id: null })
    .eq('user_id', user.id)

  return new NextResponse(null, { status: 204 })
}
