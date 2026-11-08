import { useLocale } from 'next-intl'

export default function DashboardLoading() {
  const locale = useLocale()
  return <main className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 px-4 py-12" aria-busy="true">
    <div className="mx-auto max-w-2xl space-y-6">
      <p role="status" className="text-sm font-medium text-teal-800">{locale==='en'?'Loading your dashboard…':'ダッシュボードを読み込んでいます…'}</p>
      <div aria-hidden="true" className="space-y-6 animate-pulse motion-reduce:animate-none">
        <div className="h-20 rounded-2xl bg-white/80" /><div className="h-72 rounded-2xl bg-white/80" /><div className="h-40 rounded-2xl bg-white/80" />
      </div>
    </div>
  </main>
}
