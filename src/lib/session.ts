const SECRET = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || 'dev-only-insecure-secret-do-not-use-in-prod'

/**
 * Tanda-tangani payload session dengan HMAC-SHA256 untuk mencegah
 * client-side spoofing. Format token: `<base64url(json)>.<base64url(hmac)>`.
 *
 * Menggunakan Web Crypto API (`globalThis.crypto.subtle`) karena middleware
 * Next.js jalan di Edge Runtime yg tdk support Node `crypto` module.
 */

function getCrypto(): Crypto {
  // Edge Runtime expose globalThis.crypto = Web Crypto
  // Node 19+ juga expose globalThis.crypto. Fallback ke Node crypto utk safety.
  const c = (globalThis as any).crypto
  if (c && c.subtle && c.subtle.importKey) return c as Crypto
  // Fallback (seharusnya tdk pernah dipake di Next.js modern)
  return crypto as unknown as Crypto
}

async function importHmacKey(usage: 'sign' | 'verify'): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return getCrypto().subtle.importKey(
    'raw',
    enc.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  )
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i])
  // btoa works in both Edge (Web API) and Node 16+
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const binary = atob(b64 + pad)
  const u8 = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i)
  return u8
}

export async function signSession(payload: Record<string, unknown>): Promise<string> {
  const json = JSON.stringify(payload)
  const body = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const key = await importHmacKey('sign')
  const sigBuf = await getCrypto().subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const hmac = bytesToBase64Url(sigBuf)
  return `${body}.${hmac}`
}

export async function verifySession<T = Record<string, unknown>>(
  token: string | undefined | null
): Promise<T | null> {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return null

  const body = token.slice(0, dot)
  const hmac = token.slice(dot + 1)

  let key: CryptoKey
  try {
    key = await importHmacKey('verify')
  } catch {
    return null
  }

  let hmacBytes: Uint8Array
  try {
    hmacBytes = base64UrlToBytes(hmac)
  } catch {
    return null
  }

  let isValid = false
  try {
    isValid = await getCrypto().subtle.verify(
      'HMAC', key,
      hmacBytes.buffer.slice(hmacBytes.byteOffset, hmacBytes.byteOffset + hmacBytes.byteLength) as ArrayBuffer,
      new TextEncoder().encode(body),
    )
  } catch {
    return null
  }

  if (!isValid) return null

  try {
    const json = atob(body.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as T
  } catch {
    return null
  }
}
