import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'
import type { Job } from '@/types/database'
import type { UnreadReply } from '@/components/InquiryReplyModal'
import type { Metadata } from 'next'
import { hasSupportCooldownExpired } from '@/lib/support-server'
import { getAdminEmail } from '@/lib/admin-auth'
import { isAdminUser } from '@/lib/admin-identity'
import { AccountDeletionPanel } from '@/components/AccountDeletionPanel'
import { getDashboardData } from '@/lib/dashboard-data'

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

  const { deletion, jobs, completedJobs, successfulJobCount, latestSupportPayment, unreadReplies: unreadRepliesRaw, integration } = await getDashboardData(supabase,serviceClient,user.id)
  if (deletion) return <main className="min-h-screen bg-teal-50 p-4 pt-12"><div className="mx-auto max-w-2xl"><AccountDeletionPanel email={user.email ?? ''} accountId={user.id} initialPending /></div></main>

  const completedCount = successfulJobCount ?? 0
  const isSupportMilestone = completedCount === 1 || (completedCount > 0 && completedCount % 5 === 0)
  const supporterSince = latestSupportPayment?.paid_at ?? null
  const supportCooldownExpired = hasSupportCooldownExpired(supporterSince)

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

  // null/undefined = 未判定 → ブロックしない。false のときのみハードブロック
  const calendarScopeMissing = integration?.google_calendar_scope_ok === false

  // auth/callback で付与された query param でも強制表示
  const calendarPermissionRequired =
    resolvedSearchParams['calendar_permission'] === 'required'

  return (
    <DashboardClient
      isAdmin={isAdminUser(user, getAdminEmail())}
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
