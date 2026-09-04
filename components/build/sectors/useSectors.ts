// Hook for managing sector deep-dive state in BuildHousePage. Handles loading
// existing sectors, triggering generation, and tracking active sector view.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SectorType, SectorRow } from '@/lib/sectors/types'

export interface SectorsState {
  /** All loaded sector rows, keyed by type */
  sectors: Partial<Record<SectorType, SectorRow>>
  /** Which sector view is currently open (null = normal house view) */
  activeSector: SectorType | null
  /** Whether a generation is in progress */
  generating: SectorType | null
  /** Open a sector view — generates if none exists */
  openSector: (type: SectorType) => void
  /** Close the sector view and return to the house */
  closeSector: () => void
  /** Regenerate a sector analysis */
  regenerate: (type: SectorType) => void
}

export function useSectors(houseId: string | undefined): SectorsState {
  const [sectors, setSectors] = useState<Partial<Record<SectorType, SectorRow>>>({})
  const [activeSector, setActiveSector] = useState<SectorType | null>(null)
  const [generating, setGenerating] = useState<SectorType | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load existing sectors on mount.
  useEffect(() => {
    if (!houseId) return
    const supabase = createClient()
    supabase
      .from('house_sectors')
      .select('*')
      .eq('house_id', houseId)
      .then(({ data }) => {
        if (!data) return
        const map: Partial<Record<SectorType, SectorRow>> = {}
        for (const row of data as SectorRow[]) {
          map[row.sector_type] = row
        }
        setSectors(map)
      })
  }, [houseId])

  const generate = useCallback(
    async (type: SectorType) => {
      if (!houseId || generating) return
      // Abort any previous generation.
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setGenerating(type)

      try {
        const res = await fetch(`/api/houses/${houseId}/sectors/${type}`, {
          method: 'POST',
          signal: controller.signal,
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          const errRow: SectorRow = {
            id: '',
            house_id: houseId,
            sector_type: type,
            status: 'failed',
            analysis: null,
            findings: null,
            error: (body as { error?: string }).error ?? `Generation failed (${res.status})`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          setSectors((prev) => ({ ...prev, [type]: errRow }))
          return
        }
        const { sector } = (await res.json()) as { sector: SectorRow }
        setSectors((prev) => ({ ...prev, [type]: sector }))
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        const errRow: SectorRow = {
          id: '',
          house_id: houseId,
          sector_type: type,
          status: 'failed',
          analysis: null,
          findings: null,
          error: (err as Error).message,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setSectors((prev) => ({ ...prev, [type]: errRow }))
      } finally {
        setGenerating(null)
      }
    },
    [houseId, generating]
  )

  const openSector = useCallback(
    (type: SectorType) => {
      setActiveSector(type)
      const existing = sectors[type]
      if (!existing || existing.status === 'failed') {
        void generate(type)
      }
    },
    [sectors, generate]
  )

  const closeSector = useCallback(() => {
    setActiveSector(null)
  }, [])

  const regenerate = useCallback(
    (type: SectorType) => {
      void generate(type)
    },
    [generate]
  )

  // Cleanup on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  return { sectors, activeSector, generating, openSector, closeSector, regenerate }
}
