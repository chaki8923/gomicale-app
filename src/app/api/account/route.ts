import { NextResponse, after } from 'next/server'
import { claimDeletion, createDeletionReceipt, DELETION_COOKIE, deletionIdentity, DeletionError, runAccountDeletion } from '@/lib/account-deletion-server'

export const runtime = 'nodejs'
export const maxDuration = 60
export async function DELETE(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new DeletionError('FORBIDDEN',403)
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json') throw new DeletionError('INVALID_REQUEST',400)
    const raw = await request.text()
    if (Buffer.byteLength(raw)>1024) throw new DeletionError('INVALID_REQUEST',400)
    const body = JSON.parse(raw)
    if (!body || body.confirm !== true || typeof body.expectedAccountId!=='string' || Object.keys(body).some(k=>!['confirm','expectedAccountId'].includes(k))) throw new DeletionError('INVALID_REQUEST',400)
    const identity = await deletionIdentity(request)
    if (identity.userId!==body.expectedAccountId) throw new DeletionError('ACCOUNT_CHANGED',409)
    const { row, token } = await claimDeletion(identity.userId,identity.operationId)
    const response = NextResponse.json({ state:'deleting' },{status:202,headers:{'Cache-Control':'no-store'}})
    if (row) {
      response.cookies.set(DELETION_COOKIE,createDeletionReceipt(row.user_id,row.operation_id),{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'strict',path:'/api/account',maxAge:7*86400})
      after(()=>runAccountDeletion(row,token))
    }
    return response
  } catch (error) {
    const e = error instanceof DeletionError ? error : error instanceof SyntaxError ? new DeletionError('INVALID_REQUEST',400) : new DeletionError('DELETE_START_FAILED')
    return NextResponse.json({error:e.code},{status:e.status})
  }
}
