'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations, useLocale, type TranslationValues } from 'next-intl'

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
      // ── 1. サーバー経由で R2 にアップロード ──────────────────
      // XHR を使って進捗を表示しつつ /api/upload/file に直接 POST
      // （ブラウザ→R2 の直接アップロードは CORS の問題があるためサーバー経由にする）
      setState('uploading')
      const jobId = await uploadViaServer(file, setProgress, t)

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
    <div className="w-full space-y-3">
      {/* モード選択 */}
      <div className="flex gap-2">
        {(Object.keys(modeConfig) as ParserMode[]).map((mode) => (
          <button
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
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 px-1">{modeConfig[parserMode].description}</p>

      {/* 時間指定 */}
      <div className="px-1 py-1">
        <p className="text-sm font-medium text-gray-700 mb-2">{t('timeLabel')}</p>
        <div className="relative" ref={timePickerRef}>
          {/* トリガーボタン */}
          <button
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
          </button>

          {/* ポップオーバー */}
          {isTimePickerOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
              {/* 終日オプション */}
              <button
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
              </button>

              <div className="border-t border-gray-100" />

              {/* 時刻グリッド */}
              <div className="overflow-y-auto max-h-64 p-3 space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-1 mb-1.5">AM</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {AM_OPTIONS.map((time) => (
                      <button
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
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-1 mb-1.5">PM</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PM_OPTIONS.map((time) => (
                      <button
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
                      </button>
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
  )
}

// XHR で /api/upload/file に PDF を送信し、jobId を返す
// XHR を使うことでアップロード進捗を取得できる
function uploadViaServer(
  file: File,
  onProgress: (n: number) => void,
  t: (key: string, values?: TranslationValues) => string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/upload/file')
    xhr.setRequestHeader('Content-Type', 'application/pdf')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { jobId: string }
          resolve(data.jobId)
        } catch {
          reject(new Error(t('errorUnexpected')))
        }
      } else if (xhr.status === 401) {
        reject(new Error(t('errorPresign')))
      } else if (xhr.status === 429) {
        reject(new Error(t('errorLimitExceeded')))
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
