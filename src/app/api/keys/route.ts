import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { generateApiKey, hashApiKey } from '@/lib/apiKey'

/** GET /api/keys — ログインユーザーのAPIキー一覧を返す（平文は返さない） */
export async function GET() {
  const supabase = await getSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, last_used_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ keys: data })
}

/** POST /api/keys — 新しいAPIキーを生成し、平文を1度だけ返す */
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as { name?: string }
  const name = (body.name ?? '').trim() || null

  // キー数制限（1ユーザーあたり最大10件）
  const { count } = await supabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: 'API key limit reached (max 10)' }, { status: 400 })
  }

  const apiKey = generateApiKey()
  const keyHash = hashApiKey(apiKey)

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: user.id, key_hash: keyHash, name })
    .select('id, name, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ key: apiKey, meta: data }, { status: 201 })
}
