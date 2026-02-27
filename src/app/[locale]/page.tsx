import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/LandingPage'

export default async function RootPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect(`/${locale}/dashboard`)
  }

  return <LandingPage />
}
