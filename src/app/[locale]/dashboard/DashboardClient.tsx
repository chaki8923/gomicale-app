'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { UploadZone } from '@/components/UploadZone'
import { ManualScheduleInput } from '@/components/ManualScheduleInput'
import { JobStatusCard } from '@/components/JobStatusCard'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { GarbageClassifier } from './GarbageClassifier'
import { LineLinkManager } from './LineLinkManager'
import { CalendarPermissionModal } from '@/components/CalendarPermissionModal'
import { InquiryPanel } from '@/components/InquiryPanel'
import { InquiryReplyModal } from '@/components/InquiryReplyModal'
import { getJobErrorCode, isCalendarReauthErrorCode, type JobResultDataLike } from '@/lib/job-errors'
import type { Job } from '@/types/database'
import type { UnreadReply } from '@/components/InquiryReplyModal'

const CALENDAR_PERMISSION_ERROR_MARKER = 'Googleカレンダーへのアクセス権限'

interface DashboardClientProps {
  userEmail: string
  userId: string
  userName: string
  userAvatarUrl: string
  initialJobs: Job[]
  unreadReplies: UnreadReply[]
  calendarScopeMissing: boolean
  calendarPermissionRequired: boolean
}

export function DashboardClient({
  userEmail,
  userId,
  userName,
  userAvatarUrl,
  initialJobs,
  unreadReplies,
  calendarScopeMissing,
  calendarPermissionRequired,
}: DashboardClientProps) {
  const router = useRouter()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tJobStatus = useTranslations('jobStatus')
  const locale = useLocale()
  const [activeJobIds, setActiveJobIds] = useState<string[]>([])

  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  // スコープ欠落 or callback query param があれば初期表示でモーダルを開く
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(
    calendarScopeMissing || calendarPermissionRequired,
  )
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(unreadReplies.length > 0)

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

  const historyJobs = initialJobs.filter((j) => !activeJobIds.includes(j.id))
  const showToggle = historyJobs.length > 3

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50">
      <CalendarPermissionModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        locale={locale}
      />
      {isReplyModalOpen && (
        <InquiryReplyModal
          unreadReplies={unreadReplies}
          userId={userId}
          onClose={() => setIsReplyModalOpen(false)}
        />
      )}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/servise_logo.webp" alt={tCommon('appName')} width={300} height={80} className="h-16 w-auto object-contain" priority />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <div className="hidden sm:flex items-center gap-2">
              {userAvatarUrl ? (
                <Image
                  src={userAvatarUrl}
                  alt={userName}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-medium">
                  {userName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-sm text-gray-500">{userName}</span>
            </div>
            <Button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              {tCommon('logout')}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <main className="flex-1 max-w-2xl mx-auto px-4 py-10 space-y-8">

          {/* カレンダー権限欠落バナー（ハードブロック） */}
          {calendarScopeMissing && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-700 mb-1">{t('calendarGate.bannerTitle')}</p>
                <p className="text-xs text-red-600">{t('calendarGate.bannerDescription')}</p>
              </div>
              <button
                onClick={() => setIsCalendarModalOpen(true)}
                className="shrink-0 px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-xl transition shadow-sm cursor-pointer"
              >
                {t('calendarGate.bannerButton')}
              </button>
            </div>
          )}

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('uploadTitle')}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('uploadDescription')}</p>
          {calendarScopeMissing ? (
            <LockedCard
              title={t('calendarGate.lockCardTitle')}
              description={t('calendarGate.lockCardDescription')}
              onUnlock={() => setIsCalendarModalOpen(true)}
              buttonLabel={t('calendarGate.bannerButton')}
            />
          ) : (
            <UploadZone onUploadComplete={handleUploadComplete} />
          )}
        </section>

        <section>
          {calendarScopeMissing ? null : (
            <ManualScheduleInput onStart={handleUploadComplete} />
          )}
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

        {historyJobs.length > 0 && (
          <section>
            <div 
              className={`flex items-center justify-between mb-3 ${showToggle ? 'cursor-pointer group' : ''}`}
              onClick={() => showToggle && setIsHistoryOpen(!isHistoryOpen)}
            >
              <h2 className={`text-lg font-semibold text-gray-800 ${showToggle ? 'group-hover:text-teal-600 transition' : ''}`}>
                {t('historyTitle')}
              </h2>
              {showToggle && (
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
              )}
            </div>
            
            {(!showToggle || isHistoryOpen) && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                {historyJobs.map((job) => (
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
                            const rd = job.result_data as JobResultDataLike
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
                          {job.status === 'error' && (() => {
                            const errorCode = getJobErrorCode(job.result_data)
                            const isCalendarErrorByCode = isCalendarReauthErrorCode(errorCode)
                            const isCalendarErrorByMessage =
                              typeof job.error_message === 'string' &&
                              job.error_message.includes(CALENDAR_PERMISSION_ERROR_MARKER)
                            return isCalendarErrorByCode || isCalendarErrorByMessage
                          })() && (
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm text-red-400">{t('errorPrefix')}{job.error_message}</p>
                              <button
                                onClick={() => { navigator.vibrate?.(10); setIsCalendarModalOpen(true) }}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 px-3 py-1.5 rounded-lg cursor-pointer transition shadow-sm"
                              >
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                                </svg>
                                {tJobStatus('calendarPermissionShowDetail')}
                              </button>
                            </div>
                          )}
                          {job.status === 'error' && (() => {
                            const errorCode = getJobErrorCode(job.result_data)
                            const isCalendarErrorByCode = isCalendarReauthErrorCode(errorCode)
                            const isCalendarErrorByMessage =
                              typeof job.error_message === 'string' &&
                              job.error_message.includes(CALENDAR_PERMISSION_ERROR_MARKER)
                            return !(isCalendarErrorByCode || isCalendarErrorByMessage)
                          })() && (
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

        <section>
          <LineLinkManager hasCompletedJob={initialJobs.some((j) => j.status === 'completed')} />
        </section>

      </main>
      </div>

      {initialJobs.length > 0 && (
        <InquiryPanel userEmail={userEmail} />
      )}

      <footer className="mt-12 py-6 border-t border-gray-100 bg-white">
        <div className="max-w-2xl mx-auto px-4 flex flex-wrap justify-center gap-4 text-xs text-gray-400">
          <Link href="/about" className="hover:text-gray-600 transition">{tCommon('about')}</Link>
          <Link href="/contact" className="hover:text-gray-600 transition">{tCommon('contact')}</Link>
          <Link href="/terms" className="hover:text-gray-600 transition">{tCommon('terms')}</Link>
          <Link href="/privacy" className="hover:text-gray-600 transition">{tCommon('privacy')}</Link>
          <Link href="/legal" className="hover:text-gray-600 transition">{tCommon('legal')}</Link>
        </div>
        <p className="text-center text-xs text-gray-300 mt-3">{tCommon('copyright', { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  )
}

interface LockedCardProps {
  title: string
  description: string
  onUnlock: () => void
  buttonLabel: string
}

function LockedCard({ title, description, onUnlock, buttonLabel }: LockedCardProps) {
  return (
    <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50 px-6 py-8 flex flex-col items-center gap-4 text-center">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-red-700 mb-1">{title}</p>
        <p className="text-xs text-red-500">{description}</p>
      </div>
      <button
        onClick={onUnlock}
        className="px-5 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-xl transition shadow-sm cursor-pointer"
      >
        {buttonLabel}
      </button>
    </div>
  )
}
