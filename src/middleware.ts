import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Sprint 6 - Fix ISU #19: Middleware exclude API cron & admin.
 *
 * Sebelumnya middleware panggil `getUser()` untuk SEMUA request termasuk
 * /api/admin/* dan /api/cron/*. Endpoint ini sudah punya Bearer token
 * validation sendiri → extra latency dari getUser() tidak perlu.
 *
 * Setelah fix:
 *   - /api/auth/* → public (login/logout/refresh)
 *   - /api/admin/* → skip middleware (pakai Bearer BACKUP_CRON_SECRET)
 *   - /api/cron/* → skip middleware (pakai Bearer CRON_SECRET)
 *   - Lainnya → cek getUser() seperti biasa
 */

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Skip middleware untuk endpoint yang punya auth sendiri (Bearer token)
  const isPublicApi =
    path.startsWith('/api/auth') ||
    path.startsWith('/api/admin') ||
    path.startsWith('/api/cron')

  // Halaman public: /login, /api/auth/*
  const isPublicPage =
    path === '/login' ||
    path.startsWith('/login')

  if (isPublicApi) {
    // Endpoint ini validasi Bearer token sendiri — lewati middleware
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !isPublicPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}