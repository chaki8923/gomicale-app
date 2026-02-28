'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { GoogleLoginButton } from '@/components/GoogleLoginButton'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const t = useTranslations('login')
  const tCommon = useTranslations('common')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-green-50 to-teal-100 p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-2 text-sm text-gray-500">{t('subtitle')}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {t('authError')}
          </div>
        )}

        <GoogleLoginButton
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:shadow-md"
          label={tCommon('login')}
        />

        <p className="mt-6 text-center text-xs text-gray-400">
          {t('disclaimer')}
        </p>
      </div>

      <footer className="mt-12 text-center text-xs text-teal-700/60">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          <Link href="/blog" className="hover:text-teal-700 hover:underline">
            {tCommon('blog')}
          </Link>
          <Link href="/terms" className="hover:text-teal-700 hover:underline">
            {tCommon('terms')}
          </Link>
          <Link href="/privacy" className="hover:text-teal-700 hover:underline">
            {tCommon('privacy')}
          </Link>
          <Link href="/legal" className="hover:text-teal-700 hover:underline">
            {tCommon('legal')}
          </Link>
        </div>
        <p className="mt-4">{tCommon('copyright', { year: new Date().getFullYear() })}</p>
      </footer>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
