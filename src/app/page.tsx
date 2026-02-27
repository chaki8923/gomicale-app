import { redirect } from 'next/navigation'

// next-intl ミドルウェアが / → /ja/ にリダイレクトするが
// 万が一ここに到達した場合のフォールバック
export default function Page() {
  redirect('/ja')
}
