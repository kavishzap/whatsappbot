export interface CityCandidate {
  id: string
  name: string
}

export interface CityMatchDetail {
  city: CityCandidate
  score: number
  method: 'exact' | 'substring' | 'token' | 'fuzzy'
}

/** Minimum score to accept a match (0–1). */
const MATCH_THRESHOLD = 0.78

/** Best must beat second-best by at least this much when score < 0.95. */
const AMBIGUITY_GAP = 0.1

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter(t => t.length >= 2)
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const row = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) row[j] = j

  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost)
      prev = temp
    }
  }

  return row[b.length]
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  return 1 - levenshtein(a, b) / maxLen
}

function tokenMatchScore(cityToken: string, addressTokens: string[], fullAddress: string): number {
  if (cityToken.length < 3) {
    return addressTokens.includes(cityToken) ? 1 : 0
  }

  let best = similarity(cityToken, fullAddress)

  for (const token of addressTokens) {
    if (token.length < 3) continue
    best = Math.max(best, similarity(cityToken, token))
    if (token.startsWith(cityToken) || cityToken.startsWith(token)) {
      best = Math.max(best, 0.9)
    }
  }

  return best
}

function scoreCity(cityName: string, address: string): { score: number; method: CityMatchDetail['method'] } {
  const normCity = normalize(cityName)
  const normAddr = normalize(address)
  if (!normCity || !normAddr) return { score: 0, method: 'fuzzy' }

  if (normAddr === normCity) {
    return { score: 1, method: 'exact' }
  }

  const padded = ` ${normAddr} `
  if (padded.includes(` ${normCity} `)) {
    return { score: 0.98, method: 'substring' }
  }

  const cityTokens = tokenize(cityName)
  const addressTokens = tokenize(address)
  if (cityTokens.length === 0) return { score: 0, method: 'fuzzy' }

  const allTokensPresent = cityTokens.every(ct =>
    addressTokens.some(at => at === ct || at.includes(ct) || ct.includes(at))
  )
  if (allTokensPresent) {
    return { score: 0.93, method: 'token' }
  }

  let tokenSum = 0
  for (const ct of cityTokens) {
    tokenSum += tokenMatchScore(ct, addressTokens, normAddr)
  }
  const tokenAvg = tokenSum / cityTokens.length

  const fullFuzzy = similarity(normCity, normAddr)
  const slidingBest = bestWindowSimilarity(normCity, normAddr)

  const score = Math.max(tokenAvg * 0.95, fullFuzzy * 0.88, slidingBest * 0.92)
  return { score, method: score >= 0.85 ? 'token' : 'fuzzy' }
}

/** Best similarity of city name against any same-length window in the address. */
function bestWindowSimilarity(city: string, address: string): number {
  if (city.length > address.length) {
    return similarity(city, address)
  }

  let best = 0
  const windowLen = city.length

  for (let size = windowLen; size <= Math.min(city.length + 4, address.length); size++) {
    for (let i = 0; i <= address.length - size; i++) {
      const window = address.slice(i, i + size)
      best = Math.max(best, similarity(city, window))
    }
  }

  return best
}

function expandShortTokens(address: string, cities: CityCandidate[]): string {
  const tokens = tokenize(address)
  const expanded: string[] = []

  for (const token of tokens) {
    if (token.length > 4) {
      expanded.push(token)
      continue
    }

    const prefixMatches = cities.filter(c => normalize(c.name).startsWith(token))
    if (prefixMatches.length === 1) {
      expanded.push(...tokenize(prefixMatches[0].name))
    } else {
      expanded.push(token)
    }
  }

  return expanded.join(' ')
}

export function matchCityFromAddressText(
  cities: CityCandidate[],
  address: string
): CityMatchDetail | null {
  const trimmed = address.trim()
  if (!trimmed || cities.length === 0) return null

  const expandedAddress = expandShortTokens(trimmed, cities)
  const searchAddress = expandedAddress !== trimmed ? `${trimmed} ${expandedAddress}` : trimmed

  const ranked: CityMatchDetail[] = cities.map(city => {
    const { score, method } = scoreCity(city.name, searchAddress)
    return { city, score, method }
  })

  ranked.sort((a, b) => b.score - a.score)

  const best = ranked[0]
  const second = ranked[1]

  if (!best || best.score < MATCH_THRESHOLD) return null

  if (best.score < 0.95 && second && best.score - second.score < AMBIGUITY_GAP) {
    return null
  }

  return best
}
