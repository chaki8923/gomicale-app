export type ReadyEmailPayload = { from: string; to: string; subject: string; text: string; html: string }
export type CalendarImportTask = {
  job_id: string
  dispatch_attempts: number
  dispatch_token: string
  email_payload: ReadyEmailPayload | null
  email_status: 'pending' | 'sent' | 'failed'
  email_first_attempt_at: string | null
  email_sent_at: string | null
  email_provider_id: string | null
  email_error_code: string | null
  created_at: string
}
