import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'
import type { Job } from '@/types/database'
import type { UnreadReply } from '@/components/InquiryReplyModal'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}`)

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

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

  return (
    <DashboardClient
      userEmail={user.email ?? ''}
      userId={user.id}
      initialJobs={(jobs ?? []) as Job[]}
      unreadReplies={unreadReplies}
    />
  )
}
