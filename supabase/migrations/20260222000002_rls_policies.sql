-- ============================================================
-- gomicale-app: RLS (Row Level Security) ポリシー定義
-- ============================================================

-- ============================================================
-- user_integrations RLS
-- ============================================================
alter table public.user_integrations enable row level security;

-- 自分のレコードのみ参照可能
create policy "user_integrations: select own"
  on public.user_integrations for select
  using (auth.uid() = user_id);

-- 自分のレコードのみ作成可能
create policy "user_integrations: insert own"
  on public.user_integrations for insert
  with check (auth.uid() = user_id);

-- 自分のレコードのみ更新可能
create policy "user_integrations: update own"
  on public.user_integrations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 自分のレコードのみ削除可能
create policy "user_integrations: delete own"
  on public.user_integrations for delete
  using (auth.uid() = user_id);

-- ============================================================
-- parsed_pdfs RLS
-- ※ キャッシュテーブルのため認証済みユーザーは全員参照可。
--   書き込みは Service Role (Lambda) のみ許可。
-- ============================================================
alter table public.parsed_pdfs enable row level security;

-- 認証済みユーザーは参照のみ可
create policy "parsed_pdfs: select authenticated"
  on public.parsed_pdfs for select
  to authenticated
  using (true);

-- INSERT/UPDATE は Service Role のみ（ポリシーなし = Service Role key のみ通過）
-- （Lambda は SUPABASE_SERVICE_ROLE_KEY を使用するため RLS をバイパスする）

-- ============================================================
-- jobs RLS
-- ============================================================
alter table public.jobs enable row level security;

-- 自分のジョブのみ参照可能
create policy "jobs: select own"
  on public.jobs for select
  using (auth.uid() = user_id);

-- 自分のジョブのみ作成可能
create policy "jobs: insert own"
  on public.jobs for insert
  with check (auth.uid() = user_id);

-- 自分のジョブのみ更新可能（Next.jsフロントからの操作想定）
create policy "jobs: update own"
  on public.jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Realtime: jobsテーブルのリアルタイムを有効化
-- ============================================================
-- Supabase Dashboard の Database > Replication で
-- 対象テーブルに jobs を追加してください。
-- CLI で行う場合は以下のコマンドを参照:
--   supabase realtime enable public.jobs
-- ============================================================
