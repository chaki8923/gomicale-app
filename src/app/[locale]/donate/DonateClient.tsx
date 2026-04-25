'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const AMOUNTS = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500]

export function DonateClient() {
  const [selected, setSelected] = useState<number>(100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDonate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/donate/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selected }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'エラーが発生しました')
      }
      router.push(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">金額を選択してください</p>
        <div className="grid grid-cols-5 gap-2">
          {AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => setSelected(amount)}
              className={`py-2 px-1 rounded-lg text-sm font-semibold border transition-all ${
                selected === amount
                  ? 'bg-teal-500 border-teal-500 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-teal-300 hover:text-teal-600'
              }`}
            >
              ¥{amount}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-teal-50 rounded-xl p-4 text-center">
        <p className="text-sm text-gray-600">選択中の金額</p>
        <p className="text-2xl font-bold text-teal-600 mt-1">¥{selected}</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      <button
        onClick={handleDonate}
        disabled={loading}
        className="w-full py-3 bg-teal-500 hover:bg-teal-600 disabled:bg-teal-300 text-white font-bold rounded-xl transition-colors text-base"
      >
        {loading ? '処理中...' : `¥${selected} 寄付する`}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Stripe の安全な決済ページに移動します。<br />
        クレジットカード・デビットカードがご利用いただけます。
      </p>
    </div>
  )
}
