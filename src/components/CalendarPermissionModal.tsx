'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { startGoogleOAuth } from '@/components/GoogleLoginButton'

interface CalendarPermissionModalProps {
  isOpen: boolean
  onClose: () => void
  locale: string
}

export function CalendarPermissionModal({ isOpen, onClose, locale }: CalendarPermissionModalProps) {
  const t = useTranslations('jobStatus')
  const router = useRouter()
  const [isReauthing, setIsReauthing] = useState(false)

  if (!isOpen) return null

  const handleReauthorize = async () => {
    if (isReauthing) return
    setIsReauthing(true)
    await startGoogleOAuth({
      forceConsent: true,
      postAuthPath: `/${locale}/dashboard`,
    })
    setIsReauthing(false)
  }

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push(`/${locale}`)
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-red-50 px-6 pt-6 pb-4 border-b border-red-100">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-snug">
                {t('calendarPermissionModalTitle')}
              </h2>
            </div>
          </div>
        </div>

        {/* 本文 */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <ol className="space-y-2 text-sm text-gray-700">
            <li>{t('calendarPermissionStep1')}</li>
            <li>{t('calendarPermissionStep2')}</li>
            <li>{t('calendarPermissionStep3')}</li>
          </ol>

          {/* 説明画像 */}
          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <Image
              src="/error_info.png"
              alt={t('calendarPermissionImageAlt')}
              width={800}
              height={600}
              className="w-full h-auto"
              priority
            />
          </div>
        </div>

        {/* フッターボタン */}
        <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row gap-3 justify-end border-t border-gray-100 pt-4">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
          >
            {t('calendarPermissionClose')}
          </button>
          <button
            onClick={handleReauthorize}
            disabled={isReauthing}
            className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-70 disabled:cursor-not-allowed rounded-xl transition whitespace-nowrap"
          >
            {isReauthing ? t('calendarPermissionReauthing') : t('calendarPermissionReauthorize')}
          </button>
          <button
            onClick={handleLogout}
            className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition whitespace-nowrap"
          >
            {t('calendarPermissionLogout')}
          </button>
        </div>
      </div>
    </div>
  )
}
