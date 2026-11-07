import 'server-only'
import { getSupabaseServerClient } from './supabase/server'
import { isAdminUser } from './admin-identity'

export function getAdminEmail() {
  return process.env.ADMIN_EMAIL ?? process.env.NEXT_PUBLIC_ADMIN_EMAIL
}

export async function getAdminSession() {
  const supabase = await getSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, status: 401 as const }
  if (!isAdminUser(user, getAdminEmail())) return { user: null, status: 403 as const }
  return { user, status: 200 as const }
}
