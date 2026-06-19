export interface CityCandidate {
  id: string
  name: string
  region?: string
}

export interface CityMatchDetail {
  city: CityCandidate
  score: number
  method: 'exact' | 'substring' | 'token' | 'fuzzy' | 'segment' | 'llm'
}

export interface CityMatchOptions {
  /** User-selected delivery region — narrows candidates and relaxes ambiguity checks. */
  regionHint?: string
}

/** Minimum score to accept a match (0–1). */
const MATCH_THRESHOLD = 0.74

/** Best must beat second-best by at least this much when score < 0.95. */
const AMBIGUITY_GAP = 0.08

/** Substitutions that sound/behave alike in Mauritius place names (speech + spelling typos). */
const RELAXED_CHAR_GROUPS = [
  'aeiouy',
  'gkhq',
  'szc',
  'dt',
  'bp',
  'mn',
  'fv',
  'lr',
  'w',
  'jx',
]

function charsRelaxedEqual(a: string, b: string): boolean {
  if (a === b) return true
  for (const group of RELAXED_CHAR_GROUPS) {
    if (group.includes(a) && group.includes(b)) return true
  }
  return false
}

const NOISE_TOKENS = new Set([
  'avenue',
  'av',
  'ave',
  'road',
  'rd',
  'rue',
  'street',
  'st',
  'lane',
  'ln',
  'drive',
  'dr',
  'highway',
  'hwy',
  'morcellement',
  'morcelment',
  'morc',
  'building',
  'bldg',
  'block',
  'blk',
  'lot',
  'near',
  'opp',
  'opposite',
  'phase',
  'zone',
  'mauritius',
  'mu',
  'republic',
  'poste',
  'post',
  'code',
  'postal',
  'flat',
  'apt',
  'apartment',
  'house',
  'no',
  'num',
  'number',
])

/** Common Mauritius locality abbreviations → normalized tokens. */
const ADDRESS_ALIASES: Record<string, string> = {
  qb: 'quatre bornes',
  'q bornes': 'quatre bornes',
  '4 bornes': 'quatre bornes',
  'quatre borne': 'quatre bornes',
  pl: 'port louis',
  'pt louis': 'port louis',
  'p louis': 'port louis',
  vp: 'vacoas phoenix',
  'vacoas phoenix': 'vacoas phoenix',
  'vacoas': 'vacoas phoenix',
  'phoenix': 'vacoas phoenix',
  bbrh: 'beau bassin rose hill',
  'bb rh': 'beau bassin rose hill',
  'beau bassin': 'beau bassin rose hill',
  'rose hill': 'beau bassin rose hill',
  cp: 'curepipe',
  'st pierre': 'saint pierre',
  'st paul': 'saint paul',
  'st julien': 'saint julien',
  'st hubert': 'saint hubert',
  'st aubin': 'saint aubin',
  'ste croix': 'sainte croix',
  'st louis': 'saint louis',
}

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
    .filter(t => t.length >= 2 && !NOISE_TOKENS.has(t))
}

function applyAddressAliases(text: string): string {
  let result = normalize(text)
  if (!result) return result

  const sortedAliases = Object.entries(ADDRESS_ALIASES).sort((a, b) => b[0].length - a[0].length)
  for (const [alias, canonical] of sortedAliases) {
    const pattern = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'g')
    result = result.replace(pattern, canonical)
  }

  return result
}

function stripNoise(text: string): string {
  return tokenize(text).join(' ')
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

/** Edit distance with lower penalty for phonetically similar character swaps. */
function relaxedLevenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const rows = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))

  for (let i = 0; i <= a.length; i++) rows[i][0] = i
  for (let j = 0; j <= b.length; j++) rows[0][j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const subCost = charsRelaxedEqual(a[i - 1], b[j - 1]) ? 0.35 : 1
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : subCost)
      )
    }
  }

  return rows[a.length][b.length]
}

function trigrams(text: string): Set<string> {
  const padded = `  ${text} `
  const grams = new Set<string>()
  for (let i = 0; i < padded.length - 2; i++) {
    grams.add(padded.slice(i, i + 3))
  }
  return grams
}

function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1

  const ta = trigrams(a)
  const tb = trigrams(b)
  if (ta.size === 0 || tb.size === 0) return 0

  let intersection = 0
  for (const gram of ta) {
    if (tb.has(gram)) intersection++
  }

  return (2 * intersection) / (ta.size + tb.size)
}

function consonantSkeleton(text: string): string {
  return normalize(text)
    .replace(/[aeiouy\s]/g, '')
    .replace(/(.)\1+/g, '$1')
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  return 1 - levenshtein(a, b) / maxLen
}

function relaxedSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  return 1 - relaxedLevenshtein(a, b) / maxLen
}

/** Jaro-Winkler — better for person/place names with prefix typos. */
function jaroWinkler(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1

  const matchDistance = Math.max(Math.floor(Math.max(a.length, b.length) / 2) - 1, 0)
  const aMatches = new Array<boolean>(a.length).fill(false)
  const bMatches = new Array<boolean>(b.length).fill(false)

  let matches = 0
  let transpositions = 0

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance)
    const end = Math.min(i + matchDistance + 1, b.length)

    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue
      aMatches[i] = true
      bMatches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0

  let k = 0
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue
    while (!bMatches[k]) k++
    if (a[i] !== b[k]) transpositions++
    k++
  }

  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3

  let prefix = 0
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++
    else break
  }

  return jaro + prefix * 0.1 * (1 - jaro)
}

function blendedSimilarity(a: string, b: string): number {
  const skeletonA = consonantSkeleton(a)
  const skeletonB = consonantSkeleton(b)

  return Math.max(
    similarity(a, b),
    relaxedSimilarity(a, b),
    jaroWinkler(a, b) * 0.98,
    trigramSimilarity(a, b),
    skeletonA && skeletonB ? jaroWinkler(skeletonA, skeletonB) * 0.95 : 0,
    skeletonA && skeletonB ? relaxedSimilarity(skeletonA, skeletonB) : 0
  )
}

function buildAddressTokenVariants(tokens: string[]): string[] {
  const variants = new Set<string>()

  for (const token of tokens) {
    variants.add(token)
  }

  for (let i = 0; i < tokens.length - 1; i++) {
    variants.add(`${tokens[i]} ${tokens[i + 1]}`)
    variants.add(`${tokens[i]}${tokens[i + 1]}`)
  }

  if (tokens.length > 0) {
    variants.add(tokens.join(' '))
    variants.add(tokens.join(''))
  }

  return [...variants]
}

/** Match each city token to its best address token (handles split/join typos). */
function alignedTokenScore(cityTokens: string[], addressTokens: string[]): number {
  if (cityTokens.length === 0) return 0

  const variants = buildAddressTokenVariants(addressTokens)
  let total = 0

  for (const cityToken of cityTokens) {
    let best = 0
    for (const variant of variants) {
      best = Math.max(best, blendedSimilarity(cityToken, variant))
      if (variant.includes(' ') || variant.length >= cityToken.length) {
        best = Math.max(best, bestWindowSimilarity(cityToken, variant))
      }
    }
    total += best
  }

  return total / cityTokens.length
}

function tokenMatchScore(cityToken: string, addressTokens: string[], fullAddress: string): number {
  if (cityToken.length < 3) {
    return addressTokens.includes(cityToken) ? 1 : 0
  }

  let best = blendedSimilarity(cityToken, fullAddress)

  for (const token of addressTokens) {
    if (token.length < 3) continue
    best = Math.max(best, blendedSimilarity(cityToken, token))
    if (token.startsWith(cityToken) || cityToken.startsWith(token)) {
      best = Math.max(best, 0.92)
    }
  }

  return best
}

function bestWindowSimilarity(city: string, address: string): number {
  if (city.length > address.length) {
    return blendedSimilarity(city, address)
  }

  let best = 0
  const windowLen = city.length

  for (let size = windowLen; size <= Math.min(city.length + 6, address.length); size++) {
    for (let i = 0; i <= address.length - size; i++) {
      const window = address.slice(i, i + size)
      best = Math.max(best, blendedSimilarity(city, window))
    }
  }

  return best
}

function scoreCityCore(
  cityName: string,
  address: string
): { score: number; method: CityMatchDetail['method'] } {
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

  const collapsedCity = normCity.replace(/\s+/g, '')
  const collapsedAddr = normAddr.replace(/\s+/g, '')
  if (collapsedCity.length >= 5 && collapsedAddr.length >= 5) {
    const collapsedScore = blendedSimilarity(collapsedCity, collapsedAddr)
    if (collapsedScore >= 0.88) {
      return { score: Math.min(1, collapsedScore * 0.98), method: 'fuzzy' }
    }
  }

  const allTokensPresent = cityTokens.every(ct =>
    addressTokens.some(at => {
      if (at === ct || at.includes(ct) || ct.includes(at)) return true
      return blendedSimilarity(ct, at) >= 0.82
    })
  )
  if (allTokensPresent) {
    return { score: 0.94, method: 'token' }
  }

  const tokenAvg = alignedTokenScore(cityTokens, addressTokens)
  const fullFuzzy = blendedSimilarity(normCity, normAddr)
  const slidingBest = bestWindowSimilarity(normCity, normAddr)

  const score = Math.max(tokenAvg * 0.98, fullFuzzy * 0.92, slidingBest * 0.96)
  return { score, method: score >= 0.82 ? 'token' : 'fuzzy' }
}

function splitAddressSegments(address: string): string[] {
  return address
    .split(/[,;\n]/)
    .map(segment => segment.trim())
    .filter(Boolean)
}

function scoreCity(cityName: string, address: string): { score: number; method: CityMatchDetail['method'] } {
  const preparedAddress = applyAddressAliases(stripNoise(address))
  if (!preparedAddress) return { score: 0, method: 'fuzzy' }

  const segments = splitAddressSegments(address)
  let best = scoreCityCore(cityName, preparedAddress)

  if (segments.length <= 1) {
    return best
  }

  for (let i = 0; i < segments.length; i++) {
    const segment = applyAddressAliases(stripNoise(segments[i]))
    if (!segment) continue

    const segmentScore = scoreCityCore(cityName, segment)
    const positionWeight = i === segments.length - 1 ? 1.18 : i === segments.length - 2 ? 1.08 : 1
    const weightedScore = Math.min(1, segmentScore.score * positionWeight)

    if (weightedScore > best.score) {
      best = {
        score: weightedScore,
        method: segmentScore.method === 'exact' || segmentScore.method === 'substring'
          ? 'segment'
          : segmentScore.method,
      }
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

    const alias = ADDRESS_ALIASES[token]
    if (alias) {
      expanded.push(...tokenize(alias))
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

function resolveThresholds(options?: CityMatchOptions): { threshold: number; ambiguityGap: number } {
  if (options?.regionHint) {
    return { threshold: 0.72, ambiguityGap: 0.06 }
  }
  return { threshold: MATCH_THRESHOLD, ambiguityGap: AMBIGUITY_GAP }
}

export function matchCityFromAddressText(
  cities: CityCandidate[],
  address: string,
  options?: CityMatchOptions
): CityMatchDetail | null {
  const trimmed = address.trim()
  if (!trimmed || cities.length === 0) return null

  const expandedAddress = expandShortTokens(trimmed, cities)
  const searchAddress = expandedAddress !== normalize(trimmed)
    ? `${trimmed} ${expandedAddress}`
    : trimmed

  const { threshold, ambiguityGap } = resolveThresholds(options)

  const ranked: CityMatchDetail[] = cities.map(city => {
    const { score, method } = scoreCity(city.name, searchAddress)
    let adjustedScore = score

    if (options?.regionHint && city.region) {
      if (city.region.toLowerCase() === options.regionHint.toLowerCase()) {
        adjustedScore = Math.min(1, adjustedScore + 0.04)
      } else {
        adjustedScore = Math.max(0, adjustedScore - 0.08)
      }
    }

    return { city, score: adjustedScore, method }
  })

  ranked.sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name))

  const best = ranked[0]
  const second = ranked[1]

  if (!best || best.score < threshold) return null

  if (best.score < 0.95 && second && best.score - second.score < ambiguityGap) {
    return null
  }

  return best
}

/** Attach LLM method label when resolving via model. */
export function toLlmMatchDetail(match: CityMatchDetail): CityMatchDetail {
  return { ...match, method: 'llm' }
}
