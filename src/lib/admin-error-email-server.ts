import 'server-only'
import { Resend } from 'resend'
import { getSupabaseServiceClient } from './supabase/server'
import { AdminEmailError, ERROR_JOBS_PAGE_SIZE } from './admin-error-email-types'
import { createAdminEmailService, EmailProviderError, type AdminEmailRepository } from './admin-error-email-service'
import { isAccountActive } from '../../shared/account-lifecycle'

const JOB_FIELDS = 'id, user_id, status, created_at, updated_at, pdf_title, r2_object_key, error_message, result_data'

export function getAdminEmailService() {
  // This factory is only invoked after the page/API has verified the admin session.
  const db = getSupabaseServiceClient()
  const repository: AdminEmailRepository = {
    async listErrorJobs(page) {
      const offset = (page - 1) * ERROR_JOBS_PAGE_SIZE
      const { data, error, count } = await db.from('jobs').select(JOB_FIELDS, { count: 'exact' })
        .eq('status', 'error').order('updated_at', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + ERROR_JOBS_PAGE_SIZE - 1)
      if (error) throw error
      return { jobs: data ?? [], total: count ?? 0 }
    },
    async getJobs(ids) {
      const { data, error } = await db.from('jobs').select(JOB_FIELDS).in('id', ids)
      if (error) throw error
      return data ?? []
    },
    async getUserEmail(userId) {
      try {
        if (!await isAccountActive(db,userId)) return null
        const { data, error } = await db.auth.admin.getUserById(userId)
        if (error || !data.user?.email || !data.user.email_confirmed_at) return null
        return data.user.email
      } catch { return null }
    },
    async latestEmails(userIds) {
      const { data, error } = await db.from('latest_admin_error_emails').select('*').in('recipient_user_id', userIds)
      if (error) throw error
      return data ?? []
    },
    async getDelivery(operationId, userId) {
      const { data, error } = await db.from('admin_error_emails').select('*')
        .eq('operation_id', operationId).eq('recipient_user_id', userId).maybeSingle()
      if (error) throw error
      return data
    },
    async ensureDelivery(input) {
      const { data, error } = await db.from('admin_error_emails').insert(input).select('*').single()
      if (!error) return data
      if (error.code !== '23505') throw error
      const existing = await repository.getDelivery(input.operation_id, input.recipient_user_id)
      if (!existing) throw error
      return existing
    },
    async saveOutcome(delivery, outcome) {
      const { data, error } = await db.from('admin_error_emails').update(outcome)
        .eq('id', delivery.id).neq('status', 'sent').select('*').maybeSingle()
      if (error) throw error
      if (data) return data
      const existing = await repository.getDelivery(delivery.operation_id, delivery.recipient_user_id)
      if (!existing) throw new Error('Delivery no longer exists')
      return existing
    },
  }
  return createAdminEmailService({
    repository,
    fromEmail: process.env.APP_FROM_EMAIL ?? 'ゴミカレ <onboarding@resend.dev>',
    async send(delivery, idempotencyKey) {
      if (!await isAccountActive(db,delivery.recipient_user_id) || !await isAccountActive(db,delivery.admin_user_id)) throw new EmailProviderError(true)
      const apiKey = process.env.RESEND_API_KEY
      if (!apiKey) throw new EmailProviderError(true)
      const { data, error } = await new Resend(apiKey).emails.send({
        from: delivery.from_email, to: delivery.recipient_email,
        subject: delivery.subject, text: delivery.body,
      }, { idempotencyKey })
      if (error || !data?.id) {
        // A network/application failure or concurrent idempotent request can be ambiguous.
        const definitive = ['validation_error', 'missing_required_field', 'invalid_parameter',
          'invalid_access', 'restricted_api_key', 'rate_limit_exceeded', 'monthly_quota_exceeded',
          'daily_quota_exceeded', 'invalid_api_key', 'missing_api_key', 'invalid_from_address',
          'security_error'].includes(error?.name ?? '')
        throw new EmailProviderError(definitive)
      }
      return data.id
    },
  })
}

export function assertEmailConfigured() {
  if (!process.env.RESEND_API_KEY) throw new AdminEmailError('EMAIL_NOT_CONFIGURED', 503)
}

export function getAdminDashboardUrl(locale: string) {
  const base = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://gomicale.jp'
  const url = new URL(base)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid app URL')
  return new URL(`/${locale === 'en' ? 'en' : 'ja'}/dashboard`, url.origin).toString()
}
