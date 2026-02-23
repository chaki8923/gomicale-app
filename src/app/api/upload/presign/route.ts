import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { createPresignedUploadUrl } from '@/lib/r2'
import { randomUUID } from 'crypto'
import type { Job } from '@/types/database'

// POST /api/upload/presign
// R2 へのアップロード用 Presigned URL を発行し、jobs テーブルにレコードを作成する
export async function POST(_request: NextRequest) {
  const supabase = await getSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const fileId = randomUUID()
  const { uploadUrl, objectKey } = await createPresignedUploadUrl(user.id, fileId)

  // jobs テーブルに pending レコードを作成
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      user_id:       user.id,
      status:        'pending' as const,
      r2_object_key: objectKey,
    })
    .select()
    .single()

  if (jobError || !job) {
    console.error('[presign] insert job error:', jobError)
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }

  return NextResponse.json({ uploadUrl, objectKey, jobId: (job as Job).id })
}
