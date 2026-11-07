'use client'
import { useId } from 'react'
import { useTranslations } from 'next-intl'
import type { RegistrationMode } from '../../shared/calendar-import'
export function RegistrationModeSelector({ value, onChange, disabled }: { value: RegistrationMode; onChange(value: RegistrationMode): void; disabled?: boolean }) {
  const t = useTranslations('registrationMode'), name = useId()
  return <fieldset disabled={disabled} className="space-y-2"><legend className="mb-2 text-sm font-bold text-slate-800">{t('title')}</legend>
    <div className="grid gap-2 sm:grid-cols-2">{(['auto','review'] as const).map(mode => <label key={mode} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${value === mode ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-300'} ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <input type="radio" name={name} value={mode} checked={value === mode} onChange={() => onChange(mode)} className="mt-1 size-4 shrink-0 accent-teal-700" />
      <span><span className="block text-sm font-bold text-slate-900">{t(`${mode}.title`)}</span><span className="mt-1 block text-xs leading-6 text-slate-600">{t(`${mode}.description`)}</span></span>
    </label>)}</div><p className="text-xs leading-6 text-teal-800">{t(`${value}.notice`)}</p>
  </fieldset>
}
