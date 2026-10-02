-- translation_cache_lookup_idx is an exact duplicate of the
-- unique constraint-backed index on (entity_type, entity_id, target_lang).
-- The unique index already supports lookup queries and enforces uniqueness.
DROP INDEX IF EXISTS public.translation_cache_lookup_idx;