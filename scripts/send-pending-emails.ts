/**
 * pending ジョブのユーザーへ手動で再アップロード依頼メールを送るスクリプト。
 *
 * 対象: created_at が 1 時間以上前で status = 'pending' のジョブ
 *
 * 使い方:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... RESEND_API_KEY=... \
 *   npx tsx scripts/send-pending-emails.ts
 *
 * ドライラン（送信せず対象一覧だけ確認）:
 *   DRY_RUN=true SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... RESEND_API_KEY=... \
 *   npx tsx scripts/send-pending-emails.ts
 */

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.APP_FROM_EMAIL ?? 'ゴミカレ <onboarding@resend.dev>'
const APP_URL = process.env.APP_URL ?? 'https://gomicale.jp'
const DRY_RUN = process.env.DRY_RUN === 'true'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を環境変数に設定してください。')
  process.exit(1)
}
if (!RESEND_API_KEY && !DRY_RUN) {
  console.error('RESEND_API_KEY を環境変数に設定してください。（DRY_RUN=true の場合は不要）')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function sendRetryEmail(toEmail: string): Promise<void> {
  const resend = new Resend(RESEND_API_KEY!)
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: '「ゴミカレ」- アップロードが中断されました',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0d9488;margin-bottom:8px">アップロードが完了しませんでした</h2>
        <p style="color:#374151;margin-bottom:16px">
          処理の実行中にブラウザやタブを閉じた可能性があり、PDFファイルのアップロードが完了しませんでした。<br>
          お手数ですがもう一度アップロードをお願い致します。
        </p>
        <div style="text-align:center;margin-top:24px">
          <a href="${APP_URL}"
             style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:bold">
            再度アップロードする
          </a>
        </div>
        <p style="color:#9ca3af;font-size:12px;margin-top:32px">ゴミカレ</p>
      </div>
    `,
  })
  if (error) {
    throw new Error(`Resend エラー: ${JSON.stringify(error)}`)
  }
}

async function main() {
  console.log(`[設定] DRY_RUN=${DRY_RUN}  FROM=${FROM_EMAIL}`)

  const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, user_id, created_at')
    .eq('status', 'pending')
    .lt('created_at', threshold)

  if (jobsError) {
    console.error('jobs 取得エラー:', jobsError.message)
    process.exit(1)
  }

  if (!jobs || jobs.length === 0) {
    console.log('対象の pending ジョブはありませんでした。')
    return
  }

  console.log(`対象ジョブ数: ${jobs.length}`)

  // user_id の重複排除（同一ユーザーに複数 pending がある場合でも 1 通だけ送る）
  const seenUsers = new Set<string>()
  let sent = 0
  let skipped = 0

  for (const job of jobs) {
    const userId = job.user_id as string

    if (seenUsers.has(userId)) {
      console.log(`  [SKIP] job=${job.id} user=${userId} (同ユーザーへは送送済み)`)
      skipped++
      continue
    }
    seenUsers.add(userId)

    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId)

    if (userError || !user?.email) {
      console.log(`  [SKIP] job=${job.id} user=${userId} (メールアドレス取得不可)`)
      skipped++
      continue
    }

    const email = user.email
    console.log(`  [TARGET] job=${job.id}  user=${userId}  email=${email}  created_at=${job.created_at}`)

    if (DRY_RUN) {
      console.log(`  [DRY_RUN] スキップ（実際には送信しません）`)
      continue
    }

    try {
      await sendRetryEmail(email)
      console.log(`  [SENT] -> ${email}`)
      sent++
    } catch (err) {
      console.error(`  [ERROR] -> ${email}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log(`\n完了: 送信=${sent}  スキップ=${skipped}  DRY_RUN=${DRY_RUN}`)
}

main().catch((err) => {
  console.error('予期しないエラー:', err)
  process.exit(1)
})
