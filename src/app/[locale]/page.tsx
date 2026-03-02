import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/LandingPage'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ja: '/ja',
        en: '/en',
      },
    },
  }
}

const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'PDFの予定表をGoogleカレンダーに自動登録・インポートする方法',
  description: 'ゴミ出しカレンダー、シフト表、行事予定表などのPDFをアップロードするだけで、AIがスケジュールを解析し、Googleカレンダーに一括登録・インポートする無料ツールの使い方。',
  totalTime: 'PT1M',
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'PDFをアップロードしてインポート開始',
      text: 'Googleアカウントでログイン後、ゴミ出しカレンダーやシフト表などのPDFをドラッグ＆ドロップ、またはファイル選択でアップロードします。これでインポート準備が完了します。',
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'AIがスケジュールとルールを自動解析・変換',
      text: 'AIがPDF内の日付、曜日、予定を自動で読み取り、カレンダー形式に変換します。「第1・第3水曜はペットボトル」などの複雑なルールも正確に抽出してスケジュール化します。',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Googleカレンダーに一括自動登録',
      text: '解析・変換された予定データがGoogleカレンダーに一括で自動登録されます。手入力の手間なく、スマートフォン等のカレンダーアプリで予定を確認できるようになります。',
    },
  ],
}

export default async function RootPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect(`/${locale}/dashboard`)
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <LandingPage />
    </>
  )
}
