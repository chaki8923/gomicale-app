-- ============================================================
-- api_keys: 外部API連携用のAPIキー管理テーブル
-- ============================================================

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  key_hash     text not null,   -- SHA-256(api_key) を hex で保存
  name         text,            -- 例: "LINE用", "Apps Script用"
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  constraint api_keys_key_hash_unique unique (key_hash)
);

comment on table public.api_keys is 'ユーザーが発行した外部連携用APIキーのハッシュを管理するテーブル。平文のキーは保存しない。';
comment on column public.api_keys.key_hash is 'SHA-256(api_key) の hex 文字列';

create index if not exists idx_api_keys_key_hash on public.api_keys (key_hash);
create index if not exists idx_api_keys_user_id  on public.api_keys (user_id);

-- RLS
alter table public.api_keys enable row level security;

create policy "api_keys: select own"
  on public.api_keys for select
  using (auth.uid() = user_id);

create policy "api_keys: insert own"
  on public.api_keys for insert
  with check (auth.uid() = user_id);

create policy "api_keys: delete own"
  on public.api_keys for delete
  using (auth.uid() = user_id);
