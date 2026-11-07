import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import { getAdminDashboardUrl } from '@/lib/admin-error-email-server'
import { ErrorEmailsClient } from './ErrorEmailsClient'

export const metadata: Metadata = {
  title: 'Error email management',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}
export const dynamic = 'force-dynamic'

export default async function ErrorEmailsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const session = await getAdminSession()
  if (session.status === 401) redirect(`/${locale}/login`)
  if (!session.user) notFound()
  return <ErrorEmailsClient dashboardUrl={getAdminDashboardUrl(locale)} />
}
