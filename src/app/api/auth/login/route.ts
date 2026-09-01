import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password wajib diisi' },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()
    const defaultOwnerPassword = process.env.DEFAULT_OWNER_PASSWORD || 'Admin123456'

    // 1. Akun Owner Default
    if (cleanEmail === 'owner@ekspedisi.com') {
      if (password !== defaultOwnerPassword) {
        return NextResponse.json(
          { error: 'Password salah untuk owner@ekspedisi.com' },
          { status: 401 }
        )
      }

      let user = null
      if (process.env.DATABASE_URL) {
        try {
          const res = await query(
            'SELECT id, email, nama, role, outlet_id FROM profiles WHERE LOWER(email) = $1 LIMIT 1',
            [cleanEmail]
          )
          if (res.rows.length > 0) {
            user = res.rows[0]
          }
        } catch (e) {
          console.error('Error fetching owner profile from database:', e)
        }
      }

      if (!user) {
        user = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'owner@ekspedisi.com',
          nama: 'Owner Ekspedisi',
          role: 'owner',
          outlet_id: null,
        }
      }

      const response = NextResponse.json({ success: true, user })
      response.cookies.set('session_user', JSON.stringify(user), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 hari
      })

      return response
    }

    // 2. Query user profile terdaftar lain dari database PostgreSQL Neon
    if (process.env.DATABASE_URL) {
      try {
        const res = await query(
          'SELECT id, email, password_hash, nama, role, outlet_id FROM profiles WHERE LOWER(email) = $1 LIMIT 1',
          [cleanEmail]
        )

        if (res.rows.length > 0) {
          const user = res.rows[0]

          // Verifikasi password jika field password_hash ada
          if (user.password_hash && user.password_hash !== password) {
            return NextResponse.json(
              { error: 'Password salah' },
              { status: 401 }
            )
          }

          const { password_hash, ...safeUser } = user
          const response = NextResponse.json({ success: true, user: safeUser })

          response.cookies.set('session_user', JSON.stringify(safeUser), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
          })

          return response
        }
      } catch (e) {
        console.error('Error querying profiles:', e)
      }
    }

    return NextResponse.json(
      { error: 'Email atau password tidak valid' },
      { status: 401 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Login gagal' },
      { status: 500 }
    )
  }
}
