import 'server-only'
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { deleteAccountFiles } from '@/lib/r2'
import type { AccountDeletion } from '../../shared/account-lifecycle'

export const DELETION_COOKIE = 'gomicale-account-deletion'
export class DeletionError extends Error {
  constructor(public code: string, public status = 503) { super(code) }
}
export function createDeletionReceipt(userId: string, operationId: string) {
  const value = Buffer.from(JSON.stringify({ userId, operationId, expires: Date.now() + 7*86400000 })).toString('base64url')
  const signature = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(value).digest('base64url')
  return `${value}.${signature}`
}
function readReceipt(request: Request): { userId: string; operationId: string } | null {
  const cookie = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${DELETION_COOKIE}=`))?.slice(DELETION_COOKIE.length+1)
  if (!cookie || cookie.length > 1000) return null
  try {
    const [value, sig, extra] = cookie.split('.')
    if (!value || !sig || extra) return null
    const expected = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(value).digest()
    const actual = Buffer.from(sig, 'base64url')
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
    const data = JSON.parse(Buffer.from(value, 'base64url').toString())
    if (typeof data.userId !== 'string' || typeof data.operationId !== 'string' || typeof data.expires !== 'number' || data.expires < Date.now()) return null
    return data
  } catch { return null }
}
export async function deletionIdentity(request: Request) {
  const auth = await getSupabaseServerClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (user && !error) return { userId: user.id, operationId: null }
  const receipt = readReceipt(request)
  if (!receipt) throw new DeletionError('UNAUTHORIZED', 401)
  return receipt
}
export async function deletionStatus(identity: { userId: string; operationId: string | null }) {
  const db = getSupabaseServiceClient()
  const { data: row, error } = await db.from('account_deletion_requests').select('*').eq('user_id', identity.userId).maybeSingle()
  if (error) throw new DeletionError('STATUS_UNAVAILABLE')
  if (identity.operationId && row?.operation_id !== identity.operationId) {
    if (row) throw new DeletionError('UNAUTHORIZED', 401)
    const { data, error: userError } = await db.auth.admin.getUserById(identity.userId)
    if (userError?.status !== 404 && (userError || data.user)) throw new DeletionError('STATUS_UNAVAILABLE')
    return { state: 'completed' as const, canDelete: false, activeJobs: [] }
  }
  if (row) return { state: row.stage === 'cleanup' ? 'completed' as const : (!row.lease_until || Date.parse(row.lease_until)<Date.now()) ? 'retry' as const : 'deleting' as const,
    canDelete: false, activeJobs: [], error: row.last_error_code }
  const { data: activeJobs, error: jobsError } = await db.rpc('account_deletion_blockers', { p_user_id: identity.userId })
  if (jobsError) throw new DeletionError('STATUS_UNAVAILABLE')
  return { state: 'idle' as const, canDelete: !activeJobs?.length, activeJobs: activeJobs ?? [] }
}
export async function claimDeletion(userId: string, operationId: string | null) {
  const db = getSupabaseServiceClient()
  if (operationId) {
    const { data, error } = await db.from('account_deletion_requests').select('operation_id').eq('user_id', userId).maybeSingle()
    if (error || data?.operation_id !== operationId) throw new DeletionError('UNAUTHORIZED', 401)
  }
  const token = randomUUID()
  const { data, error } = await db.rpc('begin_account_deletion', { p_user_id: userId, p_token: token })
  if (error) {
    if (error.message.includes('ACTIVE_JOBS')) throw new DeletionError('ACTIVE_JOBS', 409)
    if (error.message.includes('ACCOUNT_MISSING')) throw new DeletionError('UNAUTHORIZED', 401)
    throw new DeletionError('DELETE_START_FAILED')
  }
  return { row: data?.[0], token }
}

/** All stages are repeatable; Auth is removed only after the external cleanup. */
export async function runAccountDeletion(row: AccountDeletion, token: string, budgetMs = 40000) {
  const db = getSupabaseServiceClient()
  const deadline = Date.now()+budgetMs
  let stage = row.stage
  const advance = async (next: AccountDeletion['stage']) => {
    const { data, error } = await db.from('account_deletion_requests').update({ stage: next, last_error_code: null, updated_at: new Date().toISOString() })
      .eq('user_id',row.user_id).eq('lease_token',token).select('user_id').maybeSingle()
    if (error || !data) throw new DeletionError('PROGRESS_SAVE_FAILED')
    stage = next
  }
  try {
    if (stage === 'files') {
      if (!await deleteAccountFiles(row.user_id, deadline)) return
      await advance('google')
    }
    if (stage === 'google' && Date.now() < deadline-12000) {
      const { data, error } = await db.from('user_integrations').select('google_refresh_token_enc,google_access_token_enc').eq('user_id',row.user_id).maybeSingle()
      if (error) throw new DeletionError('GOOGLE_UNLINK_FAILED')
      const googleToken = data?.google_refresh_token_enc ?? data?.google_access_token_enc
      if (googleToken) {
        const response = await fetch('https://oauth2.googleapis.com/revoke', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({token:googleToken}), signal:AbortSignal.timeout(10000) })
        // An already invalid token is already disconnected. Other errors are retried.
        const result = await response.text()
        if (!response.ok && !(response.status===400 && /invalid_token/.test(result))) throw new DeletionError('GOOGLE_UNLINK_FAILED')
      }
      const { error: deleteError } = await db.from('user_integrations').delete().eq('user_id',row.user_id)
      if (deleteError) throw new DeletionError('GOOGLE_UNLINK_FAILED')
      await advance('auth')
    }
    if (stage === 'auth' && Date.now() < deadline-10000) {
      const { error } = await db.auth.admin.deleteUser(row.user_id)
      if (error && error.status!==404) throw new DeletionError('ACCOUNT_DELETE_FAILED')
      await advance('cache')
    }
    if (stage === 'cache') {
      const { data, error } = await db.rpc('cleanup_deleted_account_cache', { p_user_id:row.user_id, p_token:token })
      if (error || !data) throw new DeletionError('CACHE_CLEANUP_FAILED')
      await advance('cleanup')
    }
    if (stage === 'cleanup') {
      if (Date.now() >= Date.parse(row.cleanup_after) && await deleteAccountFiles(row.user_id, deadline)) {
        const { error: cleanupError } = await db.from('account_deletion_requests').delete().eq('user_id',row.user_id).eq('lease_token',token)
        if (cleanupError) throw new DeletionError('CLEANUP_FAILED')
      }
    }
  } catch (error) {
    const code = error instanceof DeletionError ? error.code : 'DELETE_RETRY_REQUIRED'
    await db.from('account_deletion_requests').update({ last_error_code:code }).eq('user_id',row.user_id).eq('lease_token',token)
    console.warn('[account-deletion]',code) // Never log a provider response or credential.
  } finally {
    await db.from('account_deletion_requests').update({ lease_token:null,lease_until:null,updated_at:new Date().toISOString() })
      .eq('user_id',row.user_id).eq('lease_token',token)
  }
}
export async function retryAccountDeletions() {
  const db = getSupabaseServiceClient()
  const deadline = Date.now()+25000
  const { data, error } = await db.from('account_deletion_requests').select('user_id,stage,cleanup_after')
    .or(`stage.neq.cleanup,cleanup_after.lte.${new Date().toISOString()}`).order('updated_at').limit(20)
  if (error) throw new DeletionError('CLEANUP_UNAVAILABLE')
  for (const entry of data ?? []) {
    if (Date.now()>deadline-12000) break
    if (entry.stage==='cleanup' && Date.parse(entry.cleanup_after)>Date.now()) continue
    try {
      const { row, token } = await claimDeletion(entry.user_id,null)
      if (row) await runAccountDeletion(row,token,Math.min(20000,deadline-Date.now()))
    } catch { console.warn('[account-deletion] CLEANUP_RETRY_REQUIRED') }
  }
}
