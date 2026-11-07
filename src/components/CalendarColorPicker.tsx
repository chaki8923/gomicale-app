'use client'
import { useState, useRef, useEffect, useId } from 'react'
import { useTranslations } from 'next-intl'
import type { EventColors } from '../../shared/calendar-import'

export function CalendarColorPicker({ value, colors, onChange, disabled, label, mixed = false }: {
  value: string | null; colors: EventColors; onChange(value: string | null): void; disabled?: boolean; label: string; mixed?: boolean
}) {
  const t = useTranslations('calendarReview')
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), id = useId()
  const colorName = (colorId: string) => t.has(`colorNames.${colorId}`) ? t(`colorNames.${colorId}`) : t('colorNumber', { id: colorId })
  const name = mixed ? t('mixed') : value ? colorName(value) : t('defaultColor')
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const choose = (next: string | null) => { onChange(next); setOpen(false); trigger.current?.focus() }
  const swatch = (color?: string) => <span aria-hidden="true" className="inline-block size-5 shrink-0 rounded-full border border-slate-300 shadow-sm" style={{ background: color ?? 'repeating-linear-gradient(45deg,#fff,#fff 3px,#ddd 3px,#ddd 4px)' }} />
  return <div ref={root} className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button ref={trigger} type="button" disabled={disabled} aria-label={`${label}: ${name}`} aria-expanded={open} aria-controls={id} aria-haspopup="listbox"
      onClick={() => setOpen(v => !v)} onKeyDown={event => { if (event.key === 'ArrowDown' && !disabled) { event.preventDefault(); setOpen(true); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('[role=option]')?.focus()) } }}
      className="mt-1 flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white p-2.5 text-left text-sm text-slate-900 hover:border-teal-500 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:bg-slate-50 disabled:opacity-60">
      {swatch(!mixed && value ? colors[value]?.background : undefined)}<span className="flex-1">{name}</span><span aria-hidden="true" className="text-xs text-slate-500">▾</span>
    </button>
    {open && !disabled && <div id={id} role="listbox" aria-label={label} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
      onKeyDown={event => { const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=option]')]; const index = options.indexOf(document.activeElement as HTMLButtonElement)
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
        if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length-1 : (index+(event.key === 'ArrowDown' ? 1 : -1)+options.length)%options.length; options[next]?.focus() }
      }}>
      {[null,...Object.keys(colors)].map(colorId => <button type="button" role="option" aria-selected={!mixed && value === colorId} key={colorId ?? 'default'} onClick={() => choose(colorId)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-teal-50 focus-visible:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-600">
        {swatch(colorId ? colors[colorId].background : undefined)}<span className="flex-1">{colorId ? colorName(colorId) : t('defaultColor')}</span>{!mixed && value === colorId && <span aria-hidden="true" className="font-bold text-teal-700">✓</span>}
      </button>)}
    </div>}
  </div>
}
