import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
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

export interface PresignedUploadResult {
  uploadUrl: string
  objectKey: string
}

/**
 * R2 へのアップロード用 Presigned URL を発行する
 * @param userId  Supabase ユーザー ID
 * @param fileId  フロントエンドが生成した一意のファイルID (UUID)
 */
export async function createPresignedUploadUrl(
  userId: string,
  fileId: string,
): Promise<PresignedUploadResult> {
  const objectKey = `uploads/${userId}/${fileId}.pdf`

  const command = new PutObjectCommand({
    Bucket:      BUCKET_NAME,
    Key:         objectKey,
    ContentType: 'application/pdf',
  })

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: PRESIGN_TTL,
  })

  return { uploadUrl, objectKey }
}
