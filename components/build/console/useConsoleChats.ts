'use client'

// Chat list state + CRUD for the console's chat sidebar (plan doc
// plans/active/reasoning-pipeline/29-console-multi-chat.md's "File splits
// this forces"). Talks to app/api/houses/[id]/console/chats and
// .../chats/[chatId]. Every mutation (create/rename/delete/restore) re-fetches
// the active list afterward rather than patching local state optimistically —
// turnCount and stale are computed server-side and a house has at most
// MAX_ACTIVE_CHATS_PER_HOUSE of these, so a refetch is cheap and keeps the
// sidebar authoritative instead of risking drift from a hand-rolled patch.

import { useCallback, useEffect, useState } from 'react'
import type { ChatSummary, CreateChatRequest } from '@/lib/ai/console'

export type ChatListLoadState = 'loading' | 'loaded' | 'error'
export type DeletedListLoadState = 'idle' | 'loading' | 'loaded' | 'error'

export interface CreateChatResult {
  ok: boolean
  chat?: ChatSummary
  error?: string
}

export interface UseConsoleChats {
  chats: ChatSummary[]
  loadState: ChatListLoadState
  deletedChats: ChatSummary[]
  deletedLoadState: DeletedListLoadState
  loadDeleted: () => void
  refresh: () => void
  createChat: (body: CreateChatRequest) => Promise<CreateChatResult>
  renameChat: (chatId: string, title: string) => Promise<boolean>
  deleteChat: (chatId: string) => Promise<boolean>
  restoreChat: (chatId: string) => Promise<boolean>
}

export function useConsoleChats(houseId: string): UseConsoleChats {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [loadState, setLoadState] = useState<ChatListLoadState>('loading')
  const [deletedChats, setDeletedChats] = useState<ChatSummary[]>([])
  const [deletedLoadState, setDeletedLoadState] = useState<DeletedListLoadState>('idle')

  const refresh = useCallback(() => {
    let active = true
    setLoadState((s) => (s === 'loaded' ? 'loaded' : 'loading'))
    fetch(`/api/houses/${houseId}/console/chats`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { chats: ChatSummary[] }) => {
        if (!active) return
        setChats(data.chats)
        setLoadState('loaded')
      })
      .catch(() => {
        if (active) setLoadState('error')
      })
    return () => {
      active = false
    }
  }, [houseId])

  useEffect(() => refresh(), [refresh])

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
        refresh()
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
        if (res.ok) refresh()
        return res.ok
      } catch {
        return false
      }
    },
    [houseId, refresh]
  )

  const deleteChat = useCallback(
    async (chatId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/houses/${houseId}/console/chats/${chatId}`, { method: 'DELETE' })
        if (res.ok) refresh()
        return res.ok
      } catch {
        return false
      }
    },
    [houseId, refresh]
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
          refresh()
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
