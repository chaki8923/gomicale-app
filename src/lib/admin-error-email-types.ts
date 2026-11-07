export const ERROR_JOBS_PAGE_SIZE = 50
export const EMAIL_SUBJECT_MAX = 200
export const EMAIL_BODY_MAX = 10000

export type DeliveryStatus = 'sending' | 'sent' | 'failed' | 'unknown'

export type ErrorEmailDelivery = {
  id: string
  operation_id: string
  admin_user_id: string
  recipient_user_id: string
  recipient_email: string
  from_email: string
  job_ids: string[]
  subject: string
  body: string
  status: DeliveryStatus
  provider_message_id: string | null
  error_code: string | null
  created_at: string
  sent_at: string | null
}

export type ErrorJobRow = {
  id: string
  user_id: string
  status: string
  created_at: string
  updated_at: string
  pdf_title: string | null
  r2_object_key: string
  error_message: string | null
  result_data: unknown
}

export type AdminErrorJob = {
  id: string
  userId: string
  email: string | null
  createdAt: string
  fileName: string
  errorMessage: string | null
  errorCode: string | null
  latestEmail: ErrorEmailDelivery | null
}

export type ErrorJobsPage = { jobs: AdminErrorJob[]; page: number; total: number }
export type SendEmailInput = { operationId: string; jobIds: string[]; subject: string; body: string }
export type SendEmailResult = {
  outcome: 'sent' | 'failed' | 'skipped' | 'unknown'
  code?: string
  delivery?: ErrorEmailDelivery
}

export class AdminEmailError extends Error {
  constructor(public code: string, public status = 400) {
    super(code)
    this.name = 'AdminEmailError'
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseSendEmailInput(value: unknown): SendEmailInput {
  if (!value || typeof value !== 'object') throw new AdminEmailError('INVALID_INPUT')
  const input = value as Record<string, unknown>
  if (typeof input.operationId !== 'string' || !UUID.test(input.operationId)
    || !Array.isArray(input.jobIds) || !input.jobIds.length || input.jobIds.length > ERROR_JOBS_PAGE_SIZE
    || input.jobIds.some(id => typeof id !== 'string' || !UUID.test(id))
    || typeof input.subject !== 'string' || typeof input.body !== 'string') {
    throw new AdminEmailError('INVALID_INPUT')
  }
  const subject = input.subject.trim()
  const body = input.body.trim()
  if (!subject || subject.length > EMAIL_SUBJECT_MAX || /[\r\n\u0000]/.test(subject)
    || !body || body.length > EMAIL_BODY_MAX || body.includes('\u0000')) {
    throw new AdminEmailError('INVALID_INPUT')
  }
  return {
    operationId: input.operationId.toLowerCase(),
    jobIds: [...new Set((input.jobIds as string[]).map(id => id.toLowerCase()))].sort(),
    subject,
    body,
  }
}

export function groupEmailRecipients(jobs: AdminErrorJob[]) {
  const groups = new Map<string, { userId: string; email: string | null; jobIds: string[] }>()
  for (const job of jobs) {
    const group = groups.get(job.userId) ?? { userId: job.userId, email: job.email, jobIds: [] }
    if (!group.jobIds.includes(job.id)) group.jobIds.push(job.id)
    groups.set(job.userId, group)
  }
  return [...groups.values()]
}
