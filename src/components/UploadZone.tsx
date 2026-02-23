'use client'

import { useCallback, useState } from 'react'

type ParserMode = 'garbage' | 'general'

interface UploadZoneProps {
  onUploadComplete: (jobId: string) => void
}

type UploadState = 'idle' | 'presigning' | 'uploading' | 'starting' | 'done' | 'error'

const MODE_CONFIG: Record<ParserMode, { label: string; description: string }> = {
  garbage: {
    label: 'ゴミ出しカレンダー',
    description: '自治体のゴミ収集カレンダーPDFを解析し、収集日をGoogleカレンダーに登録します。',
  },
  general: {
    label: '汎用予定PDF',
    description: 'スケジュール表・行事予定表など、日付と予定が記載されたPDFを解析して登録します。',
  },
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [parserMode, setParserMode] = useState<ParserMode>('garbage')

  const processFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('PDFファイルのみアップロードできます')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('ファイルサイズは20MB以下にしてください')
      return
    }

    setError(null)
    setProgress(0)

    try {
      // ── 1. Presigned URL を取得 ──────────────────────────────
      setState('presigning')
      const presignRes = await fetch('/api/upload/presign', { method: 'POST' })
      if (!presignRes.ok) throw new Error('Presigned URL の取得に失敗しました')
      const { uploadUrl, jobId } = await presignRes.json() as {
        uploadUrl: string
        jobId: string
      }

      // ── 2. R2 へ直接アップロード ─────────────────────────────
      setState('uploading')
      await uploadWithProgress(uploadUrl, file, setProgress)

      // ── 3. Lambda を非同期で起動 ─────────────────────────────
      setState('starting')
      const startRes = await fetch('/api/jobs/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jobId, parserMode }),
      })
      if (!startRes.ok) throw new Error('ジョブの開始に失敗しました')

      setState('done')
      onUploadComplete(jobId)
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました')
    }
  }, [onUploadComplete, parserMode])

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

  const isLoading = ['presigning', 'uploading', 'starting'].includes(state)

  return (
    <div className="w-full space-y-3">
      {/* モード選択 */}
      <div className="flex gap-2">
        {(Object.keys(MODE_CONFIG) as ParserMode[]).map((mode) => (
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
            {MODE_CONFIG[mode].label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 px-1">{MODE_CONFIG[parserMode].description}</p>

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
              {state === 'presigning' && 'アップロード準備中...'}
              {state === 'uploading' && `アップロード中... ${progress}%`}
              {state === 'starting' && '解析を開始中...'}
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
            <p className="text-sm font-medium text-gray-700">
              PDFをドラッグ&ドロップ、またはクリックして選択
            </p>
            <p className="text-xs text-gray-400">PDF形式・最大20MB</p>
          </div>
        )}
      </label>

      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (n: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', 'application/pdf')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload  = () => (xhr.status < 300 ? resolve() : reject(new Error(`アップロード失敗 (HTTP ${xhr.status})`)))
    xhr.onerror = () => {
      console.error('[UploadZone] xhr.onerror fired', {
        status: xhr.status,
        readyState: xhr.readyState,
        url: url.split('?')[0],
      })
      reject(new Error('ネットワークエラーが発生しました'))
    }
    xhr.send(file)
  })
}
