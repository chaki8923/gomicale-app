import 'server-only'
import { NextResponse } from 'next/server'
import { isAccountActive } from '../../shared/account-lifecycle'
import { getSupabaseServiceClient } from '@/lib/supabase/server'

export async function accountAccessError(userId: string) {
  try {
    if (await isAccountActive(getSupabaseServiceClient(), userId)) return null
    return NextResponse.json({ error:'ACCOUNT_DELETING' },{status:409})
  } catch { return NextResponse.json({error:'ACCOUNT_CHECK_FAILED'},{status:503}) }
}
