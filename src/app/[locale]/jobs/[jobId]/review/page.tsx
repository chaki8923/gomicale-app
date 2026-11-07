import { redirect, notFound } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { ReviewClient } from './ReviewClient'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Review calendar import', robots: { index: false, follow: false } }
export default async function ReviewPage({ params }: { params: Promise<{ locale: string; jobId: string }> }) {
  const { locale, jobId } = await params
  const auth = await getSupabaseServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!/^[\da-f-]{36}$/i.test(jobId)) notFound()
  const { data } = await getSupabaseServiceClient().from('calendar_imports').select('job_id').eq('job_id', jobId).eq('user_id', user.id).maybeSingle()
  if (!data) notFound()
  return <ReviewClient jobId={jobId} />
}
