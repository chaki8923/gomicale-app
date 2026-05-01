'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { InquiryPost, InquiryReply } from '@/types/database'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? ''

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

function sortPosts(list: PostWithReplies[]): PostWithReplies[] {
  return [...list].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))
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
          const incoming = payload.new as InquiryPost
          setPosts((prev) => {
            // 楽観的更新で既に追加済みの場合はスキップ
            if (prev.some((p) => p.id === incoming.id)) return prev
            return sortPosts([{ ...incoming, replies: [] }, ...prev])
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inquiry_replies' },
        (payload) => {
          const incoming = payload.new as InquiryReply
          setPosts((prev) => {
            // 楽観的更新で既に追加済みの場合はスキップ
            const alreadyExists = prev.some((p) =>
              p.replies.some((r) => r.id === incoming.id),
            )
            if (alreadyExists) return prev
            return sortPosts(
              prev.map((p) =>
                p.id === incoming.post_id
                  ? { ...p, replies: [...p.replies, incoming] }
                  : p,
              ),
            )
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleSubmitPost = useCallback(async () => {
    const trimmed = newContent.trim()
    if (!trimmed) { setSubmitError(t('errorEmpty')); return }
    if (trimmed.length > 2000) { setSubmitError(t('errorTooLong')); return }

    setIsSubmitting(true)
    setSubmitError(null)
    const supabase = getSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsSubmitting(false); return }

    const { data: inserted, error } = await supabase
      .from('inquiry_posts')
      .insert({ user_id: user.id, content: trimmed })
      .select()
      .single()

    setIsSubmitting(false)
    if (error) {
      setSubmitError(t('errorSubmit'))
    } else {
      setNewContent('')
      if (inserted) {
        const newPost: PostWithReplies = { ...inserted, replies: [] }
        setPosts((prev) => sortPosts([newPost, ...prev]))
      }
    }
  }, [newContent, t])

  const handleSubmitReply = useCallback(async (postId: string) => {
    const trimmed = replyContent.trim()
    if (!trimmed) return
    if (trimmed.length > 2000) return

    setIsReplySubmitting(true)
    const supabase = getSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsReplySubmitting(false); return }

    const { data: inserted, error } = await supabase
      .from('inquiry_replies')
      .insert({ post_id: postId, admin_user_id: user.id, content: trimmed })
      .select()
      .single()

    setIsReplySubmitting(false)
    if (!error) {
      setReplyContent('')
      setReplyOpenId(null)
      if (inserted) {
        setPosts((prev) =>
          sortPosts(
            prev.map((p) =>
              p.id === postId
                ? { ...p, replies: [...p.replies, inserted] }
                : p,
            ),
          ),
        )
      }
    }
  }, [replyContent])

  return (
    <>
      {/* ふわふわアニメーション用スタイル */}
      <style>{`
        @keyframes inquiry-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        .inquiry-float {
          animation: inquiry-float 3s ease-in-out infinite;
        }
      `}</style>

      {/* フローティングボタン */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={{ animationPlayState: isOpen ? 'paused' : 'running' }}
        className="inquiry-float fixed bottom-4 right-4 z-40 flex items-center gap-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold cursor-pointer transition-colors duration-200 shadow-xl
          p-3.5 rounded-2xl
          sm:px-5 sm:py-3.5 sm:rounded-2xl"
        aria-label={t('title')}
      >
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm">{t('buttonLabel')}</span>
          <span className="text-xs font-normal opacity-90">{t('subtitle')}</span>
        </div>
      </button>

      {/* オーバーレイ（モバイル） */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* パネル本体 */}
      <div
        className={`
          fixed z-50 bg-white shadow-2xl flex flex-col
          transition-transform duration-300 ease-in-out
          bottom-0 left-0 right-0 h-[88vh] rounded-t-2xl
          sm:bottom-0 sm:right-0 sm:left-auto sm:top-0 sm:h-screen sm:w-[420px] sm:rounded-none sm:rounded-l-2xl
          ${isOpen ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full'}
        `}
      >
        {/* ヘッダー */}
        <div className="flex-shrink-0 bg-teal-600 px-5 py-4 rounded-t-2xl sm:rounded-tl-2xl sm:rounded-tr-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white leading-snug">{t('title')}</h2>
              <p className="text-xs text-teal-100 mt-0.5">{t('subtitle')}</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-teal-700 cursor-pointer transition flex-shrink-0"
              aria-label={t('close')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* スレッドリスト */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-3xl mb-3">📣</p>
              <p className="text-sm text-gray-500 whitespace-pre-line">{t('noPostsYet')}</p>
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
                  <div className="border-t border-teal-100 bg-teal-50 px-4 py-3 space-y-3">
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
                          className="w-full text-sm text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
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
        <div className="flex-shrink-0 border-t border-gray-100 px-4 py-4 space-y-2 bg-white">
          {submitError && (
            <p className="text-xs text-red-500">{submitError}</p>
          )}
          <textarea
            value={newContent}
            onChange={(e) => { setNewContent(e.target.value); setSubmitError(null) }}
            placeholder={t('placeholder')}
            rows={3}
            maxLength={2000}
            className="w-full text-sm text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{newContent.length}/2000</span>
            <button
              onClick={handleSubmitPost}
              disabled={isSubmitting || !newContent.trim()}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 px-5 py-2.5 rounded-xl cursor-pointer transition shadow-sm"
            >
              {isSubmitting ? t('submitting') : t('submit')}
              {!isSubmitting && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
