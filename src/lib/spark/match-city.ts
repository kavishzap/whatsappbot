import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export interface CityMatchResult {
  cityId: string | null
  cityName: string | null
}

interface MatchCityResponse {
  city_id: string | null
  city_name: string | null
}

/** Match a free-text delivery address to a known city via whatsapp-cities (local fuzzy matcher). */
export async function matchCityFromAddress(
  company: WhatsAppCompany,
  address: string,
  region?: string | null
): Promise<CityMatchResult> {
  try {
    const result = await invokeEdgeFunction<MatchCityResponse>('whatsapp-cities', {
      method: 'POST',
      body: {
        company,
        address,
        ...(region?.trim() ? { region: region.trim() } : {}),
      },
    })

    return {
      cityId: result.data?.city_id ?? null,
      cityName: result.data?.city_name ?? null,
    }
  } catch (err) {
    console.error('matchCityFromAddress error:', err)
    return { cityId: null, cityName: null }
  }
}

/** Returns patch fields for draft order — city_id set only when matched, otherwise null. */
export async function buildCityIdPatch(
  company: WhatsAppCompany,
  deliveryAddress: string,
  region?: string | null
): Promise<{ city_id: string | null }> {
  const { cityId } = await matchCityFromAddress(company, deliveryAddress, region)
  return { city_id: cityId }
}
