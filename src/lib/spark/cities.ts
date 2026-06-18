import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export interface WhatsAppCity {
  id: string
  company_id: string
  name: string
  region: string
}

const CACHE_TTL_MS = 5 * 60_000
const cache = new Map<string, { data: WhatsAppCity[]; at: number }>()

function cacheKey(company: WhatsAppCompany, region?: string): string {
  return `${company}:${region ?? '*'}`
}

function getCached(company: WhatsAppCompany, region?: string): WhatsAppCity[] | null {
  const hit = cache.get(cacheKey(company, region))
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return null
  return hit.data
}

function setCached(company: WhatsAppCompany, region: string | undefined, data: WhatsAppCity[]): void {
  cache.set(cacheKey(company, region), { data, at: Date.now() })
}

export async function fetchCities(
  company: WhatsAppCompany,
  region?: string
): Promise<WhatsAppCity[]> {
  const cached = getCached(company, region)
  if (cached) return cached

  const result = await invokeEdgeFunction<WhatsAppCity[]>('whatsapp-cities', {
    query: {
      company,
      ...(region ? { region } : {}),
    },
  })

  const data = result.data ?? []
  setCached(company, region, data)
  return data
}

export function findCityInList(cities: WhatsAppCity[], cityId: string): WhatsAppCity | null {
  return cities.find(c => c.id === cityId) ?? null
}

export async function findCityById(
  company: WhatsAppCompany,
  region: string,
  cityId: string
): Promise<WhatsAppCity | null> {
  const cached = getCached(company, region)
  if (cached) return findCityInList(cached, cityId)

  const cities = await fetchCities(company, region)
  return findCityInList(cities, cityId)
}
