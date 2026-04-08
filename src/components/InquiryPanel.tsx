'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { InquiryPost, InquiryReply } from '@/types/database'

const ADMIN_EMAIL = 'REDACTED'

type PostWithReplies = InquiryPost & { replies: InquiryReply[] }

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

function lastActivity(post: PostWithReplies): string {
  if (post.replies.length === 0) return post.created_at
  const latest = post.replies.reduce((a, b) =>
    a.created_at > b.created_at ? a : b,
  )
  return latest.created_at > post.created_at ? latest.created_at : post.created_at
}

interface InquiryPanelProps {
  userEmail: string
}

export function InquiryPanel({ userEmail }: InquiryPanelProps) {
  const t = useTranslations('inquiry')
  const isAdmin = userEmail === ADMIN_EMAIL

  const [isOpen, setIsOpen] = useState(false)
  const [posts, setPosts] = useState<PostWithReplies[]>([])
  const [newContent, setNewContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [isReplySubmitting, setIsReplySubmitting] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // 初回データ取得 + Realtime購読
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const fetchAll = async () => {
      const { data: postRows } = await supabase
        .from('inquiry_posts')
        .select('*')
        .order('created_at', { ascending: false })

      const { data: replyRows } = await supabase
        .from('inquiry_replies')
        .select('*')
        .order('created_at', { ascending: true })

      if (!postRows) return
      const withReplies: PostWithReplies[] = postRows.map((p) => ({
        ...p,
        replies: (replyRows ?? []).filter((r) => r.post_id === p.id),
      }))
      setPosts(sortPosts(withReplies))
    }

    fetchAll()

    const channel = supabase
      .channel('inquiry-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inquiry_posts' },
        (payload) => {
          const newPost = { ...(payload.new as InquiryPost), replies: [] }
          setPosts((prev) => sortPosts([newPost, ...prev]))
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inquiry_replies' },
        (payload) => {
          const newReply = payload.new as InquiryReply
          setPosts((prev) =>
            sortPosts(
              prev.map((p) =>
                p.id === newReply.post_id
                  ? { ...p, replies: [...p.replies, newReply] }
                  : p,
              ),
            ),
          )
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const sortPosts = (list: PostWithReplies[]): PostWithReplies[] =>
    [...list].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))

  const handleSubmitPost = useCallback(async () => {
    const trimmed = newContent.trim()
    if (!trimmed) { setSubmitError(t('errorEmpty')); return }
    if (trimmed.length > 2000) { setSubmitError(t('errorTooLong')); return }

    setIsSubmitting(true)
    setSubmitError(null)
    const supabase = getSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsSubmitting(false); return }

    const { error } = await supabase.from('inquiry_posts').insert({
      user_id: user.id,
      content: trimmed,
    })

    setIsSubmitting(false)
    if (error) {
      setSubmitError(t('errorSubmit'))
    } else {
      setNewContent('')
    }
  }, [newContent, t])

  const handleSubmitReply = useCallback(async (postId: string) => {
    const trimmed = replyContent.trim()
    if (!trimmed) return
    if (trimmed.length > 2000) { return }

    setIsReplySubmitting(true)
    const supabase = getSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsReplySubmitting(false); return }

    const { error } = await supabase.from('inquiry_replies').insert({
      post_id: postId,
      admin_user_id: user.id,
      content: trimmed,
    })

    setIsReplySubmitting(false)
    if (!error) {
      setReplyContent('')
      setReplyOpenId(null)
    }
  }, [replyContent])

  const unreadCount = posts.length

  return (
    <>
      {/* フローティングボタン */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-sm font-semibold px-4 py-3 rounded-full shadow-lg cursor-pointer transition-all duration-200"
        aria-label={t('title')}
      >
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <span className="hidden sm:inline">{t('title')}</span>
        {unreadCount > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* オーバーレイ（モバイル） */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* パネル本体 */}
      <div
        className={`
          fixed z-50 bg-white shadow-2xl flex flex-col
          transition-transform duration-300 ease-in-out
          /* モバイル: 下からシート */
          bottom-0 left-0 right-0 h-[85vh] rounded-t-2xl
          sm:bottom-0 sm:right-0 sm:left-auto sm:top-0 sm:h-screen sm:w-[400px] sm:rounded-none sm:rounded-l-2xl
          ${isOpen ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full'}
        `}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <h2 className="text-base font-bold text-gray-900">{t('title')}</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition"
            aria-label={t('close')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* スレッドリスト */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {posts.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-12 whitespace-pre-line">
              {t('noPostsYet')}
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                {/* 投稿本体 */}
                <div className="px-4 pt-4 pb-3">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                    {post.content}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">{formatJST(post.created_at)}</p>
                </div>

                {/* 返信一覧 */}
                {post.replies.length > 0 && (
                  <div className="border-t border-gray-200 bg-teal-50 px-4 py-3 space-y-3">
                    {post.replies.map((reply) => (
                      <div key={reply.id}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-semibold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                            {t('adminLabel')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                          {reply.content}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{formatJST(reply.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 管理者向け返信フォーム */}
                {isAdmin && (
                  <div className="border-t border-gray-200 px-4 py-3">
                    {replyOpenId === post.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder={t('replyPlaceholder')}
                          rows={3}
                          maxLength={2000}
                          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => { setReplyOpenId(null); setReplyContent('') }}
                            className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer transition px-3 py-1.5 rounded-lg hover:bg-gray-100"
                          >
                            {t('replyCancel')}
                          </button>
                          <button
                            onClick={() => handleSubmitReply(post.id)}
                            disabled={isReplySubmitting || !replyContent.trim()}
                            className="text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-3 py-1.5 rounded-lg cursor-pointer transition"
                          >
                            {isReplySubmitting ? '...' : t('replySubmit')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setReplyOpenId(post.id); setReplyContent('') }}
                        className="text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer transition"
                      >
                        {t('replyToggle')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 投稿フォーム */}
        <div className="flex-shrink-0 border-t border-gray-100 px-4 py-4 space-y-2">
          {submitError && (
            <p className="text-xs text-red-500">{submitError}</p>
          )}
          <textarea
            value={newContent}
            onChange={(e) => { setNewContent(e.target.value); setSubmitError(null) }}
            placeholder={t('placeholder')}
            rows={3}
            maxLength={2000}
            className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{newContent.length}/2000</span>
            <button
              onClick={handleSubmitPost}
              disabled={isSubmitting || !newContent.trim()}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 px-4 py-2 rounded-xl cursor-pointer transition"
            >
              {isSubmitting ? t('submitting') : t('submit')}
              {!isSubmitting && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
