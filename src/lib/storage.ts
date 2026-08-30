/**
 * src/lib/storage.ts
 * Helper Storage — reusable untuk upload/getURL/delete file (S3 / Storage).
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

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

export type BucketType = typeof BUCKET_NOTA | typeof BUCKET_BUKTI

export interface UploadParams {
  outletId: string
  refId?: string
  file: File
  subfolder?: string
}

export interface UploadResult {
  path: string
  publicUrl: string
  originalName: string
  size: number
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

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}

function getS3Client() {
  const bucket = process.env.BACKUP_S3_BUCKET
  const region = process.env.BACKUP_S3_REGION || 'ap-southeast-1'
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return null
  }

  return {
    client: new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
  }
}

async function uploadToBucket(
  bucket: BucketType,
  params: UploadParams
): Promise<StorageResult> {
  const validation = validateFile(params.file)
  if (validation) return { error: validation }

  try {
    const safeName = sanitizeFilename(params.file.name)
    const parts = [bucket, params.outletId]
    if (params.subfolder) parts.push(params.subfolder)
    if (params.refId) parts.push(`${params.refId}-${safeName}`)
    else parts.push(safeName)
    const path = parts.join('/')

    const s3 = getS3Client()
    if (s3) {
      const arrayBuffer = await params.file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      await s3.client.send(
        new PutObjectCommand({
          Bucket: s3.bucket,
          Key: path,
          Body: buffer,
          ContentType: params.file.type,
        })
      )
    }

    return {
      data: {
        path,
        publicUrl: `/${path}`,
        originalName: params.file.name,
        size: params.file.size,
        mimeType: params.file.type,
      },
    }
  } catch (e: any) {
    return { error: { error: e?.message || 'Unknown error', code: 'UPLOAD_FAILED' } }
  }
}

export async function uploadNota(params: UploadParams): Promise<StorageResult> {
  return uploadToBucket(BUCKET_NOTA, params)
}

export async function uploadBuktiPajak(params: UploadParams): Promise<StorageResult> {
  return uploadToBucket(BUCKET_BUKTI, params)
}

export async function getSignedUrl(
  bucket: BucketType,
  path: string,
  _expiry: number = SIGNED_URL_EXPIRY
): Promise<{ url?: string; error?: string }> {
  return { url: path.startsWith('/') ? path : `/${path}` }
}

export async function deleteFile(
  _bucket: BucketType,
  path: string
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const s3 = getS3Client()
    if (s3) {
      await s3.client.send(
        new DeleteObjectCommand({
          Bucket: s3.bucket,
          Key: path,
        })
      )
    }
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Unknown error' }
  }
}

export function parseStoragePath(urlOrPath: string, _bucket: BucketType): string | null {
  if (!urlOrPath) return null
  return urlOrPath.split('?')[0] || null
}
