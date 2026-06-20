import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { matchCityHybrid } from './city-matcher-llm.ts'
import type { CityCandidate } from './city-matcher.ts'

export interface CityRecord extends CityCandidate {
  company_id?: string
  region: string
  zone_name?: string | null
}

type ZoneCityRow = {
  city_id: string
  sort_order: number
  zones: { name: string; is_active: boolean } | { name: string; is_active: boolean }[] | null
}

async function fetchCityZoneMap(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('zone_cities')
    .select('city_id, sort_order, zones!inner(name, is_active)')
    .order('sort_order', { ascending: true })

  if (error) throw error

  const map = new Map<string, string>()
  for (const row of (data ?? []) as ZoneCityRow[]) {
    if (!row.city_id || map.has(row.city_id)) continue

    const zone = Array.isArray(row.zones) ? row.zones[0] : row.zones
    if (!zone?.is_active) continue

    const name = zone.name?.trim()
    if (name) map.set(row.city_id, name)
  }

  return map
}

export async function fetchActiveCities(
  supabase: SupabaseClient,
  region?: string
): Promise<CityRecord[]> {
  let query = supabase
    .from('cities')
    .select('id, company_id, name, region')
    .eq('is_active', true)
    .not('region', 'is', null)
    .neq('region', '')
    .order('region', { ascending: true })
    .order('name', { ascending: true })

  if (region) {
    query = query.eq('region', region)
  }

  const [{ data, error }, zoneMap] = await Promise.all([query, fetchCityZoneMap(supabase)])
  if (error) throw error

  return ((data ?? []) as CityRecord[]).map(city => ({
    ...city,
    zone_name: zoneMap.get(city.id) ?? null,
  }))
}

export async function resolveCityFromAddress(
  supabase: SupabaseClient,
  address: string,
  region?: string
): Promise<{
  city_id: string | null
  city_name: string | null
  zone_name?: string | null
  score?: number
  method?: string
}> {
  const trimmedAddress = address.trim()
  if (!trimmedAddress) {
    return { city_id: null, city_name: null }
  }

  const trimmedRegion = region?.trim()
  const cities = await fetchActiveCities(supabase, trimmedRegion || undefined)
  if (cities.length === 0) {
    return { city_id: null, city_name: null }
  }

  const match = await matchCityHybrid(cities, trimmedAddress, {
    regionHint: trimmedRegion || undefined,
  })
  if (!match) {
    return { city_id: null, city_name: null }
  }

  const matchedCity = cities.find(city => city.id === match.city.id)

  return {
    city_id: match.city.id,
    city_name: match.city.name,
    zone_name: matchedCity?.zone_name ?? null,
    score: Math.round(match.score * 1000) / 1000,
    method: match.method,
  }
}
