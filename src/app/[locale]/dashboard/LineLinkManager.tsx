'use client'

import { useEffect, useState } from 'react'

export function LineLinkManager() {
  const [linked, setLinked] = useState<boolean | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchStatus = async () => {
    const res = await fetch('/api/line-link')
    if (res.ok) {
      const data = await res.json() as { linked: boolean }
      setLinked(data.linked)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleGenerateCode = async () => {
    setGenerating(true)
    const res = await fetch('/api/line-link', { method: 'POST' })
    if (res.ok) {
      const data = await res.json() as { code: string; expiresAt: string }
      setCode(data.code)
      setExpiresAt(data.expiresAt)
    }
    setGenerating(false)
  }

  const handleUnlink = async () => {
    if (!confirm('LINEとの連携を解除しますか？')) return
    setUnlinking(true)
    await fetch('/api/line-link', { method: 'DELETE' })
    setLinked(false)
    setCode(null)
    setExpiresAt(null)
    setUnlinking(false)
  }

  const handleCopy = () => {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatExpiry = (iso: string) => {
    return new Date(iso).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    })
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white shadow-sm p-6">
        <p className="text-sm text-gray-400">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm p-6 space-y-4">
      <div className="flex items-start gap-3">
        {/* LINE ロゴ代替 */}
        <div className="w-10 h-10 rounded-xl bg-[#06C755] flex items-center justify-center shrink-0">
          <svg viewBox="0 0 40 40" className="w-6 h-6 fill-white">
            <path d="M20 4C11.163 4 4 10.268 4 18c0 5.285 3.284 9.88 8.235 12.485-.364 1.352-1.318 4.89-1.507 5.643-.235.937.343 1.003.72.73.296-.21 3.964-2.694 5.576-3.796.94.133 1.91.202 2.976.202 8.837 0 16-6.268 16-14s-7.163-14-16-14z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">LINE 連携</h2>
          <p className="text-xs text-gray-500 mt-1">
            LINE でゴミ名や写真を送るだけで分別結果が届きます
          </p>
        </div>
      </div>

      {linked ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
            <span className="text-green-600 text-lg">✅</span>
            <p className="text-sm font-semibold text-green-700">LINE と連携済みです</p>
          </div>
          <p className="text-xs text-gray-500">
            LINE Bot にゴミの名前（例: 「ペットボトル」）や写真を送信すると、分別結果と直近の収集日をお知らせします。
          </p>
          <button
            onClick={handleUnlink}
            disabled={unlinking}
            className="text-xs text-red-400 hover:text-red-600 transition disabled:opacity-40"
          >
            {unlinking ? '解除中...' : 'LINE 連携を解除する'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800">連携手順</p>
            <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
              <li>下の「コードを発行する」ボタンを押す</li>
              <li>表示された6桁のコードをコピーする</li>
              <li>
                <a
                  href="https://line.me/R/ti/p/@gomicale"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 underline"
                >
                  ゴミカレ LINE Bot
                </a>
                を友だち追加する
              </li>
              <li>LINE Bot にコードを送信する（有効時間: 10分）</li>
            </ol>
          </div>

          {code ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                有効期限: {expiresAt ? formatExpiry(expiresAt) : '—'}（約10分）
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl border-2 border-teal-300 bg-teal-50 px-4 py-3 text-center">
                  <span className="text-3xl font-bold tracking-[0.3em] text-teal-700">{code}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="shrink-0 rounded-xl bg-teal-500 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-600 transition"
                >
                  {copied ? 'コピー済' : 'コピー'}
                </button>
              </div>
              <button
                onClick={handleGenerateCode}
                disabled={generating}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                コードを再発行する
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateCode}
              disabled={generating}
              className="w-full rounded-xl bg-[#06C755] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition"
            >
              {generating ? 'コードを発行中...' : 'コードを発行する'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
