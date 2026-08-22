'use client'

// Chat list pane for the console (plan doc
// plans/active/reasoning-pipeline/29-console-multi-chat.md's "File splits
// this forces" + its UI section). Renders the branch-indented tree, the row
// menu (Rename · Branch · Delete), and the "Recently deleted" disclosure.
// State/CRUD lives one level up in useConsoleChats.ts — this file is
// rendering + the one piece of presentation-only logic doc 29 asks for
// ("Branch children indent one level under their parent regardless of real
// depth; deeper chains show 'branched from …' instead of nesting further"),
// which is UI grouping, not a data-model rule, so it stays local here rather
// than in lib/ai/console.ts's DB-independent, unit-tested helpers.

import { useState } from 'react'
import type { ChatSummary } from '@/lib/ai/console'
import { MAX_ACTIVE_CHATS_PER_HOUSE } from '@/lib/ai/console'
import type { DeletedListLoadState } from './useConsoleChats'

function chatLabel(title: string): string {
  return title.trim().length > 0 ? title : 'Untitled chat'
}

interface SidebarRow {
  chat: ChatSummary
  indent: 0 | 1
  // Direct parent's title, shown as "branched from …" — only set on an
  // indented row, and always the REAL direct parent even when that parent
  // is itself several forks deep (doc 29: "deeper chains show 'branched
  // from …' instead of nesting further").
  parentTitle: string | null
}

// Two-tier grouping: every root-origin chat (or one whose parent isn't in
// the active set — soft-deleted/edge case) starts a cluster; every other
// chat is placed under its cluster's root, at a single indent, regardless of
// how many real fork hops separate it from that root.
function buildSidebarRows(chats: ChatSummary[]): SidebarRow[] {
  const byId = new Map(chats.map((c) => [c.id, c]))

  function rootOf(chat: ChatSummary): ChatSummary {
    let current = chat
    const seen = new Set<string>()
    while (current.parentChatId && byId.has(current.parentChatId) && !seen.has(current.id)) {
      seen.add(current.id)
      current = byId.get(current.parentChatId)!
    }
    return current
  }

  const byLastMessageDesc = (a: ChatSummary, b: ChatSummary) =>
    new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()

  const roots = chats.filter((c) => c.parentChatId === null || !byId.has(c.parentChatId)).sort(byLastMessageDesc)

  const rows: SidebarRow[] = []
  for (const root of roots) {
    rows.push({ chat: root, indent: 0, parentTitle: null })
    const descendants = chats
      .filter((c) => c.id !== root.id && rootOf(c).id === root.id)
      .sort(byLastMessageDesc)
    for (const chat of descendants) {
      const parent = chat.parentChatId ? (byId.get(chat.parentChatId) ?? null) : null
      rows.push({ chat, indent: 1, parentTitle: parent ? chatLabel(parent.title) : null })
    }
  }
  return rows
}

export function ChatSidebar({
  chats,
  selectedChatId,
  onSelect,
  onCreateNew,
  onBranchChat,
  onRename,
  onDelete,
  deletedChats,
  deletedLoadState,
  onOpenDeleted,
  onRestore,
  creating,
}: {
  chats: ChatSummary[]
  selectedChatId: string | null
  onSelect: (chatId: string) => void
  onCreateNew: () => void
  onBranchChat: (chatId: string) => void
  onRename: (chatId: string, title: string) => void
  onDelete: (chatId: string) => void
  deletedChats: ChatSummary[]
  deletedLoadState: DeletedListLoadState
  onOpenDeleted: () => void
  onRestore: (chatId: string) => void
  creating: boolean
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [deletedOpen, setDeletedOpen] = useState(false)

  const atCap = chats.length >= MAX_ACTIVE_CHATS_PER_HOUSE
  const rows = buildSidebarRows(chats)

  function startRename(chat: ChatSummary) {
    setOpenMenuId(null)
    setRenamingId(chat.id)
    setRenameDraft(chatLabel(chat.title))
  }

  function commitRename(chatId: string) {
    const title = renameDraft.trim()
    setRenamingId(null)
    if (title.length > 0) onRename(chatId, title)
  }

  function handleDelete(chat: ChatSummary) {
    setOpenMenuId(null)
    const ok = window.confirm(
      `Delete "${chatLabel(chat.title)}"? It moves to Recently deleted and can be restored — any chats branched from it stay put.`
    )
    if (ok) onDelete(chat.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--rule)' }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', letterSpacing: '0.04em' }}>
          Chats · {chats.length}/{MAX_ACTIVE_CHATS_PER_HOUSE}
        </span>
        <button
          type="button"
          onClick={onCreateNew}
          disabled={atCap || creating}
          title={atCap ? `${MAX_ACTIVE_CHATS_PER_HOUSE} active chats — delete one to add another` : 'New chat'}
          style={{
            fontWeight: 600,
            fontSize: 11.5,
            color: atCap ? 'var(--ink-subtle)' : 'var(--ink)',
            background: 'var(--white)',
            border: '1px solid var(--rule)',
            borderRadius: 6,
            padding: '4px 9px',
            cursor: atCap || creating ? 'default' : 'pointer',
            opacity: creating ? 0.6 : 1,
          }}
        >
          + New
        </button>
      </div>

      <div className="build-scroll" style={{ flex: '1 1 auto', overflowY: 'auto', padding: '6px 8px' }}>
        {rows.map(({ chat, indent, parentTitle }) => {
          const active = chat.id === selectedChatId
          const renaming = renamingId === chat.id
          return (
            <div key={chat.id} style={{ position: 'relative', marginLeft: indent * 14, marginBottom: 2 }}>
              {renaming ? (
                <div style={{ display: 'flex', gap: 6, padding: '6px 8px' }}>
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value.slice(0, 120))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(chat.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    style={{ flex: 1, minWidth: 0, fontSize: 12.5, padding: '4px 6px', border: '1px solid var(--ink)', borderRadius: 5, outline: 'none' }}
                  />
                  <button type="button" onClick={() => commitRename(chat.id)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Save
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: 7,
                    background: active ? 'var(--amber-tint)' : 'transparent',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(chat.id)}
                    style={{
                      flex: '1 1 auto',
                      minWidth: 0,
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '7px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: active ? 600 : 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {chatLabel(chat.title)}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-subtle)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {parentTitle ? `branched from ${parentTitle}` : `${chat.turnCount} turn${chat.turnCount === 1 ? '' : 's'}`}
                      {chat.stale ? ' · stale' : ''}
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={`${chatLabel(chat.title)} options`}
                    onClick={() => setOpenMenuId((id) => (id === chat.id ? null : chat.id))}
                    style={{ flex: '0 0 auto', width: 24, height: 24, color: 'var(--ink-subtle)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
                  >
                    ⋯
                  </button>
                </div>
              )}

              {openMenuId === chat.id && (
                <div
                  className="pop"
                  style={{
                    position: 'absolute',
                    right: 4,
                    top: '100%',
                    zIndex: 5,
                    background: 'var(--white)',
                    border: '1px solid var(--rule)',
                    borderRadius: 8,
                    boxShadow: '0 6px 18px rgba(20,33,58,0.14)',
                    minWidth: 120,
                    padding: 4,
                  }}
                >
                  {[
                    { label: 'Rename', onClick: () => startRename(chat) },
                    { label: 'Branch', onClick: () => { setOpenMenuId(null); onBranchChat(chat.id) } },
                    { label: 'Delete', onClick: () => handleDelete(chat) },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, color: 'var(--ink)', background: 'none', border: 'none', borderRadius: 5, padding: '6px 8px', cursor: 'pointer' }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {rows.length === 0 && (
          <div style={{ padding: '14px 10px', fontSize: 12, color: 'var(--ink-subtle)', lineHeight: 1.5 }}>
            No chats yet — send a message to start one.
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--rule)' }}>
        <button
          type="button"
          onClick={() => {
            setDeletedOpen((open) => {
              const next = !open
              if (next && deletedLoadState === 'idle') onOpenDeleted()
              return next
            })
          }}
          className="mono"
          style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 10.5, color: 'var(--ink-subtle)', letterSpacing: '0.03em', background: 'none', border: 'none', padding: '10px 14px', cursor: 'pointer' }}
        >
          {deletedOpen ? '▾' : '▸'} Recently deleted
        </button>
        {deletedOpen && (
          <div style={{ maxHeight: 180, overflowY: 'auto', padding: '0 10px 10px' }}>
            {deletedLoadState === 'loading' && <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', padding: '4px 4px' }}>Loading…</div>}
            {deletedLoadState === 'error' && <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', padding: '4px 4px' }}>Couldn&apos;t load.</div>}
            {deletedLoadState === 'loaded' && deletedChats.length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--ink-subtle)', padding: '4px 4px' }}>Nothing deleted.</div>
            )}
            {deletedChats.map((chat) => (
              <div key={chat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 4px' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {chatLabel(chat.title)}
                </span>
                <button
                  type="button"
                  onClick={() => onRestore(chat.id)}
                  style={{ flex: '0 0 auto', fontSize: 11, fontWeight: 600, color: 'var(--blueprint)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
