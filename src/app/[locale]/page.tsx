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
  name: 'PDFをGoogleカレンダーに自動登録する方法',
  description: 'ゴミ出しカレンダーや予定表のPDFをアップロードするだけで、AIが解析してGoogleカレンダーに一括登録するサービスの使い方。',
  totalTime: 'PT1M',
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'PDFをアップロード',
      text: 'Googleアカウントでログイン後、ゴミ出しカレンダーや予定表のPDFをドラッグ＆ドロップ、またはファイル選択でアップロードします。',
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'AIが自動で解析',
      text: 'AIがPDF内の日付と予定を自動で読み取ります。「第1・第3水曜はペットボトル」などの複雑なルールも正確に抽出します。',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Googleカレンダーに自動登録',
      text: '解析した予定がGoogleカレンダーに一括で自動登録されます。ゴミ出し当日の朝にリマインダー通知も届きます。',
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
