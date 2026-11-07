import { getJobErrorCode } from './job-errors'
import {
  AdminEmailError, ERROR_JOBS_PAGE_SIZE,
  type ErrorEmailDelivery, type ErrorJobRow, type ErrorJobsPage,
  type SendEmailInput, type SendEmailResult,
} from './admin-error-email-types'

export type NewDelivery = Omit<ErrorEmailDelivery, 'id' | 'created_at' | 'sent_at' | 'provider_message_id' | 'error_code'>
export type DeliveryOutcome = Pick<ErrorEmailDelivery, 'status' | 'sent_at' | 'provider_message_id' | 'error_code'>

export interface AdminEmailRepository {
  listErrorJobs(page: number): Promise<{ jobs: ErrorJobRow[]; total: number }>
  getJobs(ids: string[]): Promise<ErrorJobRow[]>
  getUserEmail(userId: string): Promise<string | null>
  latestEmails(userIds: string[]): Promise<ErrorEmailDelivery[]>
  getDelivery(operationId: string, userId: string): Promise<ErrorEmailDelivery | null>
  ensureDelivery(input: NewDelivery): Promise<ErrorEmailDelivery>
  saveOutcome(delivery: ErrorEmailDelivery, outcome: DeliveryOutcome): Promise<ErrorEmailDelivery>
}

export class EmailProviderError extends Error {
  constructor(public definitive: boolean) { super('EMAIL_PROVIDER_ERROR') }
}

type Dependencies = {
  repository: AdminEmailRepository
  send: (delivery: ErrorEmailDelivery, idempotencyKey: string) => Promise<string>
  fromEmail: string
  now?: () => number
}

function sameRequest(delivery: ErrorEmailDelivery, input: SendEmailInput, adminId: string) {
  return delivery.admin_user_id === adminId && delivery.subject === input.subject
    && delivery.body === input.body
    && [...delivery.job_ids].sort().join(',') === input.jobIds.join(',')
}

export function createAdminEmailService({ repository, send, fromEmail, now = Date.now }: Dependencies) {
  return {
    async list(page: number): Promise<ErrorJobsPage> {
      const { jobs, total } = await repository.listErrorJobs(page)
      const userIds = [...new Set(jobs.map(job => job.user_id))]
      const [emails, history] = await Promise.all([
        Promise.all(userIds.map(async id => [id, await repository.getUserEmail(id)] as const)),
        userIds.length ? repository.latestEmails(userIds) : Promise.resolve([]),
      ])
      const emailMap = new Map(emails)
      const historyMap = new Map(history.map(item => [item.recipient_user_id, item]))
      return {
        page, total,
        jobs: jobs.map(job => ({
          id: job.id, userId: job.user_id, email: emailMap.get(job.user_id) ?? null,
          createdAt: job.updated_at,
          fileName: job.pdf_title || job.r2_object_key.split('/').pop() || job.id,
          errorMessage: job.error_message, errorCode: getJobErrorCode(job.result_data),
          latestEmail: historyMap.get(job.user_id) ?? null,
        })),
      }
    },

    async send(adminId: string, input: SendEmailInput): Promise<SendEmailResult> {
      const jobs = await repository.getJobs(input.jobIds)
      if (jobs.length !== input.jobIds.length) throw new AdminEmailError('JOBS_CHANGED', 409)
      const userIds = new Set(jobs.map(job => job.user_id))
      // Each HTTP request sends one email. Bulk requests are grouped by user in the UI.
      if (userIds.size !== 1) throw new AdminEmailError('MIXED_RECIPIENTS')
      const userId = jobs[0].user_id
      let delivery = await repository.getDelivery(input.operationId, userId)
      if (delivery && !sameRequest(delivery, input, adminId)) throw new AdminEmailError('OPERATION_CONFLICT', 409)
      if (delivery?.status === 'sent') return { outcome: 'sent', delivery }
      if (jobs.some(job => job.status !== 'error')) return { outcome: 'skipped', code: 'JOBS_CHANGED' }

      if (!delivery) {
        const email = await repository.getUserEmail(userId)
        if (!email) return { outcome: 'skipped', code: 'EMAIL_UNAVAILABLE' }
        delivery = await repository.ensureDelivery({
          operation_id: input.operationId, admin_user_id: adminId, recipient_user_id: userId,
          recipient_email: email, from_email: fromEmail, job_ids: input.jobIds,
          subject: input.subject, body: input.body, status: 'sending',
        })
        // A concurrent request may have inserted the same operation first.
        if (!sameRequest(delivery, input, adminId)) throw new AdminEmailError('OPERATION_CONFLICT', 409)
        if (delivery.status === 'sent') return { outcome: 'sent', delivery }
      }
      // Resend retains keys for 24h; leave a margin and never silently resend an expired operation.
      if (now() - Date.parse(delivery.created_at) >= 23 * 60 * 60 * 1000) {
        return { outcome: 'unknown', code: 'RETRY_EXPIRED', delivery }
      }

      let outcome: DeliveryOutcome
      try {
        const id = await send(delivery, `admin-error-email/${input.operationId}/${userId}`)
        outcome = { status: 'sent', provider_message_id: id, error_code: null, sent_at: new Date(now()).toISOString() }
      } catch (error) {
        const definitive = error instanceof EmailProviderError && error.definitive
        outcome = {
          status: definitive ? 'failed' : 'unknown', provider_message_id: null,
          error_code: definitive ? 'SEND_FAILED' : 'RESULT_UNKNOWN', sent_at: null,
        }
      }
      try {
        // The repository never allows a concurrent failure to downgrade a recorded success.
        delivery = await repository.saveOutcome(delivery, outcome)
      } catch {
        return { outcome: 'unknown', code: 'HISTORY_UNAVAILABLE' }
      }
      return { outcome: delivery.status === 'sent' ? 'sent' : delivery.status === 'failed' ? 'failed' : 'unknown',
        code: delivery.error_code ?? undefined, delivery }
    },
  }
}

export function parseErrorJobsPage(value: string | null) {
  const page = value === null ? 1 : Number(value)
  if (!Number.isSafeInteger(page) || page < 1 || page > Math.floor(1_000_000 / ERROR_JOBS_PAGE_SIZE)) {
    throw new AdminEmailError('INVALID_INPUT')
  }
  return page
}
