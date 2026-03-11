/**
 * JSON-LD構造化データ（Schema.org）を<script type="application/ld+json">として埋め込むコンポーネント群。
 * AI OverviewやGoogleリッチリザルト向けに各ページで使用する。
 */

// ────────────────────────────────────────────────────────────
// 汎用ラッパー
// ────────────────────────────────────────────────────────────

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

// ────────────────────────────────────────────────────────────
// SoftwareApplication スキーマ（LP・全体レイアウト向け）
// ────────────────────────────────────────────────────────────

export function SoftwareApplicationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ゴミカレ',
    operatingSystem: 'Web, iOS, Android',
    applicationCategory: 'ProductivityApplication',
    description:
      'PDFのゴミ出しカレンダー、シフト表、行事予定表などをAIが解析し、Googleカレンダーに一括自動登録・インポートする無料スケジュール変換サービス。LINE Botでゴミ分別を写真で確認する機能も搭載。',
    url: 'https://gomicale.jp',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
    featureList: [
      'PDFから予定を自動抽出',
      'Googleカレンダーへの一括登録',
      'LINE Botでゴミ分別確認',
      '複雑なルール（隔週・第N週など）の解析対応',
      '多言語対応（日本語・英語）',
    ],
    screenshot: 'https://gomicale.jp/oba_loading.png',
    author: {
      '@type': 'Organization',
      name: 'ゴミカレ',
      url: 'https://gomicale.jp',
    },
  }
  return <JsonLd data={data} />
}

// ────────────────────────────────────────────────────────────
// Article スキーマ（ブログ記事詳細ページ向け）
// ────────────────────────────────────────────────────────────

export interface ArticleJsonLdProps {
  headline: string
  description: string
  datePublished: string
  dateModified: string
  imageUrl?: string
  articleId: string
  locale: string
}

export function ArticleJsonLd({
  headline,
  description,
  datePublished,
  dateModified,
  imageUrl,
  articleId,
  locale,
}: ArticleJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    datePublished,
    dateModified,
    author: {
      '@type': 'Organization',
      name: 'ゴミカレ',
      url: 'https://gomicale.jp',
    },
    publisher: {
      '@type': 'Organization',
      name: 'ゴミカレ',
      logo: {
        '@type': 'ImageObject',
        url: 'https://gomicale.jp/icon.png',
        width: 144,
        height: 144,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://gomicale.jp/${locale}/blog/${articleId}`,
    },
    ...(imageUrl && {
      image: {
        '@type': 'ImageObject',
        url: imageUrl,
      },
    }),
  }
  return <JsonLd data={data} />
}

// ────────────────────────────────────────────────────────────
// FAQPage スキーマ（ブログ記事のFAQセクション向け）
// ────────────────────────────────────────────────────────────

export interface FaqItem {
  question: string
  answer: string
}

export function FaqJsonLd({ items }: { items: FaqItem[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
  return <JsonLd data={data} />
}

// ────────────────────────────────────────────────────────────
// BreadcrumbList スキーマ（パンくずリスト向け）
// ────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  name: string
  item: string
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.item,
    })),
  }
  return <JsonLd data={data} />
}

// ────────────────────────────────────────────────────────────
// ItemList スキーマ（ブログ一覧ページ向け）
// ────────────────────────────────────────────────────────────

export interface BlogListItem {
  id: string
  title: string
  locale: string
}

export function BlogListJsonLd({ posts, locale }: { posts: BlogListItem[]; locale: string }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'ゴミカレ ブログ記事一覧',
    description: 'PDFのGoogleカレンダー取り込みやゴミ出しカレンダーの活用方法など、役立つ情報をお届けするゴミカレ公式ブログ。',
    url: `https://gomicale.jp/${locale}/blog`,
    itemListElement: posts.map((post, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: post.title,
      url: `https://gomicale.jp/${locale}/blog/${post.id}`,
    })),
  }
  return <JsonLd data={data} />
}
