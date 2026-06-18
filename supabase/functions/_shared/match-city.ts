import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { matchCityFromAddressText, type CityCandidate } from './city-matcher.ts'

export interface CityRecord extends CityCandidate {
  company_id?: string
  region: string
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

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CityRecord[]
}

export async function resolveCityFromAddress(
  supabase: SupabaseClient,
  address: string,
  region?: string
): Promise<{ city_id: string | null; city_name: string | null; score?: number; method?: string }> {
  const trimmedAddress = address.trim()
  if (!trimmedAddress) {
    return { city_id: null, city_name: null }
  }

  const trimmedRegion = region?.trim()
  const cities = await fetchActiveCities(supabase, trimmedRegion || undefined)
  if (cities.length === 0) {
    return { city_id: null, city_name: null }
  }

  const match = matchCityFromAddressText(cities, trimmedAddress)
  if (!match) {
    return { city_id: null, city_name: null }
  }

  return {
    city_id: match.city.id,
    city_name: match.city.name,
    score: Math.round(match.score * 1000) / 1000,
    method: match.method,
  }
}
