'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { CalendarPermissionModal } from '@/components/CalendarPermissionModal'
import { getJobErrorCode, isCalendarReauthErrorCode, jobErrorMessage, JOB_SUMMARY_COLUMNS, type JobSummary, type JobResultDataLike } from '@/lib/job-errors'

interface JobStatusCardProps {
  jobId: string
  onComplete?: (job: JobSummary) => void
}

export function JobStatusCard({ jobId, onComplete }: JobStatusCardProps) {
  const t = useTranslations('jobStatus')
  const locale = useLocale()
  const [job, setJob] = useState<JobSummary | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    let finished = false
    const receive = (updated: JobSummary) => {
      if (finished || updated.id !== jobId) return
      setJob(updated)
      setLoadFailed(false)
      if (['completed', 'error', 'awaiting_confirmation'].includes(updated.status)) {
        finished = true
        clearInterval(poll)
        onComplete?.(updated)
        void supabase.removeChannel(channel)
      }
    }
    const load = async () => {
      try {
        const { data } = await supabase.from('jobs').select(JOB_SUMMARY_COLUMNS).eq('id', jobId).single()
        if (data) receive(data)
        else if (!finished) setLoadFailed(true)
      } catch {
        if (!finished) setLoadFailed(true)
      }
    }
    // Realtime may connect after a fast cached analysis finishes; polling closes that gap.
    const poll = setInterval(load, 3000)
    const channel = supabase.channel(`job-${jobId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
        payload => {
          const { id, status, created_at, pdf_title, result_data } = payload.new as JobSummary
          receive({ id, status, created_at, pdf_title, result_data })
        }).subscribe()
    void load()
    return () => { finished = true; clearInterval(poll); void supabase.removeChannel(channel) }

  }, [jobId, onComplete])

  const statusLabel: Record<JobSummary['status'], string> = {
    awaiting_confirmation: t('awaitingConfirmation'),
    pending:    t('pending'),
    processing: t('processing'),
    completed:  t('completed'),
    error:      t('error'),
  }

  const statusColor: Record<JobSummary['status'], string> = {
    awaiting_confirmation: 'bg-teal-100 text-teal-800',
    pending:    'bg-gray-100 text-gray-600',
    processing: 'bg-blue-100 text-blue-700',
    completed:  'bg-green-100 text-green-700',
    error:      'bg-red-100 text-red-600',
  }

  if (!job) {
    if (loadFailed) return <p role="status" className="rounded-xl bg-white p-5 text-sm text-red-700">{jobErrorMessage(null, locale)}</p>
    return <div className="animate-pulse rounded-xl bg-gray-100 h-20" />
  }

  const isProcessing = job.status === 'pending' || job.status === 'processing'
  const resultData = job.result_data as JobResultDataLike | null
  const errorCode = getJobErrorCode(job.result_data)
  const isCalendarPermissionError = isCalendarReauthErrorCode(errorCode)

  return (
    <>
    <CalendarPermissionModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      locale={locale}
    />
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isProcessing && (
              <span className="inline-block w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[job.status]}`}>
              {statusLabel[job.status]}
            </span>
          </div>

          {(job.status === 'awaiting_confirmation' || (job.result_data && typeof job.result_data === 'object' && !Array.isArray(job.result_data) && job.result_data.review_available)) && <Link href={`/${locale}/jobs/${job.id}/review`} className="mt-3 inline-flex rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white">{t('reviewImport')}</Link>}
          {job.status === 'completed' && resultData && (
            <p className="text-sm text-gray-700 mt-2">
              <span className="font-semibold text-teal-600 text-lg">
                {resultData.calendar_event_count}
              </span>
              {' '}{t('registeredTo')}
              {resultData.skipped_count != null && resultData.skipped_count > 0 && (
                <span className="text-gray-400 text-xs ml-1">
                  {t('skipped', { count: resultData.skipped_count })}
                </span>
              )}
            </p>
          )}

          {job.status === 'error' && isCalendarPermissionError && (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-red-500">{jobErrorMessage(errorCode, locale)}</p>
              <button
                onClick={() => { navigator.vibrate?.(10); setIsModalOpen(true) }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 px-3 py-1.5 rounded-lg cursor-pointer transition shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
                {t('calendarPermissionShowDetail')}
              </button>
            </div>
          )}

          {job.status === 'error' && !isCalendarPermissionError && (
            <p className="text-sm text-red-500 mt-2 break-all">
              {jobErrorMessage(errorCode, locale)}
            </p>
          )}

          {isProcessing && (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-500">{t(resultData?.registration_mode === 'auto' ? 'processingAuto' : resultData?.registration_mode === 'review' ? 'processingReview' : 'processingMessage')}</p>
              <p className="text-xs text-amber-600 font-medium">{t('processingTime')}</p>
            </div>
          )}
        </div>

        {job.status === 'completed' && (
          <svg className="w-8 h-8 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>

      <p className="text-xs text-gray-300 mt-3">
        {new Date(job.created_at).toLocaleString('ja-JP')}
      </p>
    </div>
    </>
  )
}
