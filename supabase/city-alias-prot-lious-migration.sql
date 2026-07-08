-- Optional learned alias for common Port Louis transposition typo.
-- Primary matching is handled in city-matcher.ts (Damerau-Levenshtein).

INSERT INTO public.city_aliases (city_id, alias, normalized_alias, source)
SELECT
  c.id,
  'Prot Lious',
  'prot lious',
  'manual'
FROM public.cities c
WHERE lower(trim(c.name)) = lower('Port Louis')
  AND NOT EXISTS (
    SELECT 1
    FROM public.city_aliases a
    WHERE a.city_id = c.id
      AND lower(trim(a.normalized_alias)) = 'prot lious'
  );
