-- ============================================================
-- LINE連携: user_integrationsにline_user_idを追加
-- line_link_codes: 連携コード一時テーブル
-- ============================================================

-- user_integrations に LINE ユーザーID を追加
alter table public.user_integrations
  add column if not exists line_user_id text unique;

comment on column public.user_integrations.line_user_id is 'LINE の userId（Uxxxxxxxx... 形式）';

create index if not exists idx_user_integrations_line_user_id
  on public.user_integrations (line_user_id);

-- ============================================================
-- line_link_codes: LINEアカウント連携用の一時コードテーブル
-- ============================================================

create table if not exists public.line_link_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  code       text not null unique,   -- 6桁数字コード
  expires_at timestamptz not null,   -- 発行から10分後
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.line_link_codes is 'LINEアカウント連携用の一時コード。ユーザーがLINE Botにコードを送信すると消費される。';
comment on column public.line_link_codes.code is '6桁の数字コード。ユーザーがLINE Botに送信する。';
comment on column public.line_link_codes.expires_at is '発行から10分後に失効';

create index if not exists idx_line_link_codes_user_id on public.line_link_codes (user_id);
create index if not exists idx_line_link_codes_code    on public.line_link_codes (code);

-- RLS
alter table public.line_link_codes enable row level security;

-- ユーザーは自分のコードのみ参照・作成・削除可
create policy "line_link_codes: select own"
  on public.line_link_codes for select
  using (auth.uid() = user_id);

create policy "line_link_codes: insert own"
  on public.line_link_codes for insert
  with check (auth.uid() = user_id);

create policy "line_link_codes: delete own"
  on public.line_link_codes for delete
  using (auth.uid() = user_id);
