export type InquiryMail = {
  from: string
  to: string
  replyTo?: string
  subject: string
  text: string
}

export type InquiryNotification = {
  id: string
  kind: 'post' | 'reply'
  post_id: string
  reply_id: string | null
  user_id: string
  status: 'pending' | 'sent' | 'skipped' | 'review_required'
  payload: InquiryMail | null
  attempts: number
  first_attempt_at: string | null
  next_attempt_at: string
  lease_token: string | null
  lease_until: string | null
  last_error_code: string | null
  resend_id: string | null
  sent_at: string | null
  created_at: string
}
