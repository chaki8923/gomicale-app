-- ============================================================
-- gomicale-app: 初期スキーマ定義
-- ============================================================

-- pgcrypto拡張（トークン暗号化に使用）
create extension if not exists pgcrypto;

-- ============================================================
-- user_integrations: Googleリフレッシュトークン保管テーブル
-- ============================================================
create table if not exists public.user_integrations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  google_refresh_token_enc text,         -- pgp_sym_encrypt で暗号化して保存
  google_access_token_enc  text,         -- 任意: アクセストークンキャッシュ
  token_expires_at         timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint user_integrations_user_id_unique unique (user_id)
);

comment on column public.user_integrations.google_refresh_token_enc is
  'pgp_sym_encrypt(token, app.settings.encryption_key) で暗号化したリフレッシュトークン';

-- ============================================================
-- parsed_pdfs: PDF解析結果キャッシュ（再解析防止）
-- ============================================================
create table if not exists public.parsed_pdfs (
  pdf_hash      text primary key,        -- SHA-256 ハッシュ (hex)
  extracted_json jsonb not null,         -- [{date, type, ...}] の配列
  created_at    timestamptz not null default now()
);

comment on column public.parsed_pdfs.pdf_hash is
  'PDF バイナリの SHA-256 ハッシュ (hex)。同一ファイルの再解析を防ぐキャッシュキー';
comment on column public.parsed_pdfs.extracted_json is
  '解析結果: [{"date": "2026-01-01", "garbage_type": "燃えるゴミ"}, ...]';

-- ============================================================
-- jobs: 非同期ジョブ管理テーブル
-- ============================================================
create type public.job_status as enum ('pending', 'processing', 'completed', 'error');

create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        public.job_status not null default 'pending',
  r2_object_key text not null,           -- R2上のPDFパス (例: uploads/{userId}/{uuid}.pdf)
  pdf_hash      text,                    -- 解析完了後に設定
  result_data   jsonb,                   -- 完了時: {calendar_event_count, ...}
  error_message text,                    -- エラー時の詳細
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.jobs.r2_object_key is 'Cloudflare R2 上のオブジェクトキー';
comment on column public.jobs.status is 'pending → processing → completed | error';

-- updated_at 自動更新トリガー
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_user_integrations_updated_at
  before update on public.user_integrations
  for each row execute procedure public.handle_updated_at();

create trigger trg_jobs_updated_at
  before update on public.jobs
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- インデックス
-- ============================================================
create index if not exists idx_jobs_user_id_status on public.jobs (user_id, status);
create index if not exists idx_jobs_created_at on public.jobs (created_at desc);
