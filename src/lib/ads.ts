// A8net 広告設定
// 広告を追加する際はここにエントリを追記してください
// 使い方: <AdBanner id="キー名" />

export const ADS = {
  gomicale_468x60: {
    href: 'https://px.a8.net/svt/ejp?a8mat=4AZES5+BFZZEA+3EMG+1HLVB5',
    image: {
      src: 'https://www25.a8.net/svt/bgt?aid=260312981692&wid=001&eno=01&mid=s00000015892009004000&mc=1',
      width: 468,
      height: 60,
    },
    tracking: {
      src: 'https://www15.a8.net/0.gif?a8mat=4AZES5+BFZZEA+3EMG+1HLVB5',
    },
  },
  new_300x250: {
    href: 'https://px.a8.net/svt/ejp?a8mat=4AZES5+BDM8Z6+5KW8+5YZ75',
    image: {
      src: 'https://www23.a8.net/svt/bgt?aid=260312981688&wid=001&eno=01&mid=s00000026036001003000&mc=1',
      width: 300,
      height: 250,
    },
    tracking: {
      src: 'https://www14.a8.net/0.gif?a8mat=4AZES5+BDM8Z6+5KW8+5YZ75',
    },
  },
  tall_120x600: {
    href: 'https://px.a8.net/svt/ejp?a8mat=4AZES4+CKHGJ6+36X8+15RK35',
    image: {
      src: 'https://www23.a8.net/svt/bgt?aid=260312980760&wid=001&eno=01&mid=s00000014894007015000&mc=1',
      width: 120,
      height: 600,
    },
    tracking: {
      src: 'https://www16.a8.net/0.gif?a8mat=4AZES4+CKHGJ6+36X8+15RK35',
    },
  },
} as const

export type AdId = keyof typeof ADS
