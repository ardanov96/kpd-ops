import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  const isPublicApi =
    path.startsWith('/api/auth') ||
    path.startsWith('/api/admin') ||
    path.startsWith('/api/cron')

  const isPublicPage =
    path === '/login' ||
    path.startsWith('/login')

  if (isPublicApi) {
    return NextResponse.next({ request })
  }

  const user = verifySession(request.cookies.get('session_user')?.value)

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

  return NextResponse.next({ request })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}