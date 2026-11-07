# ゴミカレ - ゴミ出しカレンダー自動登録アプリ

PDFのゴミ出しカレンダーをアップロードするだけで、AIが内容を解析しGoogleカレンダーに自動登録します。

## アーキテクチャ

```
ブラウザ → Vercel (Next.js) → Cloudflare R2 (PDF保管)
                            → Supabase (DB/Auth/Realtime)
                            → AWS Lambda (非同期) → Gemini API (PDF解析)
                                                  → Google Calendar API (登録)
```

## ディレクトリ構成

```
gomicale-app/
├── src/                    # Next.js フロントエンド
│   ├── app/
│   │   ├── auth/callback/  # Google OAuth コールバック
│   │   ├── login/          # ログインページ
│   │   ├── dashboard/      # メイン画面 (Realtime監視)
│   │   └── api/
│   │       ├── upload/presign/  # R2 Presigned URL 発行
│   │       └── jobs/start/      # Lambda 非同期 invoke
│   ├── components/
│   │   ├── UploadZone.tsx   # PDF ドラッグ&ドロップ
│   │   └── JobStatusCard.tsx # Realtime ジョブ監視
│   ├── lib/supabase/        # Supabase クライアント (client/server/middleware)
│   ├── lib/r2.ts            # R2 Presigned URL ユーティリティ
│   └── types/database.ts    # 型定義
├── lambda/                 # AWS Lambda 処理
│   └── src/
│       ├── index.ts         # ハンドラーエントリーポイント
│       ├── parsers/
│       │   ├── base.ts      # Strategy インターフェース
│       │   ├── gemini.ts    # Gemini 1.5 Pro 実装
│       │   └── factory.ts   # パーサーファクトリー
│       └── calendar/
│           ├── client.ts    # Google Calendar バッチ登録
│           └── idempotency.ts # Base32hex イベントID生成
├── infra/                  # AWS CDK インフラ定義
│   ├── bin/app.ts
│   └── lib/gomicale-stack.ts
└── supabase/
    ├── config.toml          # ローカル開発設定
    └── migrations/
        ├── 001_initial_schema.sql
        ├── 002_rls_policies.sql
        └── 003_encryption_setup.sql
```

## セットアップ手順

### 管理者向けエラーメール送信

`/ja/admin/error-emails`（英語は `/en/admin/error-emails`）で、エラージョブの確認とユーザーへの個別・一括メール送信ができます。管理者のダッシュボードにだけ入口を表示し、画面とAPIの両方でSupabaseの認証済みメールアドレスを検証します。

1. `supabase/migrations/20261107022553_create_admin_error_emails.sql` を既存の手順で適用してからアプリを配置します。手動送信履歴と、そのユーザーごとの最新履歴を取得するビューを作成します。テーブル・ビューはブラウザの `anon` / `authenticated` ロールからはアクセスできません。
2. [.env.admin.example](.env.admin.example) を参考に、**サーバー側**の `ADMIN_EMAIL`、`RESEND_API_KEY`、`APP_FROM_EMAIL`、`APP_URL` を設定します。送信元にはResendで検証済みのドメインを使います。`ADMIN_EMAIL` を省略した場合のみ既存の `NEXT_PUBLIC_ADMIN_EMAIL` を使用し、どちらも未設定または空の場合はアクセスを拒否します。Service Roleキーは既存の `SUPABASE_SERVICE_ROLE_KEY` を使用します。
3. 対象ジョブを選択し、件名・本文と宛先を確認してから送信します。一覧は最新順の50件単位です。同一ユーザーの複数ジョブを選んでも1通だけ送信し、ほかの宛先はメールに含めません。

本文はプレーンテキストとして送信します。自動エラー通知は従来どおり動作し、この画面の「手動送信」履歴には含まれません。「送信受付済み」はResendが受け付けた状態で、受信箱への配達完了を保証する表示ではありません。

通信切断や履歴保存失敗時は「結果不明」と表示します。同じ画面の再試行ボタン、または一覧の履歴にある再試行ボタンを使用すると、同じ送信ID・宛先・本文で確認できます。Resendのキー保持期間を越えた再送を避けるため、23時間を過ぎた操作は再試行を停止します。その場合はResendの送信記録を確認してから必要に応じて新しいメールを作成してください。

`npm run test:admin-emails` は、認可・入力検証・重複送信防止・途中失敗・再試行をモックで検証します。本番ユーザーにテストメールは送信しません。

### 1. Supabase

```bash
# CLI インストール
npm install -g supabase

# プロジェクト作成 (Supabase Dashboard でも可)
supabase init
supabase link --project-ref <your-project-ref>

# マイグレーション適用
supabase db push

# Google OAuth 設定
# Dashboard > Authentication > Providers > Google
# Authorized redirect URL: https://your-project.supabase.co/auth/v1/callback
# Additional scopes: https://www.googleapis.com/auth/calendar.events
```

### 2. Cloudflare R2

```bash
# R2 バケット作成
# Dashboard > R2 > Create bucket: gomicale-pdfs
# API トークン作成: Dashboard > R2 > Manage R2 API Tokens
# CORS設定: PUTメソッドを許可 (Presigned URLアップロード用)
```

R2 CORS 設定 (JSON):
```json
[
  {
    "AllowedOrigins": ["https://your-vercel-app.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 300
  }
]
```

### 3. AWS Lambda

```bash
# Lambda のビルド
cd lambda
npm install
npm run build:zip

# CDK デプロイ前に SSM パラメーターを設定
aws ssm put-parameter --name /gomicale/gemini-api-key         --value "AIza..." --type SecureString
aws ssm put-parameter --name /gomicale/supabase-url           --value "https://xxx.supabase.co" --type SecureString
aws ssm put-parameter --name /gomicale/supabase-service-role-key --value "eyJ..." --type SecureString
aws ssm put-parameter --name /gomicale/r2-account-id          --value "..." --type SecureString
aws ssm put-parameter --name /gomicale/r2-access-key-id       --value "..." --type SecureString
aws ssm put-parameter --name /gomicale/r2-secret-access-key   --value "..." --type SecureString
aws ssm put-parameter --name /gomicale/google-client-id       --value "..." --type SecureString
aws ssm put-parameter --name /gomicale/google-client-secret   --value "..." --type SecureString

# CDK デプロイ
cd ../infra
npm install
npx cdk bootstrap
npx cdk deploy
# Outputs に表示される InvokerAccessKeyId/SecretKey を .env.local に設定
```

### 4. Vercel

```bash
# Vercel CLI
npm install -g vercel
vercel link

# 環境変数を Vercel に設定
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

# デプロイ
vercel --prod
```

### 5. ローカル開発

```bash
cp .env.local.example .env.local
# .env.local を編集して各値を設定

npm install
npm run dev
```

## 冪等性の仕組み

Google Calendar のイベントIDには `date + pdfHash + garbageType` から生成した
Base32hex (RFC 4648) ハッシュを使用します。同一PDFを何度アップロードしても
カレンダーに重複登録されません（409 Conflict は正常として処理）。

## LLMプロバイダーの切り替え

`lambda/src/parsers/factory.ts` に新しいプロバイダーを追加し、
環境変数 `PARSER_PROVIDER` で切り替えます。
