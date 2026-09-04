// Persistence for sector deep-dive analyses. Loads and saves sector rows from
// the house_sectors table. Client-safe Supabase calls (user-scoped, RLS).

import type { SectorType, SectorRow, SectorFinding } from './types'

type Supabase = ReturnType<typeof import('@/lib/supabase/client').createClient>

// Load all sectors for a house. Returns an empty array when none exist.
export async function loadSectors(supabase: Supabase, houseId: string): Promise<SectorRow[]> {
  const { data, error } = await supabase
    .from('house_sectors')
    .select('*')
    .eq('house_id', houseId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as SectorRow[]
}

// Load a single sector by type. Returns null when it doesn't exist.
export async function loadSector(
  supabase: Supabase,
  houseId: string,
  sectorType: SectorType
): Promise<SectorRow | null> {
  const { data, error } = await supabase
    .from('house_sectors')
    .select('*')
    .eq('house_id', houseId)
    .eq('sector_type', sectorType)
    .maybeSingle()
  if (error || !data) return null
  return data as SectorRow
}

// Upsert a sector row (used by the API route after generation).
export async function saveSector(
  supabase: Supabase,
  houseId: string,
  sectorType: SectorType,
  analysis: unknown,
  findings: SectorFinding[]
): Promise<SectorRow | null> {
  const { data, error } = await supabase
    .from('house_sectors')
    .upsert(
      {
        house_id: houseId,
        sector_type: sectorType,
        status: 'complete',
        analysis,
        findings,
        error: null,
      },
      { onConflict: 'house_id,sector_type' }
    )
    .select('*')
    .single()
  if (error) {
    console.error('[saveSector] upsert failed:', error.message, error.code, error.details)
    return null
  }
  if (!data) return null
  return data as SectorRow
}

// Mark a sector as failed (used by the API route on generation error).
export async function markSectorFailed(
  supabase: Supabase,
  houseId: string,
  sectorType: SectorType,
  errorMsg: string
): Promise<void> {
  await supabase
    .from('house_sectors')
    .upsert(
      {
        house_id: houseId,
        sector_type: sectorType,
        status: 'failed',
        analysis: null,
        findings: null,
        error: errorMsg,
      },
      { onConflict: 'house_id,sector_type' }
    )
}
