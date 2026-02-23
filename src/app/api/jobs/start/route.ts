import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from '@aws-sdk/client-lambda'
import type { Job } from '@/types/database'

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION ?? 'ap-northeast-1',
  credentials: {
    accessKeyId:     process.env.AWS_LAMBDA_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_LAMBDA_SECRET_ACCESS_KEY!,
  },
})

// POST /api/jobs/start
// R2 アップロード完了後に呼ばれる。Lambda を非同期で invoke する。
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { jobId: string; parserMode?: string }
  if (!body.jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
  }

  // job が自分のものかを確認
  const { data: jobData, error: jobError } = await supabase
    .from('jobs')
    .select('id, user_id, status, r2_object_key')
    .eq('id', body.jobId)
    .eq('user_id', user.id)
    .single()

  if (jobError || !jobData) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const job = jobData as Job

  if (job.status !== 'pending') {
    return NextResponse.json({ error: 'Job is not in pending state' }, { status: 409 })
  }

  // status を processing に更新
  await supabase
    .from('jobs')
    .update({ status: 'processing' as const })
    .eq('id', job.id)

  // Lambda を非同期 (Event) で呼び出す（レスポンスを待たない）
  const payload = JSON.stringify({
    jobId:       job.id,
    userId:      user.id,
    r2ObjectKey: job.r2_object_key,
    parserMode:  body.parserMode ?? 'garbage',
  })

  await lambdaClient.send(
    new InvokeCommand({
      FunctionName:   process.env.LAMBDA_FUNCTION_NAME!,
      InvocationType: InvocationType.Event,
      Payload:        Buffer.from(payload),
    }),
  )

  return NextResponse.json({ jobId: job.id, status: 'processing' })
}
