/** Also used by background workers, which do not have an end-user session. */
export async function isAccountActive(db: {
  rpc(name: 'account_is_active', args: { p_user_id: string }): PromiseLike<{ data: unknown; error: unknown }>
}, userId: string): Promise<boolean> {
  const { data, error } = await db.rpc('account_is_active', { p_user_id: userId })
  if (error) throw new Error('ACCOUNT_CHECK_FAILED')
  return data === true
}

export type AccountDeletion = {
  user_id: string
  operation_id: string
  stage: 'files' | 'google' | 'auth' | 'cache' | 'cleanup'
  pdf_hashes: string[]
  lease_token: string | null
  lease_until: string | null
  cleanup_after: string
  last_error_code: string | null
  created_at: string
  updated_at: string
}
