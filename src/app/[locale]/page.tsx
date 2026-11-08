import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getBlogList } from '@/lib/microcms'
import { LandingPage } from '@/components/LandingPage'
import { LandingPageStaticContent } from '@/components/LandingPageStaticContent'
import { JsonLd } from '@/components/JsonLd'

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
  name: 'PDF・写真・画像の予定表をGoogleカレンダーに自動登録・インポートする方法',
  description: 'ゴミ出しカレンダー、シフト表、行事予定表などのPDFや写真・画像をアップロードするだけで、AIがスケジュールを解析し、Googleカレンダーに一括登録・インポートする無料ツールの使い方。',
  totalTime: 'PT1M',
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'PDF・写真・画像をアップロードしてインポート開始',
      text: 'Googleアカウントでログイン後、ゴミ出しカレンダーやシフト表などのPDFや写真・画像ファイルをドラッグ＆ドロップ、またはファイル選択でアップロードします。スマートフォンで撮影した写真もそのまま使えます。',
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'AIがスケジュールとルールを自動解析・変換',
      text: 'AIがPDFや写真・画像内の日付、曜日、予定を自動で読み取り、カレンダー形式に変換します。「第1・第3水曜はペットボトル」などの複雑なルールも正確に抽出してスケジュール化します。',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Googleカレンダーに一括自動登録',
      text: '解析・変換された予定データがGoogleカレンダーに一括で自動登録されます。手入力の手間なく、スマートフォン等のカレンダーアプリで予定を確認できるようになります。',
    },
  ],
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ゴミカレ',
  url: 'https://gomicale.jp',
  description: 'PDFや写真・画像のゴミ出しカレンダー、シフト表、行事予定表などをAIが解析し、Googleカレンダーに一括自動登録・インポートする無料スケジュール変換サービス。',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://gomicale.jp/ja/blog?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ゴミカレ',
  url: 'https://gomicale.jp',
  logo: {
    '@type': 'ImageObject',
    url: 'https://gomicale.jp/icon.png',
    width: 144,
    height: 144,
  },
  sameAs: [],
}

export default async function RootPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  const accountDeleted = (await searchParams).accountDeleted === '1'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect(`/${locale}/dashboard`)
  }

  let blogPosts: Awaited<ReturnType<typeof getBlogList>>['contents'] = []
  try {
    const data = await getBlogList({ limit: 9 })
    blogPosts = data.contents
  } catch {
    // MicroCMS not configured or error — blog section will be hidden
  }

  return (
    <>
      {accountDeleted && <div role="status" className="border-b border-teal-200 bg-teal-50 px-4 py-4 text-center text-sm font-medium text-teal-900">{locale==='en' ? 'Your account has been deleted. Events already in Google Calendar remain available.' : '退会が完了しました。Googleカレンダーに登録済みの予定は引き続きご利用いただけます。'}</div>}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <JsonLd data={websiteJsonLd} />
      <JsonLd data={organizationJsonLd} />
      <LandingPage />
      <LandingPageStaticContent blogPosts={blogPosts} />
    </>
  )
}
