import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { Analytics } from '@vercel/analytics/next'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://gomicale.jp'),
  title: {
    default: 'PDFの予定をGoogleカレンダーに自動登録・インポート | ゴミカレ',
    template: '%s | ゴミカレ',
  },
  description:
    'PDFのゴミ出しカレンダー、シフト表、行事予定表などをAIが解析し、Googleカレンダーに一括自動登録・インポート。手入力の手間をゼロにする無料スケジュール変換サービスです。',
  keywords: [
    'PDF', 'Googleカレンダー', 'カレンダー登録', '自動登録', 'インポート', '取り込み', '変換', 'スケジュール',
    'ゴミ出しカレンダー', '予定表', 'シフト表', 'AI解析', '予定抽出',
  ],
  authors: [{ name: 'ゴミカレ' }],
  icons: {
    icon: [
      { url: '/icon.png', sizes: '144x144', type: 'image/png' },
      { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: 'https://gomicale.jp',
    title: 'PDFの予定をGoogleカレンダーに自動登録・インポート | ゴミカレ',
    description:
      'PDFのゴミ出しカレンダー、シフト表、行事予定表などをAIが解析し、Googleカレンダーに一括自動登録・インポート。手入力の手間をゼロにする無料スケジュール変換サービスです。',
    siteName: 'ゴミカレ',
    images: [
      {
        url: 'https://gomicale.jp/oba_loading.png',
        width: 1200,
        height: 630,
        alt: 'PDFの予定をGoogleカレンダーに自動登録・インポート | ゴミカレ',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PDFの予定をGoogleカレンダーに自動登録・インポート | ゴミカレ',
    description:
      'PDFのゴミ出しカレンダー、シフト表、行事予定表などをAIが解析し、Googleカレンダーに一括自動登録・インポート。手入力の手間をゼロにする無料スケジュール変換サービスです。',
    images: ['https://gomicale.jp/oba_loading.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  other: { 'google-adsense-account': 'ca-pub-6348441325859182' },
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ゴミカレ',
    operatingSystem: 'Web',
    applicationCategory: 'ProductivityApplication',
    description:
      'PDFのゴミ出しカレンダー、シフト表、行事予定表などをAIが解析し、Googleカレンダーに一括自動登録・インポートする無料スケジュール変換サービス。',
    url: 'https://gomicale.jp',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
  }

  return (
    <html lang={locale}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${geist.className} bg-gray-50 text-gray-900 antialiased`}>
        <NextIntlClientProvider>
          {children}
        </NextIntlClientProvider>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6348441325859182"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <Analytics />
      </body>
    </html>
  )
}
