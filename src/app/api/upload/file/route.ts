import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import type { Job } from '@/types/database'

// R2 クライアント（直接 SDK でアップロード）
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// POST /api/upload/file
// ブラウザから PDF を直接受け取り、サーバー経由で R2 にアップロードする
// （ブラウザ → R2 の直接アップロードでは CORS が問題になるため、このエンドポイントを経由する）
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // multipart/form-data または application/pdf を受け付ける
  const contentType = request.headers.get('content-type') ?? ''

  let fileBuffer: ArrayBuffer
  let fileSize: number

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'file field is required' }, { status: 400 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    }
    fileBuffer = await file.arrayBuffer()
    fileSize = file.size
  } else {
    // application/pdf として直接 body を受け取る
    fileBuffer = await request.arrayBuffer()
    fileSize = fileBuffer.byteLength
  }

  if (fileSize === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  }
  if (fileSize > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
  }

  const fileId = randomUUID()
  const objectKey = `uploads/${user.id}/${fileId}.pdf`

  // R2 にアップロード（サーバー → R2 は同一ネットワーク内なので CORS 不要）
  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: objectKey,
      Body: Buffer.from(fileBuffer),
      ContentType: 'application/pdf',
    }),
  )

  // jobs テーブルに pending レコードを作成
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      user_id: user.id,
      status: 'pending' as const,
      r2_object_key: objectKey,
    })
    .select()
    .single()

  if (jobError || !job) {
    console.error('[upload/file] insert job error:', jobError)
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }

  return NextResponse.json({ jobId: (job as Job).id, objectKey })
}
