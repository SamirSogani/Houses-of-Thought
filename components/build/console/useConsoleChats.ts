'use client'

// Chat list state + CRUD for the console's chat sidebar (plan doc
// plans/active/reasoning-pipeline/29-console-multi-chat.md's "File splits
// this forces"). Talks to app/api/houses/[id]/console/chats and
// .../chats/[chatId]. Every mutation (create/rename/delete/restore) re-fetches
// the active list afterward rather than patching local state optimistically —
// turnCount and stale are computed server-side and a house has at most
// MAX_ACTIVE_CHATS_PER_HOUSE of these, so a refetch is cheap and keeps the
// sidebar authoritative instead of risking drift from a hand-rolled patch.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatSummary, CreateChatRequest } from '@/lib/ai/console'

export type ChatListLoadState = 'loading' | 'loaded' | 'error'
export type DeletedListLoadState = 'idle' | 'loading' | 'loaded' | 'error'

export interface CreateChatResult {
  ok: boolean
  chat?: ChatSummary
  error?: string
}

// deleteChat hands back the list as it stands AFTER the delete, because its
// caller has to decide which chat to show next and cannot read that off
// `chats` state — the refetch this same call triggers hasn't written it yet.
// Reading the stale list there is what made a deleted chat re-select itself
// and look like the delete had silently failed.
export interface DeleteChatResult {
  ok: boolean
  chats: ChatSummary[] | null
}

export interface UseConsoleChats {
  chats: ChatSummary[]
  loadState: ChatListLoadState
  deletedChats: ChatSummary[]
  deletedLoadState: DeletedListLoadState
  loadDeleted: () => void
  refresh: () => Promise<ChatSummary[] | null>
  createChat: (body: CreateChatRequest) => Promise<CreateChatResult>
  renameChat: (chatId: string, title: string) => Promise<boolean>
  deleteChat: (chatId: string) => Promise<DeleteChatResult>
  restoreChat: (chatId: string) => Promise<boolean>
}

export function useConsoleChats(houseId: string): UseConsoleChats {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [loadState, setLoadState] = useState<ChatListLoadState>('loading')
  const [deletedChats, setDeletedChats] = useState<ChatSummary[]>([])
  const [deletedLoadState, setDeletedLoadState] = useState<DeletedListLoadState>('idle')
  // Replaces the old per-call `active` flag: refresh() is now awaited by its
  // callers, so the guard has to outlive one invocation.
  //
  // It MUST be re-armed on mount, not just disarmed on unmount. React's dev
  // StrictMode mounts, cleans up, then mounts again; a ref that is only ever
  // set to false stays false for the rest of the page's life, and every
  // later refresh() then fetches successfully and returns without writing
  // state — the chat list silently stays empty and loadState never leaves
  // 'loading'.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Resolves with the freshly-loaded list as well as writing it to state, so
  // a mutation that must act on what REMAINS (deleteChat below) can await the
  // real answer instead of racing its own setState.
  const refresh = useCallback(async (): Promise<ChatSummary[] | null> => {
    setLoadState((s) => (s === 'loaded' ? 'loaded' : 'loading'))
    try {
      const res = await fetch(`/api/houses/${houseId}/console/chats`)
      if (!res.ok) throw new Error('chat list load failed')
      const data = (await res.json()) as { chats: ChatSummary[] }
      if (!mountedRef.current) return data.chats
      setChats(data.chats)
      setLoadState('loaded')
      return data.chats
    } catch {
      if (mountedRef.current) setLoadState('error')
      return null
    }
  }, [houseId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadDeleted = useCallback(() => {
    setDeletedLoadState('loading')
    fetch(`/api/houses/${houseId}/console/chats?deleted=true`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { chats: ChatSummary[] }) => {
        setDeletedChats(data.chats)
        setDeletedLoadState('loaded')
      })
      .catch(() => setDeletedLoadState('error'))
  }, [houseId])

  const createChat = useCallback(
    async (body: CreateChatRequest): Promise<CreateChatResult> => {
      try {
        const res = await fetch(`/api/houses/${houseId}/console/chats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string }
          return { ok: false, error: errBody.error ?? 'server-error' }
        }
        const { chat } = (await res.json()) as { chat: ChatSummary }
        void refresh()
        return { ok: true, chat }
      } catch {
        return { ok: false, error: 'network-error' }
      }
    },
    [houseId, refresh]
  )

  const renameChat = useCallback(
    async (chatId: string, title: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/houses/${houseId}/console/chats/${chatId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        })
        if (res.ok) void refresh()
        return res.ok
      } catch {
        return false
      }
    },
    [houseId, refresh]
  )

  const deleteChat = useCallback(
    async (chatId: string): Promise<DeleteChatResult> => {
      try {
        const res = await fetch(`/api/houses/${houseId}/console/chats/${chatId}`, { method: 'DELETE' })
        if (!res.ok) return { ok: false, chats: null }
        const remaining = await refresh()
        // The just-deleted chat now belongs in "Recently deleted" — reload
        // that list if it has ever been opened, or an already-loaded
        // disclosure keeps showing a stale set the new deletion is missing
        // from. Mirrors restoreChat's own reload, for the same reason.
        if (deletedLoadState === 'loaded') loadDeleted()
        return { ok: true, chats: remaining }
      } catch {
        return { ok: false, chats: null }
      }
    },
    [houseId, refresh, deletedLoadState, loadDeleted]
  )

  const restoreChat = useCallback(
    async (chatId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/houses/${houseId}/console/chats/${chatId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deletedAt: null }),
        })
        if (res.ok) {
          void refresh()
          // The restored chat leaves "Recently deleted" — reload it too so
          // the disclosure doesn't keep showing a chat that's active again.
          if (deletedLoadState === 'loaded') loadDeleted()
        }
        return res.ok
      } catch {
        return false
      }
    },
    [houseId, refresh, deletedLoadState, loadDeleted]
  )

  return { chats, loadState, deletedChats, deletedLoadState, loadDeleted, refresh, createChat, renameChat, deleteChat, restoreChat }
}
