'use client'

import { useEffect, useState } from 'react'

type ApiKey = {
  id: string
  name: string | null
  last_used_at: string | null
  created_at: string
}

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchKeys = async () => {
    const res = await fetch('/api/keys')
    if (res.ok) {
      const data = await res.json() as { keys: ApiKey[] }
      setKeys(data.keys)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    setNewKeyValue(null)
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName.trim() || null }),
    })
    const data = await res.json() as { key?: string; error?: string }
    if (!res.ok || !data.key) {
      setError(data.error ?? 'エラーが発生しました')
    } else {
      setNewKeyValue(data.key)
      setNewKeyName('')
      await fetchKeys()
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このAPIキーを削除しますか？削除すると復元できません。')) return
    await fetch(`/api/keys/${id}`, { method: 'DELETE' })
    setKeys((prev) => prev.filter((k) => k.id !== id))
  }

  const handleCopy = () => {
    if (!newKeyValue) return
    navigator.clipboard.writeText(newKeyValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900">外部連携用 API キー</h2>
        <p className="text-xs text-gray-500 mt-1">
          API キーを使って、LINEやスクリプトから直接ゴミ分類機能を呼び出せます。
        </p>
      </div>

      {/* 新規キー発行フォーム */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="キーの名前（例: LINE用）"
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          maxLength={50}
        />
        <button
          onClick={handleCreate}
          disabled={creating}
          className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-40 transition"
        >
          {creating ? '発行中...' : '発行'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* 新しく発行されたキーの表示 */}
      {newKeyValue && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
          <p className="text-xs font-bold text-amber-700">
            ⚠️ このキーは今後表示されません。必ずコピーして安全な場所に保管してください。
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 block rounded-lg bg-white border border-amber-200 px-3 py-2 text-xs font-mono text-gray-800 break-all">
              {newKeyValue}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition"
            >
              {copied ? 'コピー済' : 'コピー'}
            </button>
          </div>
          <p className="text-xs text-amber-600">
            使い方: <code className="bg-amber-100 px-1 rounded">Authorization: Bearer {newKeyValue.slice(0, 12)}...</code> ヘッダーを付けて <code className="bg-amber-100 px-1 rounded">POST /api/classify</code> を呼び出してください。
          </p>
        </div>
      )}

      {/* キー一覧 */}
      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-gray-400">APIキーはまだありません</p>
      ) : (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">{k.name ?? '名称なし'}</p>
                <p className="text-xs text-gray-400">
                  作成: {new Date(k.created_at).toLocaleDateString('ja-JP')}
                  {k.last_used_at && (
                    <> &nbsp;/&nbsp; 最終使用: {new Date(k.last_used_at).toLocaleDateString('ja-JP')}</>
                  )}
                </p>
              </div>
              <button
                onClick={() => handleDelete(k.id)}
                className="text-xs text-red-400 hover:text-red-600 transition"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
