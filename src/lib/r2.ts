import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Cloudflare R2 は S3 互換 API を持つため AWS SDK で操作可能
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET_NAME  = process.env.R2_BUCKET_NAME!
const PRESIGN_TTL  = 300 // 5分

// アップロード可能な MIME タイプと対応する拡張子
const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg':      'jpg',
  'image/png':       'png',
  'image/webp':      'webp',
}

export interface PresignedUploadResult {
  uploadUrl: string
  objectKey: string
}

/**
 * R2 へのアップロード用 Presigned URL を発行する
 * @param userId       Supabase ユーザー ID
 * @param fileId       フロントエンドが生成した一意のファイルID (UUID)
 * @param contentType  アップロードするファイルの MIME タイプ
 */
export async function createPresignedUploadUrl(
  userId: string,
  fileId: string,
  contentType: string = 'application/pdf',
): Promise<PresignedUploadResult> {
  const ext = EXT_BY_MIME[contentType] ?? 'pdf'
  const objectKey = `uploads/${userId}/${fileId}.${ext}`

  const command = new PutObjectCommand({
    Bucket:      BUCKET_NAME,
    Key:         objectKey,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: PRESIGN_TTL,
  })

  return { uploadUrl, objectKey }
}

/** Page from the beginning after deletion, so keys are never skipped. */
export async function deleteAccountFiles(userId: string, deadline: number): Promise<boolean> {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(userId)) throw new Error('INVALID_USER')
  while (Date.now() < deadline - 10000) {
    const page = await r2Client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: `uploads/${userId}/`, MaxKeys: 1000 }), { abortSignal: AbortSignal.timeout(8000) })
    const objects = (page.Contents ?? []).flatMap(item => item.Key ? [{ Key: item.Key }] : [])
    if (!objects.length) return true
    const result = await r2Client.send(new DeleteObjectsCommand({ Bucket: BUCKET_NAME, Delete: { Objects: objects, Quiet: true } }), { abortSignal: AbortSignal.timeout(8000) })
    if (result.Errors?.length) throw new Error('FILES_DELETE_FAILED')
  }
  return false
}
