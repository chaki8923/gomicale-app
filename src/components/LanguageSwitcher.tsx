'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { useTransition } from 'react'
import Image from 'next/image'

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
    <>
      {isPending && (
        <div className="fixed inset-0 z-[200] flex cursor-wait flex-col items-center justify-center bg-white/75 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5">
            <div className="relative animate-bounce">
              <div className="absolute -inset-3 rounded-full border-4 border-teal-400 border-t-transparent animate-spin" />
              <div className="absolute -inset-3 rounded-full border-4 border-teal-100 border-b-transparent" />
              <Image
                src="/oba_loading.png"
                alt="loading"
                width={112}
                height={112}
                className="rounded-full object-cover shadow-lg"
                priority
              />
            </div>
            <p className="text-sm font-bold text-teal-700 animate-pulse tracking-widest">
              {locale === 'ja' ? 'Switching...' : '切替中...'}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-0.5 text-xs font-medium">
        <button
          onClick={() => switchLocale('ja')}
          disabled={isPending}
          className={`cursor-pointer px-2 py-1 rounded transition ${
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
          className={`cursor-pointer px-2 py-1 rounded transition ${
            locale === 'en'
              ? 'bg-teal-500 text-white'
              : 'text-gray-400 hover:text-teal-600'
          } ${isPending ? 'opacity-60' : ''}`}
        >
          EN
        </button>
      </div>
    </>
  )
}
