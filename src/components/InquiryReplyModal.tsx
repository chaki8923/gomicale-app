'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export type UnreadReply = {
  replyId: string
  replyContent: string
  replyCreatedAt: string
  postContent: string
  postId: string
}

interface InquiryReplyModalProps {
  unreadReplies: UnreadReply[]
  userId: string
  onClose: () => void
}

function formatJST(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function InquiryReplyModal({ unreadReplies, userId, onClose }: InquiryReplyModalProps) {
  const t = useTranslations('inquiryReplyModal')
  const [isConfirming, setIsConfirming] = useState(false)

  const handleConfirm = async () => {
    setIsConfirming(true)
    const supabase = getSupabaseBrowserClient()
    await supabase.from('inquiry_reply_reads').upsert({
      user_id: userId,
      last_read_at: new Date().toISOString(),
    })
    setIsConfirming(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-teal-600 px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center mt-0.5">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-snug">{t('title')}</h2>
              <p className="text-xs text-teal-100 mt-0.5">{t('subtitle')}</p>
            </div>
          </div>
        </div>

        {/* 返信一覧 */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {unreadReplies.map((item) => (
            <div key={item.replyId} className="rounded-xl border border-gray-200 overflow-hidden">
              {/* 元の投稿 */}
              <div className="bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">{t('yourPost')}</p>
                <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap break-words">
                  {item.postContent}
                </p>
              </div>
              {/* 運営の返信 */}
              <div className="bg-teal-50 border-t border-teal-100 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                    {t('adminReply')}
                  </span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                  {item.replyContent}
                </p>
                <p className="text-xs text-gray-400 mt-1.5">{formatJST(item.replyCreatedAt)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="px-6 pb-5 border-t border-gray-100 pt-4">
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="w-full py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 rounded-xl cursor-pointer transition"
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
