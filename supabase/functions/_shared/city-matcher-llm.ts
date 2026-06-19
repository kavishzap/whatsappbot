import {
  matchCityFromAddressText,
  toLlmMatchDetail,
  type CityCandidate,
  type CityMatchDetail,
  type CityMatchOptions,
} from './city-matcher.ts'

interface LlmMatchResponse {
  city_name?: string | null
  confidence?: number
}

function normalizeCityName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function findCityByName(cities: CityCandidate[], name: string): CityCandidate | null {
  const target = normalizeCityName(name)
  if (!target) return null

  const exact = cities.find(city => normalizeCityName(city.name) === target)
  if (exact) return exact

  const contains = cities.filter(city => {
    const normalized = normalizeCityName(city.name)
    return normalized.includes(target) || target.includes(normalized)
  })

  return contains.length === 1 ? contains[0] : null
}

/**
 * Optional OpenAI fallback when fuzzy matching fails or is ambiguous.
 * Set OPENAI_API_KEY on the edge function to enable.
 */
export async function matchCityWithLlm(
  cities: CityCandidate[],
  address: string,
  options?: CityMatchOptions
): Promise<CityMatchDetail | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
  if (!apiKey || cities.length === 0) return null

  const model = Deno.env.get('OPENAI_CITY_MATCH_MODEL')?.trim() || 'gpt-4o-mini'
  const regionHint = options?.regionHint?.trim()

  const cityLines = cities
    .map(city => (city.region ? `- ${city.name} (${city.region})` : `- ${city.name}`))
    .join('\n')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You map Mauritius delivery addresses to exactly one city from the provided list.',
            'Return JSON only: {"city_name": string|null, "confidence": number}',
            'Pick the locality/town (e.g. Quatre Bornes, Curepipe), not street or avenue names.',
            'If unsure or the city is not in the list, return city_name null and confidence 0.',
            'city_name must match a list entry exactly (same spelling).',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            regionHint ? `Delivery region hint: ${regionHint}` : 'Delivery region hint: unknown',
            `Address: ${address}`,
            'Cities:',
            cityLines,
          ].join('\n'),
        },
      ],
    }),
  })

  if (!response.ok) {
    console.error('city-matcher-llm HTTP error:', response.status, await response.text())
    return null
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string') return null

  let parsed: LlmMatchResponse
  try {
    parsed = JSON.parse(content) as LlmMatchResponse
  } catch {
    console.error('city-matcher-llm invalid JSON:', content)
    return null
  }

  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0
  const cityName = typeof parsed.city_name === 'string' ? parsed.city_name.trim() : ''
  if (!cityName || confidence < 0.55) return null

  const city = findCityByName(cities, cityName)
  if (!city) return null

  return toLlmMatchDetail({
    city,
    score: Math.min(1, Math.max(0.55, confidence)),
    method: 'fuzzy',
  })
}

/** Fuzzy first; LLM only when fuzzy returns nothing. */
export async function matchCityHybrid(
  cities: CityCandidate[],
  address: string,
  options?: CityMatchOptions
): Promise<CityMatchDetail | null> {
  const fuzzy = matchCityFromAddressText(cities, address, options)
  if (fuzzy) return fuzzy

  try {
    return await matchCityWithLlm(cities, address, options)
  } catch (error) {
    console.error('city-matcher-llm error:', error)
    return null
  }
}
