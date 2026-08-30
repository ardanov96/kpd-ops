/**
 * src/lib/db/outlet.ts
 *
 * Helper untuk resolve outlet_id yang sedang aktif untuk query database.
 */

import { query } from '@/lib/db'

export interface OutletLite {
  id: string
  kode: string
  nama: string
}

export async function getActiveOutlet(
  outletIdFromUser?: string | null
): Promise<OutletLite | null> {
  if (outletIdFromUser) {
    try {
      const res = await query<OutletLite>(
        'SELECT id, kode, nama FROM outlets WHERE id = $1 LIMIT 1',
        [outletIdFromUser]
      )
      if (res.rows.length > 0) return res.rows[0]
    } catch (e) {
      console.error('Error fetching specified outlet:', e)
    }
  }

  // Fallback: outlet paling awal dibuat
  try {
    const fallbackRes = await query<OutletLite>(
      'SELECT id, kode, nama FROM outlets ORDER BY created_at ASC LIMIT 1'
    )
    return fallbackRes.rows[0] ?? null
  } catch (e) {
    console.error('Error fetching fallback outlet:', e)
    return null
  }
}
