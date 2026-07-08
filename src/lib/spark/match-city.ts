import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export type CityMatchConfidence = 'auto_accept' | 'confirm' | 'reject'

export interface CityAlternative {
  city_id: string
  city_name: string
  region: string
  score: number
}

export interface CityMatchResult {
  cityId: string | null
  cityName: string | null
  zoneName?: string | null
  score?: number
  confidence: CityMatchConfidence
  method?: string
  alternatives: CityAlternative[]
}

interface MatchCityResponse {
  city_id: string | null
  city_name: string | null
  zone_name?: string | null
  score?: number
  confidence?: CityMatchConfidence
  method?: string
  alternatives?: CityAlternative[]
}

function normalizeMatchResponse(data?: MatchCityResponse | null): CityMatchResult {
  return {
    cityId: data?.city_id ?? null,
    cityName: data?.city_name ?? null,
    zoneName: data?.zone_name ?? null,
    score: data?.score,
    confidence: data?.confidence ?? (data?.city_id ? 'auto_accept' : 'reject'),
    method: data?.method,
    alternatives: data?.alternatives ?? [],
  }
}

/** Match a free-text delivery address to a known city (hybrid fuzzy + aliases). */
export async function matchCityFromAddress(
  company: WhatsAppCompany,
  address: string,
  region?: string | null,
  phone?: string | null
): Promise<CityMatchResult> {
  try {
    const result = await invokeEdgeFunction<MatchCityResponse>('whatsapp-cities', {
      method: 'POST',
      body: {
        company,
        address,
        ...(region?.trim() ? { region: region.trim() } : {}),
        ...(phone?.trim() ? { phone: phone.trim() } : {}),
      },
    })

    return normalizeMatchResponse(result.data)
  } catch (err) {
    console.error('matchCityFromAddress error:', err)
    return {
      cityId: null,
      cityName: null,
      confidence: 'reject',
      alternatives: [],
    }
  }
}

/** Returns patch fields for draft order — city_id when matched, otherwise null. */
export async function buildCityIdPatch(
  company: WhatsAppCompany,
  deliveryAddress: string,
  region?: string | null,
  phone?: string | null
): Promise<{ city_id: string | null }> {
  const match = await matchCityFromAddress(company, deliveryAddress, region, phone)
  return { city_id: match.cityId ?? null }
}
