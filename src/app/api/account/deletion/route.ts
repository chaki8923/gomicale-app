import { NextResponse } from 'next/server'
import { deletionIdentity, deletionStatus, DeletionError } from '@/lib/account-deletion-server'
export const runtime = 'nodejs'
export async function GET(request: Request) {
  try {
    return NextResponse.json(await deletionStatus(await deletionIdentity(request)),{headers:{'Cache-Control':'no-store'}})
  } catch (error) {
    const e = error instanceof DeletionError ? error : new DeletionError('STATUS_UNAVAILABLE')
    return NextResponse.json({error:e.code},{status:e.status,headers:{'Cache-Control':'no-store'}})
  }
}
