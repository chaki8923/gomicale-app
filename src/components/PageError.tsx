'use client'

import { jobErrorMessage } from '../../shared/job-errors'

export function PageError({ locale }: { locale: string }) {
  return (
    <main className="mx-auto max-w-lg p-8 text-center">
      <p role="alert" className="text-slate-800">{jobErrorMessage(null, locale)}</p>
      <button type="button" className="mt-4 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white" onClick={() => window.location.reload()}>
        {locale === 'en' ? 'Reload page' : 'ページを再読み込み'}
      </button>
    </main>
  )
}
