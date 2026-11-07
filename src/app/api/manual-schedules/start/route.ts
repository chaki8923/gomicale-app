import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireImportUser, startAnalysis, ImportError, importErrorResponse, readImportJson } from '@/lib/calendar-import-server'
function getCurrentFiscalYearRange() {
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const year = nowJst.getUTCFullYear()
  const month = nowJst.getUTCMonth() + 1
  const fiscalStartYear = month >= 4 ? year : year - 1
  return {
    fiscalYearStart: `${fiscalStartYear}-04-01`,
    fiscalYearEnd: `${fiscalStartYear + 1}-03-31`,
  }
}

export async function POST(request: NextRequest) {
 try {
  const { user, db: supabase } = await requireImportUser()
  const body = await readImportJson(request)
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : ''
  if (!instruction || instruction.length > 2000) throw new ImportError('INVALID_INSTRUCTION')
  // 1日の実行回数チェック（PDFアップロードと同じ扱い、JST基準、エラー除く）
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const todayJstMidnight = new Date(
    Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate()) - 9 * 60 * 60 * 1000,
  )
  const { count: uploadCount } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('status', 'error')
    .gte('created_at', todayJstMidnight.toISOString())

  if ((uploadCount ?? 0) >= 5) {
    return NextResponse.json({ error: 'limit_exceeded', message: '1日の登録上限（5回）に達しました。明日またお試しください。' }, { status: 429 })
  }

  const jobObjectKey = `manual/${user.id}/${randomUUID()}.json`
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      user_id: user.id,
      status: 'pending' as const,
      r2_object_key: jobObjectKey,
      parser_mode: 'garbage',
      pdf_title: body.language === 'en' ? 'Manual: garbage collection rules' : '手入力: ゴミ収集ルール',
    })
    .select()
    .single()

  if (jobError || !job) {
    console.error('[manual-schedules/start] insert job error:', jobError)
    return NextResponse.json({ error: 'failed_to_create_job', message: 'ジョブの作成に失敗しました。' }, { status: 500 })
  }


  await startAnalysis(user.id, job, body, { inputMode: 'manual', manualInstruction: instruction, ...getCurrentFiscalYearRange() })
  return NextResponse.json({ jobId: job.id, status: 'processing' })
 } catch (error) { return importErrorResponse(error) }
}
