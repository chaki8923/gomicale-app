# ゴミカレ デプロイメントガイド

## 完了済みの作業

✅ **Supabase プロジェクト作成**
- プロジェクト ID: `fsmajfntzicwrfxjqwwz`
- URL: `https://fsmajfntzicwrfxjqwwz.supabase.co`
- マイグレーション適用済み（3ファイル）
- TypeScript 型定義生成済み

✅ **Cloudflare R2 バケット作成**
- バケット名: `gomicale-pdfs`
- アカウント ID: `2d44ce7061796f9eeb11190723a61cd5`

✅ **AWS Lambda デプロイ**
- 関数名: `gomicale-processor`
- IAM User: `gomicale-lambda-invoker`
- Access Key ID: `AKIAQGWFDPICTT2SRN5D` (`.env.local` に設定済み)

---

## 手動設定が必要な項目

### 1. Supabase Service Role Key の取得

1. [Supabase Dashboard](https://supabase.com/dashboard/project/fsmajfntzicwrfxjqwwz) にアクセス
2. Settings > API > `service_role` key をコピー
3. `.env.local` の `SUPABASE_SERVICE_ROLE_KEY` に設定

### 2. Supabase Google OAuth 設定

1. Supabase Dashboard > Authentication > Providers > Google
2. Enable Google provider を ON
3. Google OAuth Client ID / Secret を設定（[Google Cloud Console](https://console.cloud.google.com/) で作成）
4. Additional scopes に以下を追加:
   ```
   https://www.googleapis.com/auth/calendar.events
   ```
5. Authorized redirect URLs に以下を追加:
   ```
   https://fsmajfntzicwrfxjqwwz.supabase.co/auth/v1/callback
   ```

### 3. Supabase Realtime 有効化

1. Supabase Dashboard > Database > Replication
2. `jobs` テーブルを選択して Realtime を有効化

### 4. Cloudflare R2 API トークン作成

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) > R2 > Manage R2 API Tokens
2. Create API Token
3. Permissions: Object Read & Write
4. 作成された Access Key ID / Secret Access Key を `.env.local` に設定:
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
5. Account ID (`2d44ce7061796f9eeb11190723a61cd5`) を `.env.local` の `CLOUDFLARE_ACCOUNT_ID` に設定

### 5. Cloudflare R2 CORS 設定

1. Cloudflare Dashboard > R2 > `gomicale-pdfs` バケット
2. Settings > CORS Policy
3. 以下の JSON を設定（Vercel デプロイ後に実際のドメインに更新）:

```json
[
  {
    "AllowedOrigins": ["https://your-app.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 300
  }
]
```

### 6. Lambda 環境変数設定

以下のコマンドで Lambda 関数に環境変数を設定:

```bash
aws lambda update-function-configuration \
  --function-name gomicale-processor \
  --environment Variables="{
    GEMINI_API_KEY=your_gemini_api_key,
    SUPABASE_URL=https://fsmajfntzicwrfxjqwwz.supabase.co,
    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key,
    CLOUDFLARE_ACCOUNT_ID=2d44ce7061796f9eeb11190723a61cd5,
    R2_ACCESS_KEY_ID=your_r2_access_key_id,
    R2_SECRET_ACCESS_KEY=your_r2_secret_access_key,
    R2_BUCKET_NAME=gomicale-pdfs,
    GOOGLE_CLIENT_ID=your_google_client_id,
    GOOGLE_CLIENT_SECRET=your_google_client_secret
  }"
```

### 7. Vercel デプロイ

1. Vercel CLI でログイン:
   ```bash
   vercel login
   ```

2. プロジェクトにリンク:
   ```bash
   cd /Users/chakiryou/Desktop/gomicale-app
   vercel link
   ```

3. 環境変数を Vercel に設定（`.env.local` の全項目）:
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add CLOUDFLARE_ACCOUNT_ID
   vercel env add R2_ACCESS_KEY_ID
   vercel env add R2_SECRET_ACCESS_KEY
   vercel env add R2_BUCKET_NAME
   vercel env add AWS_REGION
   vercel env add AWS_LAMBDA_ACCESS_KEY_ID
   vercel env add AWS_LAMBDA_SECRET_ACCESS_KEY
   vercel env add LAMBDA_FUNCTION_NAME
   vercel env add NEXT_PUBLIC_APP_URL
   ```

4. 本番デプロイ:
   ```bash
   vercel --prod
   ```

5. デプロイ後、Vercel の URL を取得して R2 CORS 設定を更新

---

## 環境変数チェックリスト

`.env.local` に以下が設定されていることを確認:

- [x] `NEXT_PUBLIC_SUPABASE_URL`
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (手動設定)
- [ ] `CLOUDFLARE_ACCOUNT_ID` (手動設定)
- [ ] `R2_ACCESS_KEY_ID` (手動設定)
- [ ] `R2_SECRET_ACCESS_KEY` (手動設定)
- [x] `R2_BUCKET_NAME`
- [x] `AWS_REGION`
- [x] `AWS_LAMBDA_ACCESS_KEY_ID`
- [x] `AWS_LAMBDA_SECRET_ACCESS_KEY`
- [x] `LAMBDA_FUNCTION_NAME`
- [x] `NEXT_PUBLIC_APP_URL`

---

## トラブルシューティング

### Lambda 関数が動作しない
- Lambda の環境変数が正しく設定されているか確認
- CloudWatch Logs (`/aws/lambda/gomicale-processor`) でエラーログを確認

### R2 アップロードが失敗する
- CORS 設定が正しいか確認
- R2 API トークンの権限を確認

### Supabase Realtime が動作しない
- Database > Replication で `jobs` テーブルが有効になっているか確認
- ブラウザのコンソールでエラーを確認
