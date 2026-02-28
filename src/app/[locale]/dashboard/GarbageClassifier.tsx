'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'

type NextDate = {
  date: string
  title: string
  description?: string
}

type ClassifyResult = {
  category: string
  nextDates: NextDate[]
}

export function GarbageClassifier() {
  const t = useTranslations('classifier')
  const locale = useLocale()

  const [query, setQuery] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ClassifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    setResult(null)
    setError(null)
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => setImagePreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setImagePreview(null)
    }
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query && !imageFile) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('query', query)
      formData.append('locale', locale)
      if (imageFile) formData.append('image', imageFile)

      const res = await fetch('/api/classify', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json() as ClassifyResult & { error?: string }

      if (!res.ok || data.error) {
        if (data.error === 'no_garbage_calendar') {
          setError('no_calendar')
        } else {
          setError('api_error')
        }
        return
      }

      setResult(data)
    } catch {
      setError('api_error')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'ja-JP', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-50 text-2xl">
          🗑️
        </span>
        <div>
          <h2 className="text-base font-bold text-gray-900">{t('title')}</h2>
          <p className="text-xs text-gray-500">{t('subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setResult(null); setError(null) }}
            placeholder={t('placeholder')}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 text-gray-400 hover:border-teal-400 hover:text-teal-500 transition"
            title={t('uploadImage')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>

        {imagePreview && (
          <div className="relative inline-block">
            <Image
              src={imagePreview}
              alt="preview"
              width={80}
              height={80}
              className="rounded-xl object-cover w-20 h-20 border border-gray-200"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-500 text-white text-xs flex items-center justify-center hover:bg-gray-700"
            >
              ×
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (!query && !imageFile)}
          className="w-full rounded-xl bg-teal-500 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? t('classifying') : t('classify')}
        </button>
      </form>

      {error === 'no_calendar' && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
          {t('noCalendarError')}
        </div>
      )}

      {error === 'api_error' && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {t('apiError')}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl bg-teal-50 border border-teal-100 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wide mt-1 whitespace-nowrap">{t('resultCategory')}</span>
            <span className="rounded-xl bg-teal-500 px-3 py-1 text-sm font-bold text-white inline-block">
              {result.category}
            </span>
          </div>
          {result.nextDates.length > 0 && (
            <div>
              <span className="text-xs font-bold text-teal-600 uppercase tracking-wide block mb-1.5">{t('resultNextDates')}</span>
              <div className="flex flex-wrap gap-2">
                {result.nextDates.map((nd, i) => (
                  <div key={i} className="flex flex-col rounded-xl bg-white border border-teal-100 px-3 py-2 shadow-sm min-w-[120px]">
                    <span className="text-xs font-semibold text-teal-700">{nd.title}</span>
                    <span className="text-sm font-bold text-gray-800">{formatDate(nd.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
