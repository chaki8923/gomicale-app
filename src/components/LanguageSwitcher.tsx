'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { useTransition } from 'react'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const switchLocale = (newLocale: 'ja' | 'en') => {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale })
    })
  }

  return (
    <div className="flex items-center gap-0.5 text-xs font-medium">
      <button
        onClick={() => switchLocale('ja')}
        disabled={isPending}
        className={`px-2 py-1 rounded transition ${
          locale === 'ja'
            ? 'bg-teal-500 text-white'
            : 'text-gray-400 hover:text-teal-600'
        } ${isPending ? 'opacity-60' : ''}`}
      >
        JA
      </button>
      <span className="text-gray-200">|</span>
      <button
        onClick={() => switchLocale('en')}
        disabled={isPending}
        className={`px-2 py-1 rounded transition ${
          locale === 'en'
            ? 'bg-teal-500 text-white'
            : 'text-gray-400 hover:text-teal-600'
        } ${isPending ? 'opacity-60' : ''}`}
      >
        EN
      </button>
    </div>
  )
}
