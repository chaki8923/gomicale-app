'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { startGoogleOAuth } from '@/components/GoogleLoginButton'
import { Button } from '@/components/ui/Button'
import { STANDARD_EVENT_COLORS, type CalendarImport, type ImportDraft, type EventColors } from '../../../../../../shared/calendar-import'
import type { OwnedCalendar } from '../../../../../../shared/google-calendars'

type CalendarData = { calendars: OwnedCalendar[]; colors: EventColors; selectedCalendarId: string | null }
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'REQUEST_FAILED')
  return data
}
function Swatch({ color, label }: { color?: string | null; label: string }) {
  return <span className="inline-flex items-center gap-1.5 text-xs text-slate-600"><span aria-hidden="true" className="inline-block size-4 shrink-0 rounded-full border border-slate-300" style={{ background: color ?? 'repeating-linear-gradient(45deg,#fff,#fff 3px,#ddd 3px,#ddd 4px)' }} />{label}</span>
}
export function ReviewClient({ jobId }: { jobId: string }) {
  const t = useTranslations('calendarReview'), locale = useLocale()
  const [review, setReview] = useState<CalendarImport | null>(null)
  const [draft, setDraft] = useState<ImportDraft | null>(null)
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [error, setError] = useState(''), [calendarError, setCalendarError] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved'|'dirty'|'saving'|'failed'>('saved')
  const [page, setPage] = useState(0), [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false)
  const draftRef = useRef<ImportDraft | null>(null), revision = useRef(0), edit = useRef(0), saved = useRef(0)
  const inFlight = useRef<Promise<void> | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const base = `/api/jobs/${jobId}`
  const save = useCallback(async () => {
    if (inFlight.current) await inFlight.current
    if (edit.current === saved.current || !draftRef.current) return
    const operation = (async () => {
      setSaveStatus('saving')
      try {
        // Serialize saves; edits made during a request are sent with its new revision.
        while (saved.current < edit.current) {
          const version = edit.current
          const result = await api<{revision:number}>(`${base}/review`, { method: 'PATCH', headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({ revision: revision.current, draft: draftRef.current }) })
          revision.current = result.revision; saved.current = version
        }
        setSaveStatus('saved'); setError('')
      } catch (e) { setSaveStatus('failed'); setError((e as Error).message); throw e }
    })()
    inFlight.current = operation
    try { await operation } finally { if (inFlight.current === operation) inFlight.current = null }
  }, [base])
  const change = useCallback((updater: (value: ImportDraft) => ImportDraft) => {
    if (!draftRef.current) return
    const next = updater(draftRef.current)
    draftRef.current = next; edit.current++; setDraft(next); setSaveStatus('dirty'); setConfirming(false)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void save().catch(() => {}) }, 500)
  }, [save])
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const value = await api<CalendarImport>(`${base}/review`)
        let calendars: CalendarData | null = null
        try { calendars = await api<CalendarData>('/api/google-calendars') }
        catch (e) { if (active) setCalendarError((e as Error).message) }
        if (!active) return
        setReview(value); revision.current = value.revision
        const initial = value.confirmed ?? value.draft
        draftRef.current = initial; setDraft(initial)
        if (calendars) {
          setCalendarData(calendars)
          if (value.state === 'ready' && !initial.calendarId) {
            const choice = calendars.calendars.find(c => c.id === calendars!.selectedCalendarId) ?? calendars.calendars.find(c => c.primary) ?? calendars.calendars[0]
            if (choice) change(d => ({ ...d, calendarId: choice.id }))
          }
        }
      } catch (e) { if (active) setError((e as Error).message) }
    }
    void load()
    return () => { active = false; if (timer.current) clearTimeout(timer.current) }
  }, [base, change])
  useEffect(() => {
    if (review?.state !== 'registering' && review?.state !== 'analyzing') return
    const interval = setInterval(() => {
      void api<CalendarImport>(`${base}/review`).then(value => {
        setReview(value)
        if (value.state === 'ready') {
          draftRef.current = value.draft; setDraft(value.draft); revision.current = value.revision
          if (!value.draft.calendarId && calendarData) {
            const choice = calendarData.calendars.find(c => c.id === calendarData.selectedCalendarId) ?? calendarData.calendars.find(c => c.primary) ?? calendarData.calendars[0]
            if (choice) change(d => ({ ...d, calendarId: choice.id }))
          }
        }
      }).catch(() => setError('REQUEST_FAILED'))
    }, 3000)
    return () => clearInterval(interval)
  }, [base, review?.state, calendarData, change])
  useEffect(() => {
    const preventLoss = (e: BeforeUnloadEvent) => { if (edit.current !== saved.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', preventLoss)
    return () => window.removeEventListener('beforeunload', preventLoss)
  }, [])
  useEffect(() => { if (confirming) dialog.current?.showModal(); else dialog.current?.close() }, [confirming])
  const colors = calendarData?.colors ?? STANDARD_EVENT_COLORS
  const rows = useMemo(() => [...(draft?.events ?? [])].sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)), [draft])
  const categories = useMemo(() => [...new Set(draft?.events.map(e => e.category) ?? [])], [draft])
  const count = draft?.events.filter(e => e.included).length ?? 0
  const editable = review?.state === 'ready' && !review.confirmed && !busy && !confirming
  const destination = calendarData?.calendars.find(c => c.id === draft?.calendarId)
  const reauth = (code: string) => /GOOGLE_(REAUTH_REQUIRED|CALENDAR_SCOPE_MISSING|CALENDAR_PERMISSION_DENIED)/.test(code)
  const message = (code: string) => t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.REQUEST_FAILED')
  const prepare = async () => {
    setBusy(true)
    try { await save(); setConfirming(true) } catch {} finally { setBusy(false) }
  }
  const submit = async () => {
    setBusy(true); setError('')
    try {
      await save()
      const result = await api<{state:CalendarImport['state']}>(`${base}/import`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ revision: revision.current }) })
      setReview(r => r ? { ...r, state: result.state, confirmed: draftRef.current } : r); setConfirming(false)
    } catch (e) { setError((e as Error).message); setConfirming(false) } finally { setBusy(false) }
  }
  const retry = async () => { await submit() }
  const colorOptions = <><option value="">{t('defaultColor')}</option>{Object.keys(colors).map(id => <option key={id} value={id}>{t('colorNumber', { id })} · {colors[id].background}</option>)}</>
  return <main className="min-h-screen bg-gradient-to-b from-teal-50 to-white text-slate-900">
    <header className="border-b border-teal-100 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4"><Link href={`/${locale}/dashboard`} onClick={e => { if (edit.current !== saved.current) { e.preventDefault(); void save().then(() => window.location.assign(`/${locale}/dashboard`)).catch(() => {}) } }} className="text-sm font-semibold text-teal-700">← {t('dashboard')}</Link><div className="flex gap-2">{(['ja','en'] as const).map(lang => <Button key={lang} disabled={lang === locale || busy} onClick={() => { void save().then(() => window.location.assign(`/${lang}/jobs/${jobId}/review`)).catch(() => {}) }} className="rounded-lg border px-2 py-1 text-xs disabled:bg-teal-100">{lang.toUpperCase()}</Button>)}</div></div></header>
    <div className="mx-auto max-w-6xl px-4 py-8 pb-36 sm:px-6">
      <p className="mb-2 text-xs font-bold tracking-widest text-teal-700">{t('step')}</p><h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{t('intro')}</p>
      {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{message(error)} {error === 'EDIT_CONFLICT' && <Button className="underline" onClick={() => window.location.reload()}>{t('reload')}</Button>}
        {reauth(error) && <Button className="ml-3 underline" onClick={() => void startGoogleOAuth({ postAuthPath: `/${locale}/jobs/${jobId}/review` })}>{t('reconnect')}</Button>}</div>}
      {!review || !draft ? <p className="mt-8" role="status">{error ? '' : t('loading')}</p> : <>
        {review.state !== 'ready' && <section role="status" className="mt-6 rounded-2xl border border-teal-200 bg-white p-6"><h2 className="font-bold">{t(`state.${review.state}`)}</h2><p className="mt-2 text-sm text-slate-600">{review.confirmed ? t('frozen') : t('waiting')}</p>
          {review.error && <div className="mt-3 text-sm text-red-700"><p className="break-words">{t.has(`errors.${review.error}`) ? message(review.error) : review.error}</p>{reauth(review.error) && <Button className="mt-2 underline" onClick={() => void startGoogleOAuth({ postAuthPath: `/${locale}/jobs/${jobId}/review` })}>{t('reconnect')}</Button>}</div>}
          {review.confirmed && <p className="mt-2 text-sm text-teal-800">{t('progress', { count: review.registered_count, total: count })}</p>}
          {review.confirmed && (review.state === 'error' || (review.state === 'registering' && (review.lease_until ? Date.parse(review.lease_until) < Date.now() : Date.parse(review.updated_at) < Date.now()-60000))) && <Button disabled={busy} onClick={() => void retry()} className="mt-4 rounded-lg bg-teal-700 px-4 py-3 text-white disabled:opacity-50">{t('retryImport')}</Button>}
        </section>}
        {calendarError && review.state !== 'completed' && <section role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm"><p>{message(calendarError)}</p><Button onClick={async () => { try { await save(); if (reauth(calendarError)) await startGoogleOAuth({ postAuthPath: `/${locale}/jobs/${jobId}/review` }); else window.location.reload() } catch {} }} className="mt-3 rounded-lg bg-white px-4 py-2 font-bold text-teal-800 shadow-sm">{reauth(calendarError) ? t('reconnect') : t('reload')}</Button></section>}
        <section className="mt-6 grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-6">
          <label className="block text-sm font-semibold">{t('calendar')}<select aria-label={t('calendar')} value={draft.calendarId} disabled={!editable || !calendarData} onChange={e => change(d => ({ ...d, calendarId: e.target.value }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 disabled:bg-slate-50"><option value="">{t('selectCalendar')}</option>{draft.calendarId && !destination && <option value={draft.calendarId}>{t('unavailableCalendar')}</option>}{calendarData?.calendars.map(c => <option key={c.id} value={c.id}>{c.summary}{c.primary ? ` (${t('primary')})` : ''}</option>)}</select><span className="mt-2 block text-xs font-normal text-slate-500">{t('ownerOnly')}</span></label>
          <div><label className="block text-sm font-semibold">{t('time')}<select aria-label={t('time')} value={draft.eventTime ? 'timed' : 'allDay'} disabled={!editable} onChange={e => change(d => ({ ...d, eventTime: e.target.value === 'timed' ? '09:00' : null }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"><option value="allDay">{t('allDay')}</option><option value="timed">{t('timed')}</option></select></label>{draft.eventTime && <div className="mt-2 flex flex-wrap gap-2"><input aria-label={t('startTime')} type="time" value={draft.eventTime} disabled={!editable} onChange={e => change(d => ({ ...d, eventTime: e.target.value }))} className="rounded-lg border border-slate-300 p-2" /><input aria-label={t('timezone')} value={draft.timezone} disabled={!editable} onChange={e => change(d => ({ ...d, timezone: e.target.value }))} className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2 text-sm" /></div>}</div>
        </section>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="font-bold">{t('categoryColors')}</h2><p className="mt-2 text-xs leading-6 text-slate-500">{t('colorExplanation')}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{categories.map(category => { const items = draft.events.filter(e => e.category === category); const current = new Set(items.map(e => e.colorId)); const sourceColor = items[0].sourceColor; return <div key={category} className="rounded-xl bg-slate-50 p-3"><p className="mb-2 text-sm font-semibold">{category}</p><Swatch color={sourceColor} label={sourceColor ?? t('notDetected')} /><label className="mt-2 block text-xs text-slate-600">{t('applyToCategory')}<select aria-label={`${t('applyToCategory')} ${category}`} value={current.size === 1 ? items[0].colorId ?? '' : 'mixed'} disabled={!editable} onChange={e => change(d => ({ ...d, events: d.events.map(ev => ev.category === category ? { ...ev, colorId: e.target.value || null } : ev) }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm">{current.size > 1 && <option value="mixed" disabled>{t('mixed')}</option>}{colorOptions}</select></label></div> })}</div></section>
        <section className="mt-8"><div className="mb-4 flex items-baseline justify-between gap-3"><h2 className="text-lg font-bold">{t('events')}</h2><p className="text-sm text-slate-600">{t('count', { count, total: draft.events.length })}</p></div><div className="space-y-3">{rows.slice(page*50,(page+1)*50).map(ev => <article key={ev.id} className={`rounded-xl border bg-white p-4 ${ev.included ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-60'}`}><div className="grid items-start gap-4 sm:grid-cols-[auto_150px_1fr_220px]">
          <label className="flex items-center gap-2 text-sm sm:pt-3"><input type="checkbox" checked={ev.included} disabled={!editable} aria-label={`${t('include')} ${ev.title} ${ev.date}`} onChange={e => change(d => ({ ...d, events: d.events.map(v => v.id === ev.id ? { ...v, included: e.target.checked } : v) }))} className="size-5 accent-teal-700" /><span className="sm:sr-only">{t('include')}</span></label>
          <label className="text-xs text-slate-500">{t('date')}<input type="date" aria-label={`${t('date')} ${ev.id}`} value={ev.date} disabled={!editable} onChange={e => change(d => ({ ...d, events: d.events.map(v => v.id === ev.id ? { ...v, date: e.target.value } : v) }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900" /></label>
          <label className="min-w-0 text-xs text-slate-500">{t('eventTitle')}<input aria-label={`${t('eventTitle')} ${ev.id}`} value={ev.title} maxLength={300} disabled={!editable} onChange={e => change(d => ({ ...d, events: d.events.map(v => v.id === ev.id ? { ...v, title: e.target.value } : v) }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900" /></label>
          <div><label className="text-xs text-slate-500">{t('eventColor')}<select aria-label={`${t('eventColor')} ${ev.id}`} value={ev.colorId ?? ''} disabled={!editable} onChange={e => change(d => ({ ...d, events: d.events.map(v => v.id === ev.id ? { ...v, colorId: e.target.value || null } : v) }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900">{colorOptions}</select></label><div className="mt-2 flex flex-wrap items-center gap-2"><Swatch color={ev.sourceColor} label={t('source')} /><span aria-hidden="true" className="text-slate-400">→</span><Swatch color={ev.colorId ? colors[ev.colorId]?.background : null} label={t('google')} /></div></div>
        </div></article>)}</div><nav aria-label={t('pages')} className="mt-5 flex items-center justify-center gap-5"><Button disabled={page === 0} onClick={() => setPage(p => p-1)} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-40">{t('previous')}</Button><span className="text-sm">{page+1} / {Math.max(1,Math.ceil(rows.length/50))}</span><Button disabled={(page+1)*50 >= rows.length} onClick={() => setPage(p => p+1)} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-40">{t('next')}</Button></nav></section>
        {review.state === 'ready' && <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><p role="status" className={`text-xs ${saveStatus === 'failed' ? 'text-red-700' : 'text-slate-500'}`}>{t(`save.${saveStatus}`)}{saveStatus === 'failed' && error !== 'EDIT_CONFLICT' && <Button onClick={() => void save().catch(() => {})} className="ml-2 underline">{t('retrySave')}</Button>}</p><Button disabled={busy || !count || !destination || !!calendarError || error === 'EDIT_CONFLICT'} onClick={() => void prepare()} className="rounded-xl bg-teal-700 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-40">{t('reviewButton', { count })}</Button></div></footer>}
        <dialog ref={dialog} onCancel={() => setConfirming(false)} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/40"><h2 className="text-xl font-bold">{t('confirmTitle')}</h2><dl className="my-5 space-y-4 text-sm"><div><dt className="text-slate-500">{t('calendar')}</dt><dd className="mt-1 break-words font-semibold">{destination?.summary}</dd></div><div><dt className="text-slate-500">{t('events')}</dt><dd className="mt-1 font-semibold">{t('selectedCount', { count })}</dd></div><div><dt className="text-slate-500">{t('time')}</dt><dd className="mt-1 font-semibold">{draft.eventTime ? `${draft.eventTime} – ${t('oneHour')} (${draft.timezone})` : t('allDay')}</dd></div></dl><p className="text-xs leading-6 text-slate-600">{t('confirmNote')}</p><div className="mt-6 flex flex-wrap justify-end gap-3"><Button disabled={busy} onClick={() => setConfirming(false)} className="rounded-lg border px-4 py-3 text-sm">{t('back')}</Button><Button disabled={busy} onClick={() => void submit()} className="rounded-lg bg-teal-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? t('submitting') : t('confirmButton')}</Button></div></dialog>
      </>}
    </div>
  </main>
}
