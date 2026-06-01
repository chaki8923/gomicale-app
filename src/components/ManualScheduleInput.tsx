'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'

interface ManualScheduleInputProps {
  onStart: (jobId: string) => void
}

type SubmitState = 'idle' | 'submitting' | 'error'

const MAX_INSTRUCTION_LENGTH = 2000

export function ManualScheduleInput({ onStart }: ManualScheduleInputProps) {
  const t = useTranslations('manualSchedule')
  const locale = useLocale()
  const [instruction, setInstruction] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [error, setError] = useState<string | null>(null)

  const trimmedInstruction = instruction.trim()
  const isSubmitting = state === 'submitting'
  const remaining = MAX_INSTRUCTION_LENGTH - instruction.length

  const handleSubmit = async () => {
    if (!trimmedInstruction || isSubmitting) return
    if (instruction.length > MAX_INSTRUCTION_LENGTH) {
      setState('error')
      setError(t('errorTooLong'))
      return
    }

    setState('submitting')
    setError(null)

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const res = await fetch('/api/manual-schedules/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: trimmedInstruction,
          language: locale,
          timezone,
        }),
      })

      if (!res.ok) {
        let message: string | null = null
        try {
          const body = await res.json() as { message?: string }
          message = body.message ?? null
        } catch {
          message = null
        }
        throw new Error(message ?? t('errorSubmit'))
      }

      const body = await res.json() as { jobId: string }
      setInstruction('')
      setState('idle')
      onStart(body.jobId)
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : t('errorUnexpected'))
    }
  }

  return (
    <div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h3 className="text-base font-bold text-gray-900">{t('title')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('description')}</p>
      </div>

      <div className="rounded-xl bg-teal-50 px-4 py-3 text-xs text-teal-700">
        <p className="font-semibold">{t('exampleLabel')}</p>
        <p className="mt-1">{t('example')}</p>
      </div>

      <div className="space-y-2">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={t('placeholder')}
          disabled={isSubmitting}
          maxLength={MAX_INSTRUCTION_LENGTH + 200}
          className="min-h-32 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3">
          <p className={`text-xs ${remaining < 0 ? 'text-red-500' : 'text-gray-400'}`}>
            {t('remaining', { count: remaining })}
          </p>
          <p className="text-xs text-gray-400">{t('rangeNote')}</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!trimmedInstruction || isSubmitting || remaining < 0}
        className="w-full rounded-xl bg-teal-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? t('submitting') : t('submit')}
      </Button>
    </div>
  )
}
