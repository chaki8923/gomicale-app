/**
 * ゴミの種別タイトルに対して適切な絵文字プレフィックスを返す
 * キーワードマッチングのみ（API呼び出しなし・純粋関数）
 */

const EMOJI_RULES: { keywords: string[]; emoji: string }[] = [
  // 「non-burnable」が「burnable」を含むため、不燃を先に判定する
  {
    keywords: ['もやさないごみ', '燃えないごみ', '燃えないゴミ', '不燃ごみ', '不燃ゴミ', '燃やせないごみ', '燃やせないゴミ',
               'non-burnable', 'non burnable', 'incombustible', 'non-combustible'],
    emoji: '🗑️',
  },
  {
    keywords: ['もやすごみ', '燃えるごみ', '燃えるゴミ', '可燃ごみ', '可燃ゴミ', '燃やせるごみ', '燃やせるゴミ',
               'burnable', 'combustible'],
    emoji: '🔥',
  },
  {
    keywords: ['プラスチック', 'プラごみ', 'プラゴミ', 'プラ',
               'plastic', 'plastics'],
    emoji: '♻️',
  },
  // 「PET Bottles」が「bottles」を含むため、PETボトルを先に判定する
  {
    keywords: ['ペットボトル',
               'pet bottle', 'pet bottles'],
    emoji: '🍼',
  },
  {
    keywords: ['缶', 'かん', 'カン',
               'can', 'cans', 'cans & bottles', 'metal'],
    emoji: '🥫',
  },
  {
    keywords: ['ビン', '瓶', 'びん',
               'bottle', 'bottles', 'glass'],
    emoji: '🍶',
  },
  {
    keywords: ['段ボール', 'ダンボール', 'だんぼーる',
               'cardboard', 'carton'],
    emoji: '📦',
  },
  {
    keywords: ['古紙', '紙類', 'こうし',
               'paper', 'newspaper', 'waste paper', 'rags', 'waste paper & rags'],
    emoji: '📰',
  },
  {
    keywords: ['小型家電', '家電',
               'small appliance', 'small appliances', 'electronics'],
    emoji: '📱',
  },
  {
    keywords: ['粗大ごみ', '粗大ゴミ', '粗大',
               'bulky', 'oversized', 'large item', 'large waste'],
    emoji: '🪑',
  },
  {
    keywords: ['資源ごみ', '資源ゴミ', '資源',
               'recyclable', 'recycling', 'resource'],
    emoji: '♻️',
  },
  {
    keywords: ['布', '衣類', '繊維',
               'cloth', 'clothing', 'textile', 'fabric', 'apparel'],
    emoji: '👕',
  },
  {
    keywords: ['電池', '乾電池',
               'battery', 'batteries'],
    emoji: '🔋',
  },
  {
    keywords: ['蛍光灯', '蛍光管',
               'fluorescent', 'light bulb', 'bulb'],
    emoji: '💡',
  },
  {
    keywords: ['食品トレー', 'トレー', 'トレイ',
               'tray', 'food tray', 'styrofoam'],
    emoji: '🍱',
  },
]

/**
 * タイトルに対して絵文字プレフィックスを付与して返す
 * マッチしない場合は絵文字なしのまま返す
 */
export function addEmojiToTitle(title: string): string {
  const lower = title.toLowerCase()
  for (const rule of EMOJI_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return `${rule.emoji} ${title}`
    }
  }
  return title
}
