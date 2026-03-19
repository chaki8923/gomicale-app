import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { Analytics } from '@vercel/analytics/next'
import { SoftwareApplicationJsonLd } from '@/components/JsonLd'

const geist = Geist({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

const sharedMetadata: Partial<Metadata> = {
  metadataBase: new URL('https://gomicale.jp'),
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GomiCale',
  },
  icons: {
    icon: [
      { url: '/icon.png', sizes: '144x144', type: 'image/png' },
      { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
    ],
    apple: [
      { url: '/icon-180.png', sizes: '180x180', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
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
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  if (locale === 'en') {
    const title = 'Import PDF Schedules to Google Calendar Automatically | GomiCale'
    const description =
      'Upload your Japan garbage collection PDF, shift schedule, or event calendar. AI reads the PDF and bulk-imports all events to Google Calendar for free.'
    return {
      ...sharedMetadata,
      title: {
        default: title,
        template: '%s | GomiCale',
      },
      description,
      keywords: [
        'Japan garbage separation guide',
        'Japan garbage collection calendar',
        'Tokyo garbage disposal',
        'PDF to Google Calendar',
        'Japan waste sorting app',
        'Japan trash schedule',
        'bulky waste disposal Japan',
        'large trash pickup Japan',
        'garbage sorting guide Japan',
        'Japan recycling schedule',
        'PDF schedule importer',
        'Google Calendar import Japan',
      ],
      authors: [{ name: 'GomiCale' }],
      openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://gomicale.jp/en',
        title,
        description,
        siteName: 'GomiCale',
        images: [
          {
            url: 'https://gomicale.jp/oba_loading.png',
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: ['https://gomicale.jp/oba_loading.png'],
      },
    }
  }

  const title = 'PDFの予定をGoogleカレンダーに自動登録・インポート | ゴミカレ'
  const description =
    'PDFのゴミ出しカレンダー、シフト表、行事予定表などをAIが解析し、Googleカレンダーに一括自動登録・インポート。手入力の手間をゼロにする無料スケジュール変換サービスです。'
  return {
    ...sharedMetadata,
    title: {
      default: title,
      template: '%s | ゴミカレ',
    },
    description,
    keywords: [
      'PDF', 'Googleカレンダー', 'カレンダー登録', '自動登録', 'インポート', '取り込み', '変換', 'スケジュール',
      'ゴミ出しカレンダー', '予定表', 'シフト表', 'AI解析', '予定抽出',
    ],
    authors: [{ name: 'ゴミカレ' }],
    openGraph: {
      type: 'website',
      locale: 'ja_JP',
      url: 'https://gomicale.jp',
      title,
      description,
      siteName: 'ゴミカレ',
      images: [
        {
          url: 'https://gomicale.jp/oba_loading.png',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://gomicale.jp/oba_loading.png'],
    },
  }
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

  return (
    <html lang={locale}>
      <head>
        <SoftwareApplicationJsonLd locale={locale} />
      </head>
      <body className={`${geist.className} bg-gray-50 text-gray-900 antialiased`}>
        <NextIntlClientProvider>
          {children}
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
