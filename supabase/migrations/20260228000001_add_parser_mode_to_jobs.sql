-- ============================================================
-- jobs テーブルに parser_mode カラムを追加
-- ゴミ出しカレンダー(garbage)と汎用PDF(general)を区別するため
-- ============================================================
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS parser_mode text DEFAULT 'garbage';

COMMENT ON COLUMN public.jobs.parser_mode IS 'PDFの解析モード: "garbage"=ゴミ出しカレンダー, "general"=汎用PDF';
