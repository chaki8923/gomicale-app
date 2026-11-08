'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type Status = {
  state: 'idle' | 'deleting' | 'retry' | 'completed'
  canDelete: boolean
  activeJobs: { id: string; title: string | null; status: string }[]
  error?: string | null
}
export function AccountDeletionPanel({ email, accountId, initialPending = false }: { email: string; accountId: string; initialPending?: boolean }) {
  const t = useTranslations('accountDeletion')
  const locale = useLocale()
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const submitting = useRef(false)
  const completing = useRef(false)
  const [open, setOpen] = useState(initialPending)
  const [checked, setChecked] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const locked = busy || status?.state === 'deleting'
  const started = status?.state === 'retry' || status?.state === 'deleting'

  const complete = useCallback(async () => {
    if (completing.current) return
    completing.current = true
    try { await getSupabaseBrowserClient().auth.signOut({ scope:'local' }) } catch { /* Auth has already been deleted. */ }
    window.location.replace(`/${locale}?accountDeleted=1`)
  }, [locale])

  useEffect(() => {
    if (!open) return
    const node = dialog.current
    node?.showModal()
    cancel.current?.focus()
    return () => node?.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    let disposed = false
    let fetching = false
    const controller = new AbortController()
    const refresh = async () => {
      if (fetching || submitting.current) return
      fetching = true
      try {
        const response = await fetch('/api/account/deletion',{cache:'no-store',signal:controller.signal})
        const data = await response.json()
        if (!response.ok) throw new Error(data.error === 'UNAUTHORIZED' ? 'sessionExpired' : 'loadFailed')
        if (disposed || submitting.current) return
        setStatus(data)
        setError(previous => ['loadFailed','sessionExpired'].includes(previous) || previous==='activeJobs' && data.canDelete ? '' : previous)
        if (data.state==='completed') await complete()
      } catch (e) {
        if (!disposed) setError(e instanceof Error && e.message==='sessionExpired' ? 'sessionExpired' : 'loadFailed')
      } finally { fetching = false }
    }
    void refresh()
    const timer = setInterval(()=>void refresh(),3000)
    return () => { disposed = true; controller.abort(); clearInterval(timer) }
  }, [open,complete])

  const close = () => {
    if (locked) return
    dialog.current?.close()
    opener.current?.focus()
    setOpen(false)
    setChecked(false)
    setStatus(null)
    setError('')
  }
  const remove = async () => {
    if (submitting.current || !status || (status.state==='idle' && (!checked || !status.canDelete))) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/account',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:true,expectedAccountId:accountId})})
      const data = await response.json()
      if (!response.ok) {
        if (data.error==='ACTIVE_JOBS') {
          setStatus(null)
          throw new Error('activeJobs')
        }
        throw new Error(data.error==='UNAUTHORIZED' ? 'sessionExpired' : data.error==='ACCOUNT_CHANGED' ? 'accountChanged' : 'deleteFailed')
      }
      setStatus({state:'deleting',canDelete:false,activeJobs:[]})
    } catch (e) {
      setError(e instanceof Error && ['activeJobs','sessionExpired','accountChanged'].includes(e.message) ? e.message : 'deleteFailed')
    } finally { submitting.current = false; setBusy(false) }
  }

  return <>
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="font-semibold text-slate-900">{t('sectionTitle')}</h2><p className="mt-1 text-sm text-slate-500">{initialPending ? t('pendingDescription') : t('sectionDescription')}</p></div>
        <button ref={opener} type="button" onClick={()=>setOpen(true)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600">{initialPending ? t('resume') : t('open')}</button>
      </div>
    </section>
    {open && <dialog ref={dialog} aria-labelledby="account-deletion-title" aria-describedby="account-deletion-description"
      onCancel={event=>{event.preventDefault();close()}}
      onClick={event=>{if(event.target===event.currentTarget)close()}}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-3xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm">
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
      <div className="min-h-0 overflow-y-auto p-6 sm:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5V4h6v1M4 7h16M6 7l1 13h10l1-13M10 10v7M14 10v7" /></svg>
        </div>
        <h2 id="account-deletion-title" className="text-2xl font-bold tracking-tight">{t('title')}</h2>
        <p id="account-deletion-description" className="mt-2 text-sm leading-6 text-slate-500">{t('description')}</p>
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs font-medium text-slate-500">{t('target')}</p><p className="mt-1 break-all text-sm font-semibold">{email}</p></div>
        <div className="mt-5 space-y-4 text-sm">
          <div><h3 className="font-semibold">{t('deletedTitle')}</h3><p className="mt-1.5 leading-6 text-slate-600">{t('deletedDescription')}</p></div>
          <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3"><h3 className="flex items-center gap-2 font-semibold text-teal-900"><span aria-hidden="true">✓</span>{t('calendarTitle')}</h3><p className="mt-1 leading-6 text-teal-800">{t('calendarDescription')}</p></div>
          <p className="text-xs leading-5 text-slate-500">{t('paymentNote')}</p>
        </div>
        <div aria-live="polite" className="mt-5">
          {!status && !error && <p className="text-sm text-slate-500">{t('checking')}</p>}
          {status?.state==='idle' && !status.canDelete && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">{t('activeTitle')}</p><p className="mt-1 leading-6">{t('activeJobs')}</p>
            <ul className="mt-2 space-y-1">{status.activeJobs.slice(0,3).map(job=><li key={job.id} className="break-words">・{job.title ?? t('unnamedJob')}</li>)}</ul>
          </div>}
          {status?.state==='deleting' && <div role="status" className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><span aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600 motion-reduce:animate-none" />{t('deleting')}</div>}
          {status?.state==='retry' && <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{t('retryDescription')}</p>}
          {error && <p role="alert" className="mt-3 text-sm leading-6 text-red-700">{t(error)}</p>}
        </div>
        {!started && <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-700">
          <input type="checkbox" checked={checked} disabled={locked || !status?.canDelete} onChange={event=>setChecked(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-teal-700" />
          <span>{t('acknowledge')}</span>
        </label>}
      </div>
      <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
        <button ref={cancel} type="button" disabled={locked} onClick={close} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50">{started ? t('close') : t('cancel')}</button>
        <button type="button" disabled={locked || !status || (status.state==='idle' && (!status.canDelete || !checked))} onClick={()=>void remove()} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{locked ? t('processing') : status?.state==='retry' ? t('retry') : t('confirm')}</button>
      </div>
      </div>
    </dialog>}
  </>
}
