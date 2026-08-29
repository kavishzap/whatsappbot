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

type CityAliasRow = {
  city_id: string
  alias: string
  normalized_alias: string | null
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

async function fetchCityAliasMap(supabase: SupabaseClient): Promise<Map<string, string[]>> {
  const { data, error } = await supabase
    .from('city_aliases')
    .select('city_id, alias, normalized_alias')

  if (error) {
    console.error('fetchCityAliasMap failed:', error.message)
    return new Map()
  }

  const map = new Map<string, string[]>()
  for (const row of (data ?? []) as CityAliasRow[]) {
    if (!row.city_id) continue
    const normalized = row.normalized_alias?.trim() || row.alias?.trim()
    if (!normalized) continue

    const existing = map.get(row.city_id) ?? []
    existing.push(normalized.toLowerCase())
    map.set(row.city_id, existing)
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

  const [{ data, error }, zoneMap, aliasMap] = await Promise.all([
    query,
    fetchCityZoneMap(supabase),
    fetchCityAliasMap(supabase),
  ])
  if (error) throw error

  return ((data ?? []) as CityRecord[]).map(city => ({
    ...city,
    zone_name: zoneMap.get(city.id) ?? null,
    aliases: aliasMap.get(city.id) ?? [],
  }))
}

export type ResolvedCityMatch = {
  city_id: string | null
  city_name: string | null
  zone_name?: string | null
  score?: number
  confidence?: 'auto_accept' | 'confirm' | 'reject'
  method?: string
  alternatives?: Array<{
    city_id: string
    city_name: string
    region: string
    score: number
  }>
}

async function logCityMatch(
  supabase: SupabaseClient,
  payload: {
    raw_address: string
    normalized_address: string
    predicted_city_id: string | null
    predicted_score: number | null
    whatsapp_user_id?: string | null
  }
): Promise<void> {
  const { error } = await supabase.from('city_match_logs').insert({
    raw_address: payload.raw_address,
    normalized_address: payload.normalized_address,
    predicted_city_id: payload.predicted_city_id,
    predicted_score: payload.predicted_score,
    whatsapp_user_id: payload.whatsapp_user_id ?? null,
  })

  if (error) {
    console.error('city_match_logs insert failed:', error.message)
  }
}

export async function logCityMatchConfirmation(
  supabase: SupabaseClient,
  payload: {
    raw_address: string
    normalized_address?: string | null
    predicted_city_id?: string | null
    confirmed_city_id: string
    predicted_score?: number | null
    was_correct: boolean
    whatsapp_user_id?: string | null
  }
): Promise<void> {
  const { error } = await supabase.from('city_match_logs').insert({
    raw_address: payload.raw_address,
    normalized_address: payload.normalized_address ?? null,
    predicted_city_id: payload.predicted_city_id ?? null,
    confirmed_city_id: payload.confirmed_city_id,
    predicted_score: payload.predicted_score ?? null,
    was_correct: payload.was_correct,
    whatsapp_user_id: payload.whatsapp_user_id ?? null,
  })

  if (error) {
    console.error('city_match_logs confirm insert failed:', error.message)
  }
}

export async function resolveCityFromAddress(
  supabase: SupabaseClient,
  address: string,
  region?: string,
  options?: { phone?: string | null }
): Promise<ResolvedCityMatch> {
  const trimmedAddress = address.trim()
  if (!trimmedAddress) {
    return { city_id: null, city_name: null, confidence: 'reject' }
  }

  const trimmedRegion = region?.trim()
  const cities = await fetchActiveCities(supabase, trimmedRegion || undefined)
  if (cities.length === 0) {
    return { city_id: null, city_name: null, confidence: 'reject' }
  }

  const outcome = matchCityHybrid(cities, trimmedAddress, {
    regionHint: trimmedRegion || undefined,
  })

  void logCityMatch(supabase, {
    raw_address: trimmedAddress,
    normalized_address: outcome.normalizedAddress,
    predicted_city_id: outcome.best?.city.id ?? null,
    predicted_score: outcome.best?.score ?? null,
    whatsapp_user_id: options?.phone ?? null,
  })

  if (!outcome.best) {
    return {
      city_id: null,
      city_name: null,
      confidence: 'reject',
      alternatives: outcome.alternatives.map(item => ({
        city_id: item.city.id,
        city_name: item.city.name,
        region: item.city.region ?? '',
        score: item.score,
      })),
    }
  }

  const matchedCity = cities.find(city => city.id === outcome.best!.city.id)

  return {
    city_id: outcome.best.confidence === 'reject' ? null : outcome.best.city.id,
    city_name: outcome.best.city.name,
    zone_name: matchedCity?.zone_name ?? null,
    score: outcome.best.score,
    confidence: outcome.best.confidence,
    method: outcome.best.method,
    alternatives: outcome.alternatives
      .filter(item => item.city.id !== outcome.best!.city.id)
      .map(item => ({
        city_id: item.city.id,
        city_name: item.city.name,
        region: item.city.region ?? '',
        score: item.score,
      })),
  }
}
