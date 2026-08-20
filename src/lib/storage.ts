/**
 * src/lib/storage.ts
 * Helper Storage Sprint 4 — reusable untuk upload/getURL/delete file.
 *
 * Design:
 *   - Server-side only (jangan di-import di Client Components)
 *   - Pakai `createAdminClient()` (service_role) di route.ts server actions
 *   - Bucket private → akses via signed URL (default 1 jam)
 *   - Validasi tipe file & ukuran di-server
 *
 * Penggunaan (server-side, mis. di API route):
 *   import { uploadNota, uploadBuktiPajak, deleteFile, getSignedUrl } from '@/lib/storage'
 *
 *   const result = await uploadNota({
 *     outletId: 'abc-123',
 *     transaksiId: 'trans-456',
 *     file: formData.get('nota') as File,
 *   })
 *   if (result.error) return new Response(result.error, { status: 400 })
 *   // result.url berisi public path di bucket, simpan ke DB
 */

import { createAdminClient } from '@/lib/supabase/server'

// ============================================================
// KONSTANTA
// ============================================================

export const BUCKET_NOTA = 'nota-expense'
export const BUCKET_BUKTI = 'bukti-pajak'

export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

export const SIGNED_URL_EXPIRY = 3600 // 1 jam (detik)

// ============================================================
// TYPES
// ============================================================

export type BucketType = typeof BUCKET_NOTA | typeof BUCKET_BUKTI

export interface UploadParams {
  outletId: string
  /** ID referensi opsional (transaksi_id untuk nota, pajak_rekap_id untuk bukti) */
  refId?: string
  /** File dari FormData */
  file: File
  /** Sub-folder opsional, mis. 'YYYY-MM' */
  subfolder?: string
}

export interface UploadResult {
  /** Path file di bucket (untuk disimpan ke DB) */
  path: string
  /** Public URL (signed URL untuk bucket private — masa aktif 1 jam) */
  publicUrl: string
  /** Nama file asli */
  originalName: string
  /** Ukuran file (bytes) */
  size: number
  /** MIME type */
  mimeType: string
}

export interface UploadError {
  error: string
  code?: 'FILE_TOO_LARGE' | 'INVALID_TYPE' | 'UPLOAD_FAILED' | 'MISSING_FILE'
}

export interface StorageResult {
  data?: UploadResult
  error?: UploadError
}

// ============================================================
// VALIDASI
// ============================================================

export function validateFile(file: File | null | undefined): UploadError | null {
  if (!file) {
    return { error: 'File wajib diisi', code: 'MISSING_FILE' }
  }
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2)
    return {
      error: `File terlalu besar (${sizeMB} MB). Maksimal ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      code: 'FILE_TOO_LARGE',
    }
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    return {
      error: `Tipe file tidak didukung: ${file.type || 'unknown'}. Hanya JPG/PNG/WebP/PDF.`,
      code: 'INVALID_TYPE',
    }
  }
  return null
}

/**
 * Sanitize nama file — hapus karakter aneh, ganti spasi dengan dash.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100) // batasi panjang
}

// ============================================================
// UPLOAD GENERIC
// ============================================================

async function uploadToBucket(
  bucket: BucketType,
  params: UploadParams
): Promise<StorageResult> {
  const validation = validateFile(params.file)
  if (validation) return { error: validation }

  try {
    const supabase = createAdminClient()

    // Build path: {outletId}/{subfolder?}/{refId?}-{sanitized_filename}
    const safeName = sanitizeFilename(params.file.name)
    const parts = [params.outletId]
    if (params.subfolder) parts.push(params.subfolder)
    if (params.refId) parts.push(`${params.refId}-${safeName}`)
    else parts.push(safeName)
    const path = parts.join('/')

    // Upload sebagai Buffer (Node runtime) bukan Blob (browser runtime)
    const arrayBuffer = await params.file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data, error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: params.file.type,
        cacheControl: '3600',
        upsert: true, // overwrite kalau ada file dengan nama sama
      })

    if (uploadErr) {
      return { error: { error: uploadErr.message, code: 'UPLOAD_FAILED' } }
    }

    // Generate signed URL (private bucket)
    const { data: signedData, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_EXPIRY)

    if (signErr || !signedData) {
      // File sudah ter-upload tapi signed URL gagal — tetap return path
      // agar caller bisa retry generate URL nanti.
      return {
        data: {
          path,
          publicUrl: '',
          originalName: params.file.name,
          size: params.file.size,
          mimeType: params.file.type,
        },
      }
    }

    return {
      data: {
        path,
        publicUrl: signedData.signedUrl,
        originalName: params.file.name,
        size: params.file.size,
        mimeType: params.file.type,
      },
    }
  } catch (e: any) {
    return { error: { error: e?.message || 'Unknown error', code: 'UPLOAD_FAILED' } }
  }
}

// ============================================================
// UPLOAD NOTA EXPENSE
// ============================================================

/**
 * Upload nota expense (foto kwitansi / struk / invoice ATK, listrik, WiFi).
 * Path: nota-expense/{outletId}/{YYYY-MM}/{transaksiId}-{filename}
 */
export async function uploadNota(params: UploadParams): Promise<StorageResult> {
  return uploadToBucket(BUCKET_NOTA, params)
}

// ============================================================
// UPLOAD BUKTI PAJAK (SSP)
// ============================================================

/**
 * Upload bukti SSP PPh Final (foto / PDF bukti setor pajak).
 * Path: bukti-pajak/{outletId}/{YYYY-MM}/{pajakRekapId}-{filename}
 */
export async function uploadBuktiPajak(params: UploadParams): Promise<StorageResult> {
  return uploadToBucket(BUCKET_BUKTI, params)
}

// ============================================================
// GET SIGNED URL
// ============================================================

/**
 * Generate signed URL untuk file yang sudah ada di bucket.
 * Expired 1 jam (default SIGNED_URL_EXPIRY).
 */
export async function getSignedUrl(
  bucket: BucketType,
  path: string,
  expiry: number = SIGNED_URL_EXPIRY
): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiry)
    if (error) return { error: error.message }
    return { url: data.signedUrl }
  } catch (e: any) {
    return { error: e?.message || 'Unknown error' }
  }
}

// ============================================================
// DELETE FILE
// ============================================================

/**
 * Hapus file dari bucket.
 * Return: { ok: true } jika sukses, { error } jika gagal.
 */
export async function deleteFile(
  bucket: BucketType,
  path: string
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.storage.from(bucket).remove([path])
    if (error) return { error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Unknown error' }
  }
}

// ============================================================
// UTILS
// ============================================================

/**
 * Cek apakah bucket ada (info).
 * Berguna untuk validasi awal atau admin dashboard.
 */
export async function checkBucketExists(bucket: BucketType): Promise<boolean> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.storage.getBucket(bucket)
    return !error && !!data
  } catch {
    return false
  }
}

/**
 * List files di bucket (untuk debug / admin).
 * Limit default 100, prefix opsional untuk filter.
 */
export async function listFiles(
  bucket: BucketType,
  prefix?: string,
  limit = 100
): Promise<{ files?: Array<{ name: string; size: number; updated_at: string }>; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, sortBy: { column: 'updated_at', order: 'desc' } })
    if (error) return { error: error.message }
    return {
      files: (data || []).map(f => ({
        name: f.name,
        size: f.metadata?.size || 0,
        updated_at: f.updated_at || '',
      })),
    }
  } catch (e: any) {
    return { error: e?.message || 'Unknown error' }
  }
}
