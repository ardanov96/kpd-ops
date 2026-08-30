import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email wajib diisi' },
        { status: 400 }
      )
    }

    // Query user profile dari database PostgreSQL Neon
    if (process.env.DATABASE_URL) {
      const res = await query(
        'SELECT id, email, nama, role, outlet_id FROM profiles WHERE email = $1 LIMIT 1',
        [email]
      )

      if (res.rows.length > 0) {
        const user = res.rows[0]
        const response = NextResponse.json({ success: true, user })

        // Set session cookie
        response.cookies.set('session_user', JSON.stringify(user), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 hari
        })

        return response
      }
    }

    // Default fallback user jika database belum ada data
    const defaultUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: email || 'owner@ekspedisi.com',
      nama: 'Owner Ekspedisi',
      role: 'owner',
      outlet_id: null,
    }

    const response = NextResponse.json({ success: true, user: defaultUser })
    response.cookies.set('session_user', JSON.stringify(defaultUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    return response
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Login gagal' },
      { status: 500 }
    )
  }
}
