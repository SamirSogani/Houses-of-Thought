// Seed data for the "Your Houses" dashboard. No backend yet; this is the source of
// truth for the dashboard grid. Progress is measured against the 7 layers of the
// Build a House flow (see lib/build), so the dashboard and the workspace stay coherent.

export type HouseStatus = 'empty' | 'in-progress' | 'complete'

export interface HouseSummary {
  id: string
  title: string | null // null = untitled
  question: string | null // null = no question set yet
  layersComplete: number // 0..7
  status: HouseStatus
  editedLabel: string
}

export const TOTAL_LAYERS = 7

export function housePercent(h: HouseSummary): number {
  return Math.round((h.layersComplete / TOTAL_LAYERS) * 100)
}

export const statusMeta: Record<HouseStatus, { label: string; color: string; bg: string }> = {
  empty: { label: 'Empty', color: 'var(--ink-subtle)', bg: 'var(--parchment)' },
  'in-progress': { label: 'In progress', color: 'var(--amber-hover)', bg: 'var(--amber-tint)' },
  complete: { label: 'Complete', color: 'var(--green-strong)', bg: 'rgba(63,143,91,0.12)' },
}

export const houses: HouseSummary[] = [
  {
    id: 'ai-schools',
    title: 'Should AI be used in schools?',
    question: 'Should AI be used in schools?',
    layersComplete: 6,
    status: 'in-progress',
    editedLabel: 'Edited 2d ago',
  },
  {
    id: 'career',
    title: 'My First House: Choosing a Career',
    question: 'Which career path best fits my strengths, values, and long-term goals?',
    layersComplete: 7,
    status: 'complete',
    editedLabel: 'Edited Jun 6',
  },
  {
    id: 'untitled-1',
    title: null,
    question: null,
    layersComplete: 0,
    status: 'empty',
    editedLabel: 'Edited 6d ago',
  },
  {
    id: 'untitled-2',
    title: null,
    question: null,
    layersComplete: 0,
    status: 'empty',
    editedLabel: 'Edited 6d ago',
  },
  {
    id: 'untitled-3',
    title: null,
    question: null,
    layersComplete: 0,
    status: 'empty',
    editedLabel: 'Edited 6d ago',
  },
]
