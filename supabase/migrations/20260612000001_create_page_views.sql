-- page_views: ページビュー計測（donate 等）。Vercel Analytics の保持制限を補うため DB に永続化
CREATE TABLE IF NOT EXISTS public.page_views (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  path         TEXT        NOT NULL,
  locale       TEXT,
  device_type  TEXT        NOT NULL DEFAULT 'unknown',
  os           TEXT,
  browser      TEXT,
  referrer     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS page_views_path_created_at_idx
  ON public.page_views (path, created_at DESC);

CREATE INDEX IF NOT EXISTS page_views_device_type_idx
  ON public.page_views (device_type);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.page_views IS 'Anonymous page view events; insert via service role only';
COMMENT ON COLUMN public.page_views.device_type IS 'mobile | tablet | desktop | unknown';
