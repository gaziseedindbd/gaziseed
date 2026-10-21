-- Keep promotional popup content branch-aware and support storefront-localized
-- copy plus a configurable, validated display delay.
ALTER TABLE public.promotional_popups
  ADD COLUMN IF NOT EXISTS localized_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS display_delay integer NOT NULL DEFAULT 3;

UPDATE public.promotional_popups
SET localized_content = '{}'::jsonb
WHERE localized_content IS NULL OR jsonb_typeof(localized_content) <> 'object';

UPDATE public.promotional_popups
SET display_delay = 3
WHERE display_delay IS NULL OR display_delay < 0 OR display_delay > 30;

ALTER TABLE public.promotional_popups
  ALTER COLUMN localized_content SET DEFAULT '{}'::jsonb,
  ALTER COLUMN localized_content SET NOT NULL,
  ALTER COLUMN display_delay SET DEFAULT 3,
  ALTER COLUMN display_delay SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'promotional_popups_localized_content_object'
      AND conrelid = 'public.promotional_popups'::regclass
  ) THEN
    ALTER TABLE public.promotional_popups
      ADD CONSTRAINT promotional_popups_localized_content_object
      CHECK (jsonb_typeof(localized_content) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'promotional_popups_display_delay_range'
      AND conrelid = 'public.promotional_popups'::regclass
  ) THEN
    ALTER TABLE public.promotional_popups
      ADD CONSTRAINT promotional_popups_display_delay_range
      CHECK (display_delay BETWEEN 0 AND 30);
  END IF;
END;
$$;
