/**
 * src/lib/supabase/outlet.ts
 *
 * Helper untuk resolve outlet_id yang sedang aktif untuk user login.
 *
 * Logika:
 *   1. Kalau user login (auth.getUser()), ambil profile.outlet_id (RLS-enforced)
 *   2. Kalau ada profile.outlet_id → pakai outlet tersebut
 *   3. Fallback: outlet paling lama (created_at ASC) — pattern lama yang sudah dipakai di 12 file
 *
 * Dipakai di semua server component / API route yang butuh outlet_id
 * menggantikan inline pattern:
 *   supabase.from('outlets').select('id, kode, nama').order('created_at', { ascending: true }).limit(1).single()
 *
 * Cara pakai:
 *   import { createAdminClient } from '@/lib/supabase/server'
 *   import { getActiveOutlet } from '@/lib/supabase/outlet'
 *   const supabase = createAdminClient()
 *   const outlet = await getActiveOutlet(supabase)
 *
 *   // atau di server component yang sudah punya supabase:
 *   const outlet = await getActiveOutlet(supabase)
 *
 * Refactor berikutnya (TODO): migrasikan 12 server component yang masih inline.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface OutletLite {
  id: string
  kode: string
  nama: string
}

/**
 * Resolve outlet aktif.
 *
 * @param supabase Supabase client (admin atau anon — akan coba getUser())
 * @param opts.redirectTo URL untuk redirect jika tidak ada outlet (opsional, untuk server component)
 * @returns Outlet row atau null (kalau tidak ada outlet di database)
 */
export async function getActiveOutlet(
  supabase: SupabaseClient
): Promise<OutletLite | null> {
  // 1. Coba pakai profile.outlet_id dari user login (RLS-enforced)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('outlet_id')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.outlet_id) {
        const { data: outlet } = await supabase
          .from('outlets')
          .select('id, kode, nama')
          .eq('id', profile.outlet_id)
          .maybeSingle()

        if (outlet) return outlet as OutletLite
      }
    }
  } catch {
    // Fall through ke fallback (admin client tidak punya auth session)
  }

  // 2. Fallback: outlet paling lama (created_at ASC)
  const { data: first } = await supabase
    .from('outlets')
    .select('id, kode, nama')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return (first as OutletLite | null) ?? null
}