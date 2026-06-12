-- ============================================================
-- user_integrations に Google Calendar スコープ状態フラグを追加
-- NULL = 未判定（既存ユーザーのデフォルト、ブロックしない）
-- TRUE = calendar.events スコープ取得済み
-- FALSE = calendar.events スコープ欠落（ハードブロック対象）
-- ============================================================
alter table public.user_integrations
  add column if not exists google_calendar_scope_ok boolean;

comment on column public.user_integrations.google_calendar_scope_ok
  is 'Google calendar.events スコープの取得状態。null=未判定、true=取得済み、false=欠落。';
