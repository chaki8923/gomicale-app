-- user_streaks: ゴミ分別の連続利用記録を管理するテーブル
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak       INTEGER     NOT NULL DEFAULT 0,
  longest_streak       INTEGER     NOT NULL DEFAULT 0,
  last_active_date     DATE,
  total_classifications INTEGER    NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- 本人のみ参照可能
CREATE POLICY "Users can read own streaks"
  ON public.user_streaks FOR SELECT
  USING (auth.uid() = user_id);

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_streaks_updated_at
  BEFORE UPDATE ON public.user_streaks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
