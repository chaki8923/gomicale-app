# ゴミカレ LINE Bot 連携の実装について

このドキュメントでは、ゴミカレに実装された LINE Bot との連携機能（フェーズ 2）の仕組みと実装方法について解説します。

## 1. 全体像と仕組み

LINE Bot 連携は、ユーザーが普段使い慣れている LINE から、直近のゴミ収集日やゴミの分類を調べられるようにする機能です。
アプリ（ブラウザ）を開かなくても、LINE のトーク画面でテキストや画像を送信するだけで完結します。

### 構成要素

- **LINE Messaging API**: ユーザーからのメッセージを受け取り、返信するためのインターフェース
- **Webhook Endpoint (`/api/webhooks/line`)**: LINE サーバーからのイベントを受け取る Next.js の API ルート
- **Supabase**: ユーザー情報、連携情報（`user_integrations`）、解析済みカレンダーデータ（`parsed_pdfs`）の保存
- **Gemini (Google Generative AI)**: 送信された画像やテキストを解析し、適切なゴミ分類を判定

### データフロー

1. ユーザーが LINE Bot にメッセージ（テキストまたは画像）を送信
2. LINE サーバーが Webhook URL (`https://gomicale.jp/api/webhooks/line`) にイベントを POST
3. Webhook エンドポイントで LINE の署名を検証
4. ユーザーの LINE 連携状態を確認（`line_user_id` で Supabase を検索）
5. 連携済みの場合、ユーザーのカレンダーデータ（`parsed_pdfs`）を取得
6. Gemini にカレンダーデータとユーザーのメッセージ（画像含む）を渡し、対象物の名前、ゴミの分類、直近の収集日を判定
7. 判定結果を LINE の Reply API を使ってユーザーに返信

---

## 2. アカウント連携の仕組み

LINE のユーザー ID (`line_user_id`) とゴミカレのユーザー ID (`user_id`) を紐付けるために、**6桁のワンタイムコード**を使用した連携フローを実装しています。

### 連携フロー

1. **コード発行 (ゴミカレ ダッシュボード)**
   - ユーザーがダッシュボードの「LINE連携」セクションで「コードを生成」ボタンを押す
   - `/api/line-link` に POST リクエストが送られ、ランダムな6桁の数字コードが生成される
   - コードは `line_link_codes` テーブルに保存される（有効期限: 10分）

2. **コード送信 (LINE Bot)**
   - ユーザーは生成された6桁のコードをコピーし、LINE Bot のトーク画面に送信する

3. **コード検証と紐付け (Webhook)**
   - Webhook がテキストメッセージを受け取る
   - テキストが6桁の数字のみで構成されている場合、連携コードとみなして `line_link_codes` を検索
   - 有効なコードであれば、`user_integrations` テーブルの対象ユーザーに `line_user_id` を保存
   - 連携完了のメッセージを LINE に返信

---

## 3. 実装の詳細

### データベース設計 (Supabase)

マイグレーションファイル: `20260307000002_add_line_integration.sql`

- **`user_integrations` テーブル (変更)**
  - `line_user_id` (text, unique) カラムを追加
- **`line_link_codes` テーブル (新規)**
  - `id` (uuid)
  - `user_id` (uuid) - 連携元のユーザー
  - `code` (varchar) - 6桁の連携コード
  - `expires_at` (timestamptz) - 有効期限
  - `used_at` (timestamptz) - 使用日時

### ダッシュボード UI

ファイル: `src/app/[locale]/dashboard/LineLinkManager.tsx`

- 連携状態（未連携 / 連携済み）の表示
- コード生成ボタンと、生成された6桁コードの表示
- LINE 公式アカウントへのリンク（友達追加用）
- 連携解除ボタン

### Webhook エンドポイント

ファイル: `src/app/api/webhooks/line/route.ts`

LINE サーバーからのイベントを受け取る中核のファイルです。

1. **署名検証 (`POST` 関数)**
   - `validateSignature` を使用し、リクエストが確実に LINE から送られたものか（`x-line-signature` ヘッダー）を検証します。
2. **イベントの振り分け (`handleMessageEvent` 関数)**
   - イベントタイプが `message` の場合のみ処理します。
3. **連携処理 (6桁コード)**
   - メッセージが6桁の数字の場合、データベースでコードを検証し、`user_integrations` を更新します。
4. **画像処理 (`fetchImageAsBase64` 関数)**
   - メッセージタイプが `image` の場合、LINE Content API から画像バイナリを取得し、Base64 文字列に変換して Gemini に渡せる形式にします。
5. **分類処理 (`classifyWithGemini` 関数)**
   - ユーザーのカレンダーデータをプロンプトに組み込みます。
   - 画像がある場合は、画像データ (`inlineData`) とテキストを組み合わせて Gemini に送信します。
   - Gemini に対して、JSON形式で「対象物の名前 (`itemName`)」「分類 (`category`)」「収集日 (`nextDates`)」を返すよう指示します。
6. **返信処理 (`replyText` 関数)**
   - Gemini からの応答を整形し、LINE の Reply API を呼び出してユーザーにテキストメッセージを返信します。

---

## 4. 今後の拡張アイデア（参考）

現在の実装は「テキストや画像を送ると、ゴミの分類と収集日を教えてくれる」ボットですが、LINE Messaging API の機能を活用すると以下のような拡張が可能です。

- **リッチメニューの追加**: 「今日のゴミ」「明日のゴミ」「設定」などのボタンを画面下部に常時表示する。
- **プッシュ通知 (Push API)**: 「明日は燃えるゴミの日です」のような前日通知を自動で送信する（※Push API の利用には LINE 公式アカウントの料金プランに注意が必要）。
- **Flex Message の活用**: 単なるテキストではなく、アイコンや色を使った視覚的に分かりやすいカード形式で結果を返す。
