'use client'
import { useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'

/** Keep the public landing page cacheable; the query contains no private data. */
export function AccountDeletedNotice() {
  const params = useSearchParams()
  const locale = useLocale()
  if (params.get('accountDeleted')!=='1') return null
  return <div role="status" className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-4 text-center text-sm font-medium text-teal-900 shadow-lg">{locale==='en' ? 'Your account has been deleted. Events already in Google Calendar remain available.' : '退会が完了しました。Googleカレンダーに登録済みの予定は引き続きご利用いただけます。'}</div>
}
