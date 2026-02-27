'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Job } from '@/types/database'

interface JobStatusCardProps {
  jobId: string
  onComplete?: (job: Job) => void
}

export function JobStatusCard({ jobId, onComplete }: JobStatusCardProps) {
  const t = useTranslations('jobStatus')
  const [job, setJob] = useState<Job | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()
      .then(({ data }) => { if (data) setJob(data as Job) })

    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const updated = payload.new as Job
          setJob(updated)
          if (updated.status === 'completed' || updated.status === 'error') {
            onComplete?.(updated)
            supabase.removeChannel(channel)
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [jobId, onComplete])

  const statusLabel: Record<Job['status'], string> = {
    pending:    t('pending'),
    processing: t('processing'),
    completed:  t('completed'),
    error:      t('error'),
  }

  const statusColor: Record<Job['status'], string> = {
    pending:    'bg-gray-100 text-gray-600',
    processing: 'bg-blue-100 text-blue-700',
    completed:  'bg-green-100 text-green-700',
    error:      'bg-red-100 text-red-600',
  }

  if (!job) {
    return <div className="animate-pulse rounded-xl bg-gray-100 h-20" />
  }

  const isProcessing = job.status === 'pending' || job.status === 'processing'
  const resultData = job.result_data as { calendar_event_count?: number; skipped_count?: number } | null

  return (
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

          {job.status === 'error' && (
            <p className="text-sm text-red-500 mt-2 break-all">
              {job.error_message ?? t('unknownError')}
            </p>
          )}

          {isProcessing && (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-500">{t('processingMessage')}</p>
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
  )
}
