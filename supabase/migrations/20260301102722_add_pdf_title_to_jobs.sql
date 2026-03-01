-- ============================================================
-- jobs テーブルに pdf_title カラムを追加
-- ============================================================
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pdf_title text;

COMMENT ON COLUMN public.jobs.pdf_title IS 'PDFから抽出されたタイトル';
