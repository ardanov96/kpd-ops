/**
 * src/lib/api/auth.ts
 *
 * Helper autentikasi & autorisasi untuk API routes.
 * Memusatkan logika cek user + role agar konsisten di semua endpoint.
 *
 * PENTING (Sprint 6 - Fix BUG #12):
 *   Sebelumnya semua API routes pakai `createAdminClient()` (service_role)
 *   yang BYPASS RLS total. Siapapun yang login (termasuk staff) bisa
 *   akses endpoint tanpa filter.
 *
 *   Sekarang kita enforce 2 lapis:
 *   - requireAuth(): wajib authenticated (cek via user-scoped client)
 *   - requireOwner(): wajib authenticated DAN role = 'owner'
 *
 *   Setelah requireAuth/requireOwner sukses, route boleh pakai
 *   `createAdminClient()` untuk query — tapi HANYA dengan filter outlet
 *   yang sesuai user. Atau gunakan `supabase` (user-scoped) yang sudah
 *   ter-honor RLS.
 *
 * Cara pakai:
 *   import { requireOwner } from '@/lib/api/auth'
 *
 *   export async function POST(req: NextRequest) {
 *     const guard = await requireOwner(req)
 *     if (guard instanceof NextResponse) return guard
 *     const { supabase, profile } = guard
 *     // ... lanjut pakai supabase (admin) atau filter by profile.outlet_id
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

export interface AuthGuard {
  user: { id: string; email?: string | null }
  profile: { id: string; nama: string; role: UserRole; outlet_id?: string | null }
  supabase: Awaited<ReturnType<typeof createClient>>
}

/**
 * Require user authenticated (staff boleh akses).
 * Pakai untuk endpoint read-only yang staff boleh lihat.
 */
export async function requireAuth(_req: NextRequest): Promise<AuthGuard | NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()

    if (userErr || !user) {
      return NextResponse.json(
        { error: 'Tidak terautentikasi. Silakan login ulang.' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, nama, role, outlet_id')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json(
        { error: 'Profile tidak ditemukan. Hubungi admin.' },
        { status: 403 }
      )
    }

    return { user, profile, supabase }
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Auth check failed', detail: e?.message },
      { status: 500 }
    )
  }
}

/**
 * Require user authenticated DAN role = 'owner'.
 * Pakai untuk endpoint write (POST/PATCH/DELETE) yang sensitif
 * (sesuai decision D-005: owner-only write).
 */
export async function requireOwner(_req: NextRequest): Promise<AuthGuard | NextResponse> {
  const guard = await requireAuth(_req)
  if (guard instanceof NextResponse) return guard

  if (guard.profile.role !== 'owner') {
    return NextResponse.json(
      {
        error: 'Akses ditolak. Hanya owner yang boleh melakukan aksi ini.',
        required_role: 'owner',
        your_role: guard.profile.role,
      },
      { status: 403 }
    )
  }

  return guard
}

/**
 * Helper: cek apakah hasil requireAuth/requireOwner adalah error response.
 * Mempermudah di route handler:
 *   const guard = await requireOwner(req)
 *   if (isAuthError(guard)) return guard
 *   // guard.profile, guard.supabase tersedia
 */
export function isAuthError(
  guard: AuthGuard | NextResponse
): guard is NextResponse {
  return guard instanceof NextResponse
}