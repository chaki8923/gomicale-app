// 自治体別 粗大ゴミ収集申し込みページ（代表的な自治体のみ掲載）
// ユーザーの自治体が不明な場合は検索URLにフォールバック

export type MunicipalityLink = {
  name: string
  url: string
}

export const MAJOR_MUNICIPALITY_LINKS: MunicipalityLink[] = [
  { name: '東京都（23区共通）', url: 'https://www.sodaigomi.com/' },
  { name: '横浜市', url: 'https://www.city.yokohama.lg.jp/kurashi/sumai-kurashi/gomi-recycle/sodaigomi/' },
  { name: '大阪市', url: 'https://www.city.osaka.lg.jp/kankyo/category/2507-2-0-0-0-0-0-0-0-0.html' },
  { name: '名古屋市', url: 'https://www.city.nagoya.jp/kankyo/category/3-5-0-0-0-0-0-0-0-0.html' },
  { name: '札幌市', url: 'https://www.city.sapporo.jp/seiso/sodai/' },
  { name: '福岡市', url: 'https://www.city.fukuoka.lg.jp/kankyo/haiki/life/sodaigomi.html' },
  { name: '仙台市', url: 'https://www.city.sendai.jp/haiki-shori/kurashi/shizen/gomi/sodai/index.html' },
  { name: '川崎市', url: 'https://www.city.kawasaki.jp/300/page/0000029736.html' },
  { name: '京都市', url: 'https://www.city.kyoto.lg.jp/kankyo/page/0000033489.html' },
  { name: '神戸市', url: 'https://www.city.kobe.lg.jp/a17064/kurashi/recycle/gomi/sodai/index.html' },
]

/** 自治体名で検索するための Google 検索 URL を生成 */
export function getSodaiGomiSearchUrl(locale: string): string {
  if (locale === 'en') {
    return 'https://www.google.com/search?q=bulky+waste+collection+appointment+japan+municipality'
  }
  return 'https://www.google.com/search?q=粗大ごみ+収集+予約+申し込み+自治体'
}
