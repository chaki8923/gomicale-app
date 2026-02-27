import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://gomicale.jp'),
  title: {
    default: 'ゴミカレ | PDFからGoogleカレンダーへ自動登録',
    template: '%s | ゴミカレ',
  },
  description:
    'PDFのゴミ出しカレンダーや予定表をAIが解析し、Googleカレンダーに一括自動登録。手入力の手間をゼロにする無料サービスです。「PDFからカレンダー登録」をたった1分で実現。',
  keywords: [
    'PDF', 'Googleカレンダー', 'カレンダー登録', '自動登録',
    'ゴミ出しカレンダー', '予定表', 'AI解析', '予定抽出',
  ],
  authors: [{ name: 'ゴミカレ' }],
  icons: { icon: '/favicon.ico' },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: 'https://gomicale.jp',
    title: 'ゴミカレ | PDFからGoogleカレンダーへ自動登録',
    description:
      'PDFのゴミ出しカレンダーや予定表をAIが解析し、Googleカレンダーに一括自動登録。手入力の手間をゼロにする無料サービスです。',
    siteName: 'ゴミカレ',
    images: [
      {
        url: 'https://gomicale.jp/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ゴミカレ - PDFからGoogleカレンダーへ自動登録',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ゴミカレ | PDFからGoogleカレンダーへ自動登録',
    description:
      'PDFのゴミ出しカレンダーや予定表をAIが解析し、Googleカレンダーに一括自動登録。手入力の手間をゼロにする無料サービスです。',
    images: ['https://gomicale.jp/og-image.png'],
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
  alternates: { canonical: 'https://gomicale.jp' },
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

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound()
  }

  const messages = await getMessages()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ゴミカレ',
    operatingSystem: 'Web',
    applicationCategory: 'ProductivityApplication',
    description:
      'PDFのゴミ出しカレンダーや予定表をAIが解析し、Googleカレンダーに一括自動登録する無料サービス。',
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
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6348441325859182"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
