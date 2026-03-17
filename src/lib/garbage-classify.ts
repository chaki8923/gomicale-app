import type { getSupabaseServiceClient } from '@/lib/supabase/server'

export type StreakInfo = {
  current_streak: number
  longest_streak: number
  total_classifications: number
}

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>

// ============================================================
// 粗大ゴミ判定
// ============================================================

const SODAI_KEYWORDS = ['粗大', 'bulky', 'large waste', 'oversized', '判定不可', 'unclassifiable']

/**
 * 分類カテゴリと収集日数からこの品目が粗大ゴミ / 特別対応が必要かを判定する。
 * - カテゴリに粗大ゴミ関連キーワードが含まれる
 * - nextDates が空（判定不可・収集不可アイテム）
 * のどちらかを満たせば true。
 */
export function detectSodaiGomi(category: string, nextDatesCount: number): boolean {
  const lower = category.toLowerCase()
  return (
    SODAI_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase())) || nextDatesCount === 0
  )
}

// ============================================================
// JST 日付ユーティリティ
// ============================================================

/** JST の今日の日付文字列 (YYYY-MM-DD) */
export function getTodayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** JST の昨日の日付文字列 (YYYY-MM-DD) */
export function getYesterdayJST(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// ============================================================
// ストリーク更新
// ============================================================

/**
 * ゴミ分類が成功した際に user_streaks テーブルを更新し、最新のストリーク情報を返す。
 * - 今日すでに分類済み: streak 変化なし、total_classifications のみ加算
 * - 昨日から連続: current_streak + 1
 * - それ以外（途切れた）: current_streak を 1 にリセット
 */
export async function updateUserStreak(
  serviceClient: ServiceClient,
  userId: string
): Promise<StreakInfo> {
  const todayJST = getTodayJST()
  const yesterdayJST = getYesterdayJST()

  const { data: current } = await serviceClient
    .from('user_streaks')
    .select('current_streak, longest_streak, last_active_date, total_classifications')
    .eq('user_id', userId)
    .single()

  if (!current) {
    await serviceClient.from('user_streaks').insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_active_date: todayJST,
      total_classifications: 1,
    })
    return { current_streak: 1, longest_streak: 1, total_classifications: 1 }
  }

  let newCurrentStreak: number
  if (current.last_active_date === todayJST) {
    newCurrentStreak = current.current_streak
  } else if (current.last_active_date === yesterdayJST) {
    newCurrentStreak = current.current_streak + 1
  } else {
    newCurrentStreak = 1
  }

  const newLongest = Math.max(current.longest_streak, newCurrentStreak)
  const newTotal = current.total_classifications + 1

  await serviceClient
    .from('user_streaks')
    .update({
      current_streak: newCurrentStreak,
      longest_streak: newLongest,
      last_active_date: todayJST,
      total_classifications: newTotal,
    })
    .eq('user_id', userId)

  return {
    current_streak: newCurrentStreak,
    longest_streak: newLongest,
    total_classifications: newTotal,
  }
}

// ============================================================
// SNS シェアテキスト生成
// ============================================================

type ShareTextOptions = {
  itemName?: string
  category: string
  nextDate?: string
  locale?: string
}

/**
 * 分類結果から X (Twitter) シェア用テキストと URL を生成する。
 * LINE でも Web でも同じロジックが使えるよう locale を受け取る。
 */
export function buildXShareUrl(options: ShareTextOptions): string {
  const { itemName, category, nextDate, locale = 'ja' } = options
  const item = itemName || category

  let text: string
  if (locale === 'en') {
    text = `"${item}" → ${category}!🗑️${nextDate ? ` Next: ${nextDate}` : ''}\n#GomiCale https://gomicale.jp`
  } else {
    text = `「${item}」は${category}！🗑️${nextDate ? ` 次の収集日：${nextDate}` : ''}\n#ゴミカレ https://gomicale.jp`
  }

  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`
}
