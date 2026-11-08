import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** Request-scoped only: user-specific data must never enter a shared cache. */
export async function getDashboardData(userDb: SupabaseClient<Database>, serviceDb: SupabaseClient<Database>, userId: string) {
  const unreadReplies = async () => {
    const { data: readData } = await userDb.from('inquiry_reply_reads').select('last_read_at').eq('user_id',userId).maybeSingle()
    return userDb.from('inquiry_replies').select('id, content, created_at, post_id, inquiry_posts!inner(id, content, user_id)')
      .gt('created_at',readData?.last_read_at ?? '1970-01-01T00:00:00Z').eq('inquiry_posts.user_id',userId).order('created_at')
  }
  const [deletion,jobs,completed,support,replies,integration] = await Promise.all([
    serviceDb.from('account_deletion_requests').select('user_id').eq('user_id',userId).maybeSingle(),
    userDb.from('jobs').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(10),
    userDb.from('jobs').select('id',{count:'exact'}).eq('user_id',userId).eq('status','completed').order('created_at',{ascending:false}).limit(1),
    serviceDb.from('support_payments').select('paid_at').eq('user_id',userId).eq('status','paid').gte('amount',500).order('paid_at',{ascending:false}).limit(1).maybeSingle(),
    unreadReplies(),
    serviceDb.from('user_integrations').select('google_calendar_scope_ok').eq('user_id',userId).maybeSingle(),
  ])
  if (deletion.error) throw new Error('Account status unavailable')
  return {deletion:deletion.data,jobs:jobs.data,completedJobs:completed.data,successfulJobCount:completed.count,
    latestSupportPayment:support.data,unreadReplies:replies.data,integration:integration.data}
}
