'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { FaLine } from 'react-icons/fa'
import { Button } from '@/components/ui/Button'

interface LineLinkManagerProps {
  hasCompletedJob: boolean
}

export function LineLinkManager({ hasCompletedJob }: LineLinkManagerProps) {
  const t = useTranslations('dashboard.lineLink')
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
    if (!confirm(t('unlinkConfirm'))) return
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
        <p className="text-sm text-gray-400">{t('loading')}</p>
      </div>
    )
  }

    if (!hasCompletedJob) {
      return (
        <div className="rounded-2xl bg-white shadow-sm p-6 space-y-4 opacity-60">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
              <FaLine className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-400">{t('title')}</h2>
              <p className="text-xs text-gray-400 mt-1">{t('subtitle')}</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 flex items-center gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-500">{t('lockedTitle')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('lockedDescription')}</p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-2xl bg-white shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#06C755] flex items-center justify-center shrink-0">
            <FaLine className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{t('title')}</h2>
          <p className="text-xs text-gray-500 mt-1">{t('subtitle')}</p>
        </div>
      </div>

      {linked ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
            <span className="text-green-600 text-lg">✅</span>
            <p className="text-sm font-semibold text-green-700">{t('linkedBadge')}</p>
          </div>
          <p className="text-xs text-gray-500">{t('linkedDescription')}</p>
          <Button
            onClick={handleUnlink}
            disabled={unlinking}
            className="text-xs text-red-400 hover:text-red-600 transition disabled:opacity-40"
          >
            {unlinking ? t('unlinking') : t('unlink')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800">{t('stepsTitle')}</p>
            <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
              <li>{t('step1')}</li>
              <li>{t('step2')}</li>
              <li>
                {t('step3Before')}
                <a
                  href="https://lin.ee/4F3CioD"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 underline"
                >
                  {t('step3BotName')}
                </a>
                {t('step3After')}
              </li>
              <li>{t('step4')}</li>
            </ol>
          </div>

          {code ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                {t('expiry', { time: expiresAt ? formatExpiry(expiresAt) : '—' })}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl border-2 border-teal-300 bg-teal-50 px-4 py-3 text-center">
                  <span className="text-3xl font-bold tracking-[0.3em] text-teal-700">{code}</span>
                </div>
                <Button
                  onClick={handleCopy}
                  className="shrink-0 rounded-xl bg-teal-500 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-600 transition"
                >
                  {copied ? t('copied') : t('copy')}
                </Button>
              </div>
              <Button
                onClick={handleGenerateCode}
                disabled={generating}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                {t('reissue')}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGenerateCode}
              disabled={generating}
              className="w-full rounded-xl bg-[#06C755] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
            >
              {generating ? t('issuing') : t('issue')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
