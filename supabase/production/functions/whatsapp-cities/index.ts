import {
  getServiceClient,
  handleOptions,
  jsonResponse,
} from '../_shared/http.ts'
import {
  fetchActiveCities,
  logCityMatchConfirmation,
  resolveCityFromAddress,
} from '../_shared/match-city.ts'

function parseCompany(value: string | null): string | null {
  if (value === 'spark' || value === 'sodamax') return value
  return null
}

function parseRegion(value: string | null): string | null {
  if (!value || !value.trim()) return null

  const normalized = value.trim().toLowerCase()

  if (normalized === 'north') return 'North'
  if (normalized === 'east') return 'East'
  if (normalized === 'south') return 'South'
  if (normalized === 'west') return 'West'
  if (normalized === 'center') return 'Center'

  return null
}

function formatDbError(error: unknown): string {
  if (error instanceof Error) return error.message

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }

  return String(error)
}

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options

  try {
    const supabase = getServiceClient()

    if (req.method === 'POST') {
      let body: {
        company?: string
        region?: string
        address?: string
        phone?: string
        action?: string
        predicted_city_id?: string | null
        confirmed_city_id?: string
        predicted_score?: number | null
        normalized_address?: string | null
        was_correct?: boolean
      }

      try {
        body = await req.json()
      } catch {
        return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400)
      }

      const company = parseCompany(typeof body.company === 'string' ? body.company : null)
      if (!company) {
        return jsonResponse(
          { success: false, error: 'Missing or invalid company (spark|sodamax)' },
          400
        )
      }

      if (body.action === 'confirm_city_match') {
        const address = typeof body.address === 'string' ? body.address.trim() : ''
        const confirmedCityId =
          typeof body.confirmed_city_id === 'string' ? body.confirmed_city_id.trim() : ''

        if (!address || !confirmedCityId) {
          return jsonResponse(
            { success: false, error: 'Missing address or confirmed_city_id' },
            400
          )
        }

        await logCityMatchConfirmation(supabase, {
          raw_address: address,
          normalized_address: body.normalized_address ?? null,
          predicted_city_id: body.predicted_city_id ?? null,
          confirmed_city_id: confirmedCityId,
          predicted_score:
            typeof body.predicted_score === 'number' ? body.predicted_score : null,
          was_correct: body.was_correct === true,
          whatsapp_user_id: typeof body.phone === 'string' ? body.phone : null,
        })

        return jsonResponse({ success: true })
      }

      const region = parseRegion(typeof body.region === 'string' ? body.region : null)
      const address = typeof body.address === 'string' ? body.address.trim() : ''
      const phone = typeof body.phone === 'string' ? body.phone.trim() : null

      if (address.length < 5) {
        return jsonResponse({ success: false, error: 'Address too short' }, 400)
      }

      const match = await resolveCityFromAddress(supabase, address, region ?? undefined, {
        phone,
      })

      console.log('whatsapp-cities match', {
        company,
        region,
        matched: Boolean(match.city_id),
        city_name: match.city_name,
        score: match.score ?? null,
        confidence: match.confidence ?? null,
        method: match.method ?? null,
      })

      return jsonResponse({
        success: true,
        data: match,
      })
    }

    if (req.method !== 'GET') {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405)
    }

    const url = new URL(req.url)
    const company = parseCompany(url.searchParams.get('company'))
    const region = parseRegion(url.searchParams.get('region'))

    if (!company) {
      return jsonResponse(
        { success: false, error: 'Missing or invalid company (spark|sodamax)' },
        400
      )
    }

    const data = await fetchActiveCities(supabase, region ?? undefined)

    return jsonResponse({
      success: true,
      data,
    })
  } catch (error) {
    console.error('whatsapp-cities error:', error)

    return jsonResponse(
      {
        success: false,
        error: formatDbError(error),
      },
      500
    )
  }
})
