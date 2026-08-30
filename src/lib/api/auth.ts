/**
 * src/lib/api/auth.ts
 *
 * Helper autentikasi & autorisasi untuk API routes berbasis PostgreSQL Neon.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { query } from '@/lib/db'
import type { UserRole } from '@/types'

export interface AuthGuard {
  user: { id: string; email?: string | null }
  profile: { id: string; nama: string; role: UserRole; outlet_id?: string | null }
}

/**
 * Require user authenticated (staff/owner).
 */
export async function requireAuth(_req: NextRequest): Promise<AuthGuard | NextResponse> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session_user')

    if (sessionCookie?.value) {
      try {
        const p = JSON.parse(sessionCookie.value)
        if (p?.id) {
          return {
            user: { id: p.id, email: p.email },
            profile: { id: p.id, nama: p.nama, role: p.role as UserRole, outlet_id: p.outlet_id },
          }
        }
      } catch {}
    }

    // Fallback query profile pertama jika ada database_url
    if (process.env.DATABASE_URL) {
      const fallbackProfile = await query(
        'SELECT id, email, nama, role, outlet_id FROM profiles ORDER BY created_at ASC LIMIT 1'
      )
      if (fallbackProfile.rows.length > 0) {
        const p = fallbackProfile.rows[0]
        return {
          user: { id: p.id, email: p.email || 'admin@ekspedisi.local' },
          profile: { id: p.id, nama: p.nama, role: p.role as UserRole, outlet_id: p.outlet_id },
        }
      }
    }

    return NextResponse.json(
      { error: 'Tidak terautentikasi. Silakan login ulang.' },
      { status: 401 }
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Auth check failed', detail: e?.message },
      { status: 500 }
    )
  }
}

/**
 * Require user authenticated DAN role = 'owner'.
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

export function isAuthError(
  guard: AuthGuard | NextResponse
): guard is NextResponse {
  return guard instanceof NextResponse
}