'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations, useLocale, type TranslationValues } from 'next-intl'
import { Button } from '@/components/ui/Button'

type ParserMode = 'garbage' | 'general'

interface UploadZoneProps {
  onUploadComplete: (jobId: string) => void
}

type UploadState = 'idle' | 'uploading' | 'starting' | 'done' | 'error'

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})
const AM_OPTIONS = TIME_OPTIONS.slice(0, 24)
const PM_OPTIONS = TIME_OPTIONS.slice(24)

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const t = useTranslations('upload')
  const locale = useLocale()
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [parserMode, setParserMode] = useState<ParserMode>('garbage')
  const [eventTime, setEventTime] = useState<string>('')
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false)
  const timePickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) {
        setIsTimePickerOpen(false)
      }
    }
    if (isTimePickerOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [isTimePickerOpen])

  useEffect(() => {
    if (!isLoading) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isLoading])

  const modeConfig: Record<ParserMode, { label: string; description: string }> = {
    garbage: { label: t('garbageLabel'), description: t('garbageDesc') },
    general: { label: t('generalLabel'), description: t('generalDesc') },
  }

  const processFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError(t('errorPdfOnly'))
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError(t('errorTooLarge'))
      return
    }

    setError(null)
    setProgress(0)

    try {
      // ── 1. presigned URL と jobId を取得 ─────────────────────
      const presignRes = await fetch('/api/upload/presign', { method: 'POST' })
      if (presignRes.status === 401) throw new Error(t('errorPresign'))
      if (presignRes.status === 429) throw new Error(t('errorLimitExceeded'))
      if (!presignRes.ok) throw new Error(t('errorUnexpected'))
      const { uploadUrl, jobId } = await presignRes.json() as { uploadUrl: string; jobId: string }

      // ── 2. ブラウザ → R2 へ直接アップロード（XHR で進捗取得）──
      setState('uploading')
      await uploadToR2(uploadUrl, file, setProgress, t)

      // ── 2. Lambda を非同期で起動 ─────────────────────────────
      setState('starting')
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const startRes = await fetch('/api/jobs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, parserMode, language: locale, eventTime, timezone }),
      })
      if (!startRes.ok) throw new Error(t('errorJobStart'))

      setState('done')
      onUploadComplete(jobId)
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : t('errorUnexpected'))
    }
  }, [onUploadComplete, parserMode, locale, t, eventTime])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }, [processFile])

  const isLoading = ['uploading', 'starting'].includes(state)

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <svg className="h-9 w-9 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">{t('processingModalTitle')}</h2>
            <p className="mb-1 text-base font-semibold text-red-600">{t('processingModalWarning')}</p>
            <p className="text-sm text-gray-500">{t('processingModalBody')}</p>
          </div>
        </div>
      )}
    <div className="w-full space-y-3">
      {/* モード選択 */}
      <div className="flex gap-2">
        {(Object.keys(modeConfig) as ParserMode[]).map((mode) => (
          <Button
            key={mode}
            type="button"
            onClick={() => { if (!isLoading) setParserMode(mode) }}
            disabled={isLoading}
            className={`
              flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all
              ${parserMode === mode
                ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:border-teal-300 hover:text-teal-600'
              }
              ${isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {modeConfig[mode].label}
          </Button>
        ))}
      </div>

      <p className="text-xs text-gray-400 px-1">{modeConfig[parserMode].description}</p>

      {/* 時間指定 */}
      <div className="px-1 py-1">
        <p className="text-sm font-medium text-gray-700 mb-2">{t('timeLabel')}</p>
        <div className="relative" ref={timePickerRef}>
          {/* トリガーボタン */}
          <Button
            type="button"
            onClick={() => { if (!isLoading) setIsTimePickerOpen((v) => !v) }}
            disabled={isLoading}
            className={`
              flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium
              transition-all duration-150 select-none
              ${eventTime
                ? 'bg-teal-50 border-teal-300 text-teal-700 shadow-sm'
                : 'bg-white border-gray-200 text-gray-500 hover:border-teal-300 hover:text-teal-600'
              }
              ${isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 6v6l4 2" />
            </svg>
            <span>{eventTime || t('timeNoSpec')}</span>
            <svg
              className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isTimePickerOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </Button>

          {/* ポップオーバー */}
          {isTimePickerOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
              {/* 終日オプション */}
              <Button
                type="button"
                onClick={() => { setEventTime(''); setIsTimePickerOpen(false) }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors
                  ${!eventTime ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}
                `}
              >
                <span className="text-base">🌙</span>
                <span>{t('timeNoSpec')}</span>
                {!eventTime && (
                  <svg className="ml-auto w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </Button>

              <div className="border-t border-gray-100" />

              {/* 時刻グリッド */}
              <div className="overflow-y-auto max-h-64 p-3 space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-1 mb-1.5">AM</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {AM_OPTIONS.map((time) => (
                      <Button
                        key={time}
                        type="button"
                        onClick={() => { setEventTime(time); setIsTimePickerOpen(false) }}
                        className={`
                          py-1.5 rounded-lg text-xs font-medium transition-all duration-100
                          ${eventTime === time
                            ? 'bg-teal-500 text-white shadow-sm scale-105'
                            : 'bg-gray-50 text-gray-600 hover:bg-teal-50 hover:text-teal-700'
                          }
                        `}
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-1 mb-1.5">PM</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PM_OPTIONS.map((time) => (
                      <Button
                        key={time}
                        type="button"
                        onClick={() => { setEventTime(time); setIsTimePickerOpen(false) }}
                        className={`
                          py-1.5 rounded-lg text-xs font-medium transition-all duration-100
                          ${eventTime === time
                            ? 'bg-teal-500 text-white shadow-sm scale-105'
                            : 'bg-gray-50 text-gray-600 hover:bg-teal-50 hover:text-teal-700'
                          }
                        `}
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="mt-1.5 text-xs text-gray-400">{t('timeHint')}</p>
      </div>

      {/* アップロードゾーン */}
      <label
        className={`
          flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer
          transition-all duration-200
          ${isDragOver ? 'border-teal-400 bg-teal-50' : 'border-gray-300 bg-white hover:bg-gray-50 hover:border-teal-300'}
          ${isLoading ? 'pointer-events-none opacity-60' : ''}
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileInput}
          disabled={isLoading}
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">
              {state === 'uploading' && t('uploading', { progress })}
              {state === 'starting' && t('starting')}
            </p>
            {state === 'uploading' && (
              <div className="w-48 bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-teal-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-gray-700">{t('dropzone')}</p>
            <p className="text-xs text-gray-400">{t('dropzoneHint')}</p>
          </div>
        )}
      </label>

      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
    </>
  )
}

// XHR で R2 の presigned URL に PDF を直接 PUT し、アップロード進捗を返す
function uploadToR2(
  uploadUrl: string,
  file: File,
  onProgress: (n: number) => void,
  t: (key: string, values?: TranslationValues) => string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', 'application/pdf')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(t('errorUploadFailed', { status: xhr.status })))
      }
    }

    xhr.onerror = () => {
      reject(new Error(t('errorNetwork')))
    }

    xhr.send(file)
  })
}
