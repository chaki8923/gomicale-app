import { NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = getSupabaseServiceClient()
  const { data: streak } = await serviceClient
    .from('user_streaks')
    .select('current_streak, longest_streak, total_classifications')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(
    streak ?? { current_streak: 0, longest_streak: 0, total_classifications: 0 }
  )
}
