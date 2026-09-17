import crypto from 'crypto'

const SECRET = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || 'dev-only-insecure-secret-do-not-use-in-prod'

/**
 * Tanda-tangani payload session dengan HMAC-SHA256 untuk mencegah
 * client-side spoofing. Format token: `<base64url(json)>.<base64url(hmac)>`.
 *
 * Sebelum fix: cookie berisi JSON polos yg bisa di-forge oleh siapapun.
 * Setelah fix: server verify HMAC pakai SESSION_SECRET sebelum trust payload.
 */
export function signSession(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload)
  const body = Buffer.from(json).toString('base64url')
  const hmac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${hmac}`
}

export function verifySession<T = Record<string, unknown>>(token: string | undefined | null): T | null {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return null

  const body = token.slice(0, dot)
  const hmac = token.slice(dot + 1)

  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')

  // Constant-time compare utk cegah timing attack
  const a = Buffer.from(hmac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}
