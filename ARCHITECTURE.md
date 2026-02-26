# ゴミカレ (Gomicale) アーキテクチャとデータフロー

このドキュメントでは、「ゴミカレ」アプリケーションのシステム構成とデータフローについて説明します。

## インフラストラクチャアーキテクチャ

システムは以下の主要なコンポーネントで構成されています。

- **フロントエンド / API (BFF)**: Next.js (Vercel)
- **データベース & 認証**: Supabase (PostgreSQL, Supabase Auth)
- **ファイルストレージ**: Cloudflare R2
- **非同期ワーカー**: AWS Lambda
- **エラーキュー**: AWS SQS (Dead Letter Queue)
- **外部サービス**: Google Gemini API (AI解析), Google Calendar API

### LambdaとSQSの作成方法について
AWSインフラストラクチャ（Lambda, SQS DLQ, IAMロールなど）は、リポジトリ内の `infra/lib/gomicale-stack.ts` に定義された **AWS CDK (Cloud Development Kit)** によってコードとして管理 (IaC) されています。デプロイ時（`npx cdk deploy`）に自動的に作成される仕組みとなっています。
SQSは、Lambda関数が非同期呼び出しに失敗した際のエラー退避先（DLQ: Dead Letter Queue）として設定されています。

---

## アーキテクチャ図 (Mermaid)

```mermaid
architecture-beta
    group user_layer(User Layer)
    service user(User) in user_layer

    group vercel(Vercel)
    service nextjs(Next.js App) in vercel
    
    group supabase(Supabase)
    service auth(Supabase Auth) in supabase
    service db(PostgreSQL) in supabase

    group cloudflare(Cloudflare)
    service r2(Cloudflare R2) in cloudflare

    group aws(AWS)
    service lambda(AWS Lambda) in aws
    service sqs(SQS DLQ) in aws
    service logs(CloudWatch Logs) in aws

    group external(External APIs)
    service gemini(Gemini API) in external
    service gcal(Google Calendar API) in external

    user:B -- L:nextjs
    nextjs:R -- L:auth
    nextjs:R -- L:db
    nextjs:R -- L:r2
    nextjs:R -- L:lambda
    
    lambda:T -- B:gemini
    lambda:T -- B:gcal
    lambda:L -- R:db
    lambda:L -- R:r2
    
    lambda:R -- L:sqs
    lambda:R -- L:logs
```

---

## データフロー図

アップロードからカレンダー登録までの詳細なデータの流れです。

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant NextJS as Next.js (Vercel)
    participant Supabase as Supabase (DB/Auth)
    participant R2 as Cloudflare R2
    participant Lambda as AWS Lambda
    participant Gemini as Google Gemini
    participant GCal as Google Calendar API
    participant SQS as AWS SQS (DLQ)

    User->>NextJS: 1. Googleログイン (OAuth)
    NextJS->>Supabase: 2. 認証処理・セッション確立
    NextJS->>Supabase: 3. Googleリフレッシュトークン保存

    User->>NextJS: 4. PDFファイルを選択
    NextJS->>Supabase: 5. Jobレコード作成 (status: pending)
    NextJS->>NextJS: 6. R2の署名付きURL (Presigned URL) 取得
    NextJS->>R2: 7. PDFを直接アップロード
    R2-->>NextJS: 8. アップロード完了

    NextJS->>NextJS: 9. 解析開始リクエスト (POST /api/jobs/start)
    NextJS->>Supabase: 10. Jobステータス更新 (status: processing)
    NextJS-)Lambda: 11. Lambdaを非同期呼び出し (InvocationType: Event)
    NextJS-->>User: 12. 処理開始を応答
    
    User->>Supabase: 13. Jobステータスの変更を購読 (Realtime)

    activate Lambda
    Lambda->>R2: 14. PDFファイルをダウンロード
    Lambda->>Gemini: 15. PDFをアップロードし、スケジュール解析指示
    Gemini-->>Lambda: 16. JSON形式で抽出された予定データ
    
    Lambda->>Supabase: 17. ユーザーのGoogleリフレッシュトークン取得
    Lambda->>GCal: 18. Google Calendarに予定を一括登録
    GCal-->>Lambda: 19. 登録完了

    alt 成功時
        Lambda->>Supabase: 20a. Jobステータス更新 (status: completed)
        Supabase-->>User: 21a. 完了をリアルタイム通知
    else 失敗時
        Lambda->>Supabase: 20b. Jobステータス更新 (status: failed)
        Supabase-->>User: 21b. エラーをリアルタイム通知
    else 非同期呼び出し/リトライ失敗時
        Lambda-)SQS: 20c. Dead Letter Queueへイベントを退避
    end
    deactivate Lambda
```

## 各コンポーネントの役割

1. **Next.js (API Routes / Server Actions)**
   - R2への署名付きURL（Presigned URL）の発行
   - SupabaseでのJob（処理ステータス）のレコード管理
   - Lambdaの非同期（Event）呼び出し（AWS SDK `InvokeCommand` を使用）

2. **Cloudflare R2**
   - ユーザーがアップロードした一時的なPDFの保存。Vercelのペイロード制限を回避するため、クライアントから直接アップロードされます。

3. **Supabase**
   - **Auth**: Google OAuth認証とセッション管理
   - **Database**: Jobの進捗ステータス管理、Google API連携用のリフレッシュトークン保存
   - **Realtime**: クライアント側でJobのステータス変更をリアルタイムで購読

4. **AWS Lambda (`gomicale-processor`)**
   - 重い処理（AI解析とAPI通信）をバックグラウンドで実行
   - Gemini APIを使ったPDFからのデータ抽出
   - Google Calendar APIを使った予定の登録処理
   - 処理完了後にSupabaseのJobステータスを更新

5. **AWS SQS (`gomicale-processor-dlq`)**
   - Lambda関数が実行中にクラッシュしたり、リトライの上限に達して処理に失敗した場合のエラーイベントの退避先（Dead Letter Queue）です。AWS CDKの定義によって自動構築されています。
