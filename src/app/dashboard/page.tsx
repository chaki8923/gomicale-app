import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'
import type { Job } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 最新 10 件のジョブ履歴を取得
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <DashboardClient
      userEmail={user.email ?? ''}
      initialJobs={(jobs ?? []) as Job[]}
    />
  )
}
