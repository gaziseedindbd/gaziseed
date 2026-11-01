ALTER TABLE public.combo_packs
  ADD COLUMN IF NOT EXISTS landing_type text NOT NULL DEFAULT 'combo';

ALTER TABLE public.combo_packs
  DROP CONSTRAINT IF EXISTS combo_packs_landing_type_check;

ALTER TABLE public.combo_packs
  ADD CONSTRAINT combo_packs_landing_type_check
  CHECK (landing_type IN ('combo', 'seed_landing'));

CREATE INDEX IF NOT EXISTS idx_combo_packs_country_landing_type_active
  ON public.combo_packs (country_code, landing_type, is_active);
