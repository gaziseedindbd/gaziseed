-- Store optional per-language FAQ copy for Ads landing pages.
-- Existing Bengali FAQ fields and data remain unchanged.
ALTER TABLE public.landing_faqs
  ADD COLUMN IF NOT EXISTS question_en text,
  ADD COLUMN IF NOT EXISTS answer_en text,
  ADD COLUMN IF NOT EXISTS question_hi text,
  ADD COLUMN IF NOT EXISTS answer_hi text;
