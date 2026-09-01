import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'
import type { Job } from '@/types/database'
import type { UnreadReply } from '@/components/InquiryReplyModal'
import type { Metadata } from 'next'
import { hasSupportCooldownExpired } from '@/lib/support-server'

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  const resolvedSearchParams = await searchParams
  const supabase = await getSupabaseServerClient()
  const serviceClient = getSupabaseServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}`)

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: completedJobs, count: successfulJobCount } = await supabase
    .from('jobs')
    .select('id', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)

  const { data: latestSupportPayment } = await serviceClient
    .from('support_payments')
    .select('paid_at')
    .eq('user_id', user.id)
    .eq('status', 'paid')
    .gte('amount', 500)
    .order('paid_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const completedCount = successfulJobCount ?? 0
  const isSupportMilestone = completedCount === 1 || (completedCount > 0 && completedCount % 5 === 0)
  const supporterSince = latestSupportPayment?.paid_at ?? null
  const supportCooldownExpired = hasSupportCooldownExpired(supporterSince)

  // 最終既読日時を取得（なければ epoch）
  const { data: readData } = await supabase
    .from('inquiry_reply_reads')
    .select('last_read_at')
    .eq('user_id', user.id)
    .single()

  const lastReadAt = readData?.last_read_at ?? '1970-01-01T00:00:00Z'

  // 自分の投稿への未読返信を取得
  const { data: unreadRepliesRaw } = await supabase
    .from('inquiry_replies')
    .select('id, content, created_at, post_id, inquiry_posts!inner(id, content, user_id)')
    .gt('created_at', lastReadAt)
    .eq('inquiry_posts.user_id', user.id)
    .order('created_at', { ascending: true })

  const unreadReplies: UnreadReply[] = (unreadRepliesRaw ?? []).map((r) => {
    const post = r.inquiry_posts as unknown as { id: string; content: string; user_id: string }
    return {
      replyId: r.id,
      replyContent: r.content,
      replyCreatedAt: r.created_at,
      postContent: post.content,
      postId: post.id,
    }
  })

  const userName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    ''

  const userAvatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ?? ''

  // Google Calendar スコープフラグを取得（Service Role で RLS バイパス）
  const { data: integration } = await serviceClient
    .from('user_integrations')
    .select('google_calendar_scope_ok')
    .eq('user_id', user.id)
    .single()

  // null/undefined = 未判定 → ブロックしない。false のときのみハードブロック
  const calendarScopeMissing = integration?.google_calendar_scope_ok === false

  // auth/callback で付与された query param でも強制表示
  const calendarPermissionRequired =
    resolvedSearchParams['calendar_permission'] === 'required'

  return (
    <DashboardClient
      userEmail={user.email ?? ''}
      userId={user.id}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
      initialJobs={(jobs ?? []) as Job[]}
      unreadReplies={unreadReplies}
      calendarScopeMissing={calendarScopeMissing}
      calendarPermissionRequired={calendarPermissionRequired}
      isSupporter={Boolean(supporterSince)}
      showSupportPrompt={isSupportMilestone && supportCooldownExpired}
      successfulJobCount={completedCount}
      supportJobId={completedJobs?.[0]?.id}
    />
  )
}
