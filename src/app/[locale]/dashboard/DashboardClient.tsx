'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { UploadZone } from '@/components/UploadZone'
import { JobStatusCard } from '@/components/JobStatusCard'
import { AdBanner } from '@/components/AdBanner'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { GarbageClassifier } from './GarbageClassifier'
import type { Job } from '@/types/database'

interface DashboardClientProps {
  userEmail: string
  initialJobs: Job[]
}

export function DashboardClient({ userEmail, initialJobs }: DashboardClientProps) {
  const router = useRouter()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [activeJobIds, setActiveJobIds] = useState<string[]>([])

  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const handleUploadComplete = useCallback((jobId: string) => {
    setActiveJobIds((prev) => [jobId, ...prev])
  }, [])

  const handleJobComplete = useCallback(() => {
    router.refresh()
  }, [router])

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push(`/${locale}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/servise_logo.webp" alt={tCommon('appName')} width={300} height={80} className="h-16 w-auto object-contain" priority />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <span className="text-sm text-gray-500 hidden sm:block">{userEmail}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-gray-600 transition"
            >
              {tCommon('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('uploadTitle')}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('uploadDescription')}</p>
          <UploadZone onUploadComplete={handleUploadComplete} />
        </section>

        {activeJobIds.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('processingTitle')}</h2>
            <div className="space-y-3">
              {activeJobIds.map((jobId) => (
                <JobStatusCard
                  key={jobId}
                  jobId={jobId}
                  onComplete={handleJobComplete}
                />
              ))}
            </div>
          </section>
        )}

        {initialJobs.length > 0 && (
          <section>
            <div 
              className="flex items-center justify-between cursor-pointer group mb-3"
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            >
              <h2 className="text-lg font-semibold text-gray-800 group-hover:text-teal-600 transition">
                {t('historyTitle')}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-500 group-hover:text-teal-600 transition">
                <span>{isHistoryOpen ? t('toggleHistoryHide') : t('toggleHistoryShow')}</span>
                <svg 
                  className={`w-5 h-5 transition-transform duration-200 ${isHistoryOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            {isHistoryOpen && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                {initialJobs
                  .filter((j) => !activeJobIds.includes(j.id))
                  .map((job) => (
                    <div
                      key={job.id}
                      className="rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-bold text-gray-900 line-clamp-1" title={job.pdf_title || t('untitledPdf')}>
                            {job.pdf_title || t('untitledPdf')}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {job.status === 'completed' && job.result_data && (() => {
                            const rd = job.result_data as { calendar_event_count?: number; skipped_count?: number }
                            const inserted = rd.calendar_event_count ?? 0
                            const skipped = rd.skipped_count ?? 0
                            return (
                              <p className="text-sm text-gray-700 flex items-center gap-1">
                                <span className="font-semibold text-teal-600">{inserted}</span>
                                <span>{t('registeredSuffix')}</span>
                                {skipped > 0 && (
                                  <span className="text-gray-400 text-xs">
                                    {t('skipped', { count: skipped })}
                                  </span>
                                )}
                              </p>
                            )
                          })()}
                          {job.status === 'error' && (
                            <p className="text-sm text-red-400">{t('errorPrefix')}{job.error_message}</p>
                          )}
                          {(job.status === 'pending' || job.status === 'processing') && (
                            <p className="text-sm text-blue-500">{t('processing')}</p>
                          )}
                          <p className="text-xs text-gray-400">
                            {new Date(job.created_at).toLocaleString(locale === 'en' ? 'en-US' : 'ja-JP', { timeZone: 'Asia/Tokyo' })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="shrink-0 flex sm:justify-end">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            job.status === 'completed' ? 'bg-green-100 text-green-700' :
                            job.status === 'error'     ? 'bg-red-100 text-red-600'    :
                                                         'bg-blue-100 text-blue-600'
                          }`}
                        >
                          {job.status === 'completed' ? t('statusCompleted') :
                           job.status === 'error'     ? t('statusError')     : t('statusProcessing')}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        )}

        {activeJobIds.length === 0 && initialJobs.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">♻️</p>
            <p className="text-sm">{t('emptyTitle')}</p>
            <p className="text-xs mt-1">{t('emptySubtitle')}</p>
          </div>
        )}

        <section>
          <GarbageClassifier />
        </section>

        <div className="pt-4">
          <AdBanner slot="3248117735" />
        </div>
      </main>

      <footer className="mt-12 py-6 border-t border-gray-100 bg-white">
        <div className="max-w-2xl mx-auto px-4 flex flex-wrap justify-center gap-4 text-xs text-gray-400">
          <Link href="/terms" className="hover:text-gray-600 transition">{tCommon('terms')}</Link>
          <Link href="/privacy" className="hover:text-gray-600 transition">{tCommon('privacy')}</Link>
          <Link href="/legal" className="hover:text-gray-600 transition">{tCommon('legal')}</Link>
        </div>
        <p className="text-center text-xs text-gray-300 mt-3">{tCommon('copyright', { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  )
}
