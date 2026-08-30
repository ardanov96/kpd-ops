import { NextRequest, NextResponse } from 'next/server'

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

  let user: any = null
  const sessionUserCookie = request.cookies.get('session_user')
  if (sessionUserCookie?.value) {
    try {
      user = JSON.parse(sessionUserCookie.value)
    } catch {}
  }

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