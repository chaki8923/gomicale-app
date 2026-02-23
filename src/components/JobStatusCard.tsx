'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Job } from '@/types/database'

interface JobStatusCardProps {
  jobId: string
  onComplete?: (job: Job) => void
}

const STATUS_LABEL: Record<Job['status'], string> = {
  pending:    '待機中',
  processing: '解析・登録中',
  completed:  '完了',
  error:      'エラー',
}

const STATUS_COLOR: Record<Job['status'], string> = {
  pending:    'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-700',
  completed:  'bg-green-100 text-green-700',
  error:      'bg-red-100 text-red-600',
}

export function JobStatusCard({ jobId, onComplete }: JobStatusCardProps) {
  const [job, setJob] = useState<Job | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    // 初回フェッチ
    supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()
      .then(({ data }) => { if (data) setJob(data as Job) })

    // Supabase Realtime でリアルタイム監視
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

  if (!job) {
    return (
      <div className="animate-pulse rounded-xl bg-gray-100 h-20" />
    )
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
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[job.status]}`}>
              {STATUS_LABEL[job.status]}
            </span>
          </div>

          {job.status === 'completed' && resultData && (
            <p className="text-sm text-gray-700 mt-2">
              <span className="font-semibold text-teal-600 text-lg">
                {resultData.calendar_event_count}件
              </span>
              {' '}をGoogleカレンダーに登録しました
              {resultData.skipped_count != null && resultData.skipped_count > 0 && (
                <span className="text-gray-400 text-xs ml-1">
                  （{resultData.skipped_count}件は既存のため省略）
                </span>
              )}
            </p>
          )}

          {job.status === 'error' && (
            <p className="text-sm text-red-500 mt-2 break-all">
              {job.error_message ?? '不明なエラーが発生しました'}
            </p>
          )}

          {isProcessing && (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-500">
                PDFの解析とGoogleカレンダーへの登録を開始しました。
              </p>
              <p className="text-xs text-amber-600 font-medium">
                完了まで約10分程度かかります。完了後にメールでお知らせします。
              </p>
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
