-- Optional Hindi product FAQ copy; existing FAQ records and policies unchanged.
ALTER TABLE public.product_faqs
  ADD COLUMN IF NOT EXISTS question_hi text,
  ADD COLUMN IF NOT EXISTS answer_hi text;
