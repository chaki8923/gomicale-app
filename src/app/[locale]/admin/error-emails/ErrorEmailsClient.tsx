'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Button } from '@/components/ui/Button'
import {
  EMAIL_BODY_MAX, EMAIL_SUBJECT_MAX, ERROR_JOBS_PAGE_SIZE, groupEmailRecipients,
  type AdminErrorJob, type ErrorJobsPage, type SendEmailResult,
} from '@/lib/admin-error-email-types'

type Snapshot = {
  operationId: string
  subject: string
  body: string
  recipients: ReturnType<typeof groupEmailRecipients>
}

const primaryButton = 'rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
const secondaryButton = 'rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
const inputClass = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-teal-600 focus:outline-2 focus:outline-teal-100 disabled:bg-gray-50'

export function ErrorEmailsClient({ dashboardUrl }: { dashboardUrl: string }) {
  const t = useTranslations('adminErrorEmails')
  const locale = useLocale()
  const [data, setData] = useState<ErrorJobsPage | null>(null)
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState(() => t('defaultSubject'))
  const [body, setBody] = useState(() => t('defaultBody', { dashboardUrl }))
  const [step, setStep] = useState<'compose' | 'confirm' | 'results'>('compose')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [results, setResults] = useState<Record<string, SendEmailResult>>({})
  const [sending, setSending] = useState(false)
  const [composeError, setComposeError] = useState(false)
  const sendingRef = useRef(false)
  const confirmationRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/admin/error-jobs?page=${page}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const value = await response.json()
        if (!response.ok) throw new Error(value.error ?? 'SERVER_ERROR')
        if (!controller.signal.aborted) { setData(value); setLoadError(null) }
      })
      .catch(error => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'SERVER_ERROR')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, refresh])

  useEffect(() => { if (step === 'confirm') confirmationRef.current?.focus() }, [step, snapshot])

  const chosenJobs = useMemo(() => (data?.jobs ?? []).filter(job => selected.has(job.id)), [data, selected])
  const recipients = useMemo(() => groupEmailRecipients(chosenJobs), [chosenJobs])
  const editable = step === 'compose' && !sending
  const allSelected = Boolean(data?.jobs.length && data.jobs.every(job => selected.has(job.id)))
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / ERROR_JOBS_PAGE_SIZE))

  function errorText(code?: string) {
    return t(t.has(`errors.${code}`) ? `errors.${code}` : 'errors.SERVER_ERROR')
  }

  function date(value: string) {
    return new Date(value).toLocaleString(locale === 'en' ? 'en-US' : 'ja-JP', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }

  function reload() { setLoading(true); setRefresh(value => value + 1) }

  function changePage(next: number) {
    setSelected(new Set()); setLoading(true); setLoadError(null); setPage(next)
  }

  function toggle(jobId: string) {
    setSelected(previous => {
      const next = new Set(previous)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  function review(jobs: AdminErrorJob[]) {
    if (!jobs.length || !subject.trim() || !body.trim()) { setComposeError(true); return }
    setComposeError(false)
    setSelected(new Set(jobs.map(job => job.id)))
    setSnapshot({ operationId: crypto.randomUUID(), subject: subject.trim(), body: body.trim(), recipients: groupEmailRecipients(jobs) })
    setResults({})
    setStep('confirm')
  }

  async function sendEmails(retry = false) {
    if (!snapshot || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setStep('results')
    const targets = snapshot.recipients.filter(recipient => !retry || ['failed', 'unknown'].includes(results[recipient.userId]?.outcome))
    try {
      for (let index = 0; index < targets.length; index++) {
        const recipient = targets[index]
        let result: SendEmailResult
        if (!recipient.email) result = { outcome: 'skipped', code: 'EMAIL_UNAVAILABLE' }
        else {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 25000)
          try {
            const response = await fetch('/api/admin/error-emails', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
              body: JSON.stringify({ operationId: snapshot.operationId, jobIds: recipient.jobIds, subject: snapshot.subject, body: snapshot.body }),
            })
            const value = await response.json()
            result = response.ok ? value : { outcome: 'failed', code: value.error ?? 'SERVER_ERROR' }
          } catch {
            result = { outcome: 'unknown', code: 'RESULT_UNKNOWN' }
          } finally { clearTimeout(timeout) }
        }
        setResults(previous => ({ ...previous, [recipient.userId]: result }))
        // Keep bulk sending below the provider's request rate, with one recipient per email.
        if (index < targets.length - 1) await new Promise(resolve => setTimeout(resolve, 700))
      }
    } finally {
      sendingRef.current = false
      setSending(false)
      reload()
    }
  }

  function retryPrevious(job: AdminErrorJob) {
    const previous = job.latestEmail
    if (!previous) return
    setSnapshot({ operationId: previous.operation_id, subject: previous.subject, body: previous.body,
      recipients: [{ userId: previous.recipient_user_id, email: previous.recipient_email, jobIds: previous.job_ids }] })
    setResults({})
    setStep('confirm')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 text-gray-900">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="text-sm font-semibold text-teal-700 hover:text-teal-900">← {t('back')}</Link>
          <div className="flex items-center gap-4"><span className="text-xs font-semibold text-gray-500">{t('adminOnly')}</span><LanguageSwitcher /></div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">{t('description')}</p>
        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,1fr)]">
          <section className="min-w-0 rounded-2xl border border-gray-200 bg-white shadow-sm" aria-labelledby="error-list-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
              <div><h2 id="error-list-title" className="font-semibold">{t('listTitle')}</h2>
                {data && <p className="mt-1 text-xs text-gray-500">{t('total', { count: data.total })} · JST</p>}</div>
              <Button type="button" className={secondaryButton} disabled={loading || !editable} onClick={reload}>{t('refresh')}</Button>
            </div>
            {loadError && <div role="alert" className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{errorText(loadError)}</div>}
            {loading && <p role="status" className="p-6 text-sm text-gray-500">{t('loading')}</p>}
            {!loading && !loadError && data?.jobs.length === 0 && <p className="p-6 text-sm text-gray-500">{t('empty')}</p>}
            {!loading && !loadError && Boolean(data?.jobs.length) && <>
              {editable && chosenJobs.length > 0 && <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-teal-100 bg-teal-50 px-5 py-3 text-sm text-teal-800">
                <span>{t('uniqueRecipients', { count: recipients.length })}</span>
                <a href="#email-editor-title" className="font-semibold underline underline-offset-4">{t('composeTitle')} →</a>
              </div>}
              <label className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 text-sm text-gray-600">
                <input type="checkbox" className="size-4 accent-teal-600" disabled={!editable} checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(data!.jobs.map(job => job.id)))} />{t('selectPage')}
              </label>
              <ul className="divide-y divide-gray-100">
                {data?.jobs.map(job => (
                  <li key={job.id} className={`p-5 ${selected.has(job.id) ? 'bg-teal-50/60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" className="mt-1 size-4 shrink-0 accent-teal-600" aria-label={t('selectJob', { name: job.email ?? job.fileName })}
                        checked={selected.has(job.id)} disabled={!editable} onChange={() => toggle(job.id)} />
                      <div className="min-w-0 flex-1">
                        <p className="break-all text-sm font-semibold">{job.email ?? t('emailUnavailable')}</p>
                        <p className="mt-1 break-words text-sm text-gray-600">{job.fileName}</p>
                        <p className="mt-1 text-xs text-gray-400">{date(job.createdAt)}</p>
                        {job.errorCode && <span className="mt-3 inline-block max-w-full break-all rounded-md bg-red-50 px-2 py-1 font-mono text-[11px] text-red-700">{job.errorCode}</span>}
                        <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-gray-600">{job.errorMessage ?? t('noErrorDetail')}</p>
                        <details className="mt-3 text-xs text-gray-500">
                          <summary className="cursor-pointer leading-5">{t('latestManual')}: {job.latestEmail ? `${t(`status.${job.latestEmail.status}`)} · ${date(job.latestEmail.created_at)}` : t('neverSent')}</summary>
                          {job.latestEmail && <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-white p-3">
                            <p className="font-semibold text-gray-700">{job.latestEmail.subject}</p>
                            <p className="whitespace-pre-wrap break-words leading-5">{job.latestEmail.body}</p>
                            {job.latestEmail.error_code && <p className="text-amber-800">{errorText(job.latestEmail.error_code)}</p>}
                            {job.latestEmail.status !== 'sent' && <Button type="button" className={secondaryButton} disabled={!editable} onClick={() => retryPrevious(job)}>{t('retryPrevious')}</Button>}
                          </div>}
                        </details>
                        <Button type="button" className="mt-3 text-xs font-semibold text-teal-700 underline-offset-4 hover:underline disabled:opacity-40" disabled={!editable || !job.email}
                          onClick={() => review([job])}>{t('sendIndividual')}</Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>}
            <div className="flex items-center justify-between gap-2 border-t border-gray-100 p-4">
              <Button type="button" className={secondaryButton} disabled={page <= 1 || loading || !editable} onClick={() => changePage(page - 1)}>{t('previous')}</Button>
              <span className="text-xs text-gray-500">{t('page', { page, pages: Math.max(page, pages) })}</span>
              <Button type="button" className={secondaryButton} disabled={page >= pages || loading || !editable} onClick={() => changePage(page + 1)}>{t('next')}</Button>
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-6" aria-labelledby="email-editor-title">
            {step === 'compose' ? <form onSubmit={event => { event.preventDefault(); review(chosenJobs) }}>
              <h2 id="email-editor-title" className="text-lg font-semibold">{t('composeTitle')}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">{t('selection', { jobs: chosenJobs.length, users: recipients.length })}</p>
              <label className="mt-5 block text-sm font-medium" htmlFor="email-subject">{t('subject')}</label>
              <input id="email-subject" className={`${inputClass} mt-2`} required maxLength={EMAIL_SUBJECT_MAX} value={subject} onChange={event => setSubject(event.target.value)} />
              <label className="mt-5 block text-sm font-medium" htmlFor="email-body">{t('body')}</label>
              <textarea id="email-body" className={`${inputClass} mt-2 min-h-72 resize-y leading-6`} required maxLength={EMAIL_BODY_MAX} value={body} onChange={event => setBody(event.target.value)} />
              <p className="mt-2 text-xs leading-5 text-gray-500">{t('plainTextNote')}</p>
              {composeError && <p role="alert" className="mt-3 text-sm text-red-700">{errorText('INVALID_INPUT')}</p>}
              <Button type="submit" className={`${primaryButton} mt-6 w-full`} disabled={!recipients.some(recipient => recipient.email) || loading || Boolean(loadError)}>{t('review')}</Button>
            </form> : snapshot && <>
              <h2 id="email-editor-title" ref={confirmationRef} tabIndex={-1} className="text-lg font-semibold outline-none">{t(step === 'confirm' ? 'confirmTitle' : 'resultsTitle')}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">{t('uniqueRecipients', { count: snapshot.recipients.length })}</p>
              <ul className="mt-4 space-y-3" aria-live="polite">
                {snapshot.recipients.map(recipient => {
                  const result = results[recipient.userId]
                  return <li key={recipient.userId} className="rounded-xl border border-gray-200 px-3 py-3">
                    <p className="break-all text-sm font-medium">{recipient.email ?? t('emailUnavailable')}</p>
                    <p className="mt-1 text-xs text-gray-500">{t('relatedJobs', { count: recipient.jobIds.length })}</p>
                    {step === 'confirm' && !recipient.email && <p className="mt-1 text-xs text-amber-800">{t('willSkip')}</p>}
                    {step === 'results' && <p className={`mt-2 text-xs leading-5 ${result?.outcome === 'sent' ? 'text-teal-700' : result?.outcome === 'failed' ? 'text-red-700' : 'text-amber-800'}`}>
                      {result ? t(`outcome.${result.outcome}`) : t('waiting')}{result?.code ? ` — ${errorText(result.code)}` : ''}
                    </p>}
                  </li>
                })}
              </ul>
              <div className="mt-5 rounded-xl bg-gray-50 p-4">
                <h3 className="break-words text-sm font-semibold">{snapshot.subject}</h3>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{snapshot.body}</p>
              </div>
              {step === 'confirm' ? <>
                <p className="mt-4 text-xs leading-5 text-gray-500">{t('confirmNote')}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button type="button" className={secondaryButton} onClick={() => setStep('compose')}>{t('edit')}</Button>
                  <Button type="button" className={`${primaryButton} flex-1`} onClick={() => void sendEmails()}>{t('send', { count: snapshot.recipients.filter(recipient => recipient.email).length })}</Button>
                </div>
              </> : <>
                <p role="status" className="mt-4 text-sm text-gray-600">{t('progress', { done: Object.keys(results).length, total: snapshot.recipients.length })}{sending ? ` · ${t('sending')}` : ''}</p>
                <p className="mt-3 text-xs leading-5 text-gray-500">{t('retryNote')}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {Object.values(results).some(result => ['failed', 'unknown'].includes(result.outcome) && result.code !== 'RETRY_EXPIRED') &&
                    <Button type="button" className={primaryButton} disabled={sending} onClick={() => void sendEmails(true)}>{t('retry')}</Button>}
                  <Button type="button" className={secondaryButton} disabled={sending} onClick={() => { setStep('compose'); setSnapshot(null); setResults({}); setSelected(new Set()) }}>{t('newEmail')}</Button>
                </div>
              </>}
            </>}
          </section>
        </div>
      </main>
    </div>
  )
}
