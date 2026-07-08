export interface CityCandidate {
  id: string
  name: string
  region?: string
  priority?: number | null
  /** Normalized alias strings from city_aliases. */
  aliases?: string[]
}

export type CityMatchConfidence = 'auto_accept' | 'confirm' | 'reject'

export interface CityMatchDetail {
  city: CityCandidate
  score: number
  method: 'exact' | 'substring' | 'token' | 'fuzzy' | 'alias' | 'phrase'
  confidence: CityMatchConfidence
}

export interface CityMatchOutcome {
  best: CityMatchDetail | null
  alternatives: CityMatchDetail[]
  normalizedAddress: string
}

export interface CityMatchOptions {
  regionHint?: string
}

const AUTO_ACCEPT_SCORE = 0.86
const CONFIRM_MIN_SCORE = 0.62
const STRONG_TYPO_DAM = 0.72
const AUTO_ACCEPT_GAP = 0.06

const ADDRESS_ALIASES: Record<string, string> = {
  qb: 'quatre bornes',
  'q bornes': 'quatre bornes',
  '4 bornes': 'quatre bornes',
  pl: 'port louis',
  'pt louis': 'port louis',
  vp: 'vacoas phoenix',
  bbrh: 'beau bassin rose hill',
  cp: 'curepipe',
  cpe: 'curepipe',
  grnw: 'grnw',
  grse: 'grse',
}

export function normalizeCityText(input: string): string {
  let text = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/d['’]/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\bst\b/g, 'saint')
    .replace(/\s+/g, ' ')
    .trim()

  const sortedAliases = Object.entries(ADDRESS_ALIASES).sort((a, b) => b[0].length - a[0].length)
  for (const [alias, canonical] of sortedAliases) {
    const pattern = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'g')
    text = text.replace(pattern, canonical)
  }

  return text
}

function tokenize(input: string): string[] {
  return normalizeCityText(input).split(' ').filter(Boolean)
}

function generateNgrams(tokens: string[], maxWords = 5): string[] {
  const phrases: string[] = []

  for (let size = 1; size <= Math.min(maxWords, tokens.length); size++) {
    for (let i = 0; i <= tokens.length - size; i++) {
      phrases.push(tokens.slice(i, i + size).join(' '))
    }
  }

  return phrases
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

function levenshteinSimilarity(a: string, b: string): number {
  const x = normalizeCityText(a)
  const y = normalizeCityText(b)
  const maxLen = Math.max(x.length, y.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(x, y) / maxLen
}

/** Damerau-Levenshtein — counts adjacent transpositions as one edit. */
function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const lenA = a.length
  const lenB = b.length
  const maxDist = lenA + lenB
  const da = new Map<string, number>()

  const d: number[][] = Array.from({ length: lenA + 2 }, () =>
    Array(lenB + 2).fill(0)
  )

  d[0][0] = maxDist
  for (let i = 0; i <= lenA; i++) {
    d[i + 1][0] = maxDist
    d[i + 1][1] = i
  }
  for (let j = 0; j <= lenB; j++) {
    d[0][j + 1] = maxDist
    d[1][j + 1] = j
  }

  for (let i = 1; i <= lenA; i++) {
    let db = 0
    for (let j = 1; j <= lenB; j++) {
      const i1 = da.get(b[j - 1]) ?? 0
      const j1 = db
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      if (cost === 0) db = j

      d[i + 1][j + 1] = Math.min(
        d[i][j + 1] + 1,
        d[i + 1][j] + 1,
        d[i][j] + cost,
        d[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1)
      )
    }
    da.set(a[i - 1], i)
  }

  return d[lenA + 1][lenB + 1]
}

function damerauSimilarity(a: string, b: string): number {
  const x = normalizeCityText(a)
  const y = normalizeCityText(b)
  const maxLen = Math.max(x.length, y.length)
  if (maxLen === 0) return 1
  return 1 - damerauLevenshtein(x, y) / maxLen
}

function isStrongTypoMatch(phrase: string, cityName: string): boolean {
  return damerauSimilarity(phrase, cityName) >= STRONG_TYPO_DAM
}

function tokenWiseTypoSimilarity(input: string, city: string): number {
  const inputTokens = tokenize(input)
  const cityTokens = tokenize(city)
  if (inputTokens.length === 0 || cityTokens.length === 0) return 0

  const scores = cityTokens.map(cityToken =>
    Math.max(...inputTokens.map(inputToken => damerauSimilarity(inputToken, cityToken)))
  )

  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

function tokenAlignScore(phrase: string, cityName: string): number {
  const cityTokens = tokenize(cityName)
  const phraseTokens = tokenize(phrase)
  if (cityTokens.length === 0 || phraseTokens.length === 0) return 0

  const normalizedCity = normalizeCityText(cityName)
  let best = 0

  for (let size = cityTokens.length; size <= Math.min(cityTokens.length + 2, phraseTokens.length); size++) {
    for (let i = 0; i <= phraseTokens.length - size; i++) {
      const window = phraseTokens.slice(i, i + size).join(' ')
      best = Math.max(
        best,
        damerauSimilarity(window, normalizedCity),
        levenshteinSimilarity(window, normalizedCity)
      )
    }
  }

  if (cityTokens.length > 1) {
    best = Math.max(best, tokenWiseTypoSimilarity(phrase, cityName))
  }

  return best
}


function tokenSimilarity(a: string, b: string): number {
  const aTokens = new Set(tokenize(a))
  const bTokens = new Set(tokenize(b))
  const intersection = [...aTokens].filter(token => bTokens.has(token)).length
  const union = new Set([...aTokens, ...bTokens]).size
  if (union === 0) return 0
  return intersection / union
}

function substringScore(phrase: string, cityName: string): number {
  if (phrase === cityName) return 1
  if (phrase.includes(cityName)) return 0.95
  if (cityName.includes(phrase) && phrase.length >= 4) return 0.75
  return 0
}

function aliasScore(phrase: string, city: CityCandidate): number {
  if (!city.aliases?.length) return 0

  let best = 0
  for (const alias of city.aliases) {
    if (!alias) continue
    if (phrase === alias) return 1
    if (phrase.includes(alias) || alias.includes(phrase)) {
      best = Math.max(best, 0.92)
      continue
    }
    best = Math.max(best, damerauSimilarity(phrase, alias), levenshteinSimilarity(phrase, alias))
  }

  return best
}

function scorePhraseAgainstCity(phrase: string, city: CityCandidate, options?: CityMatchOptions): number {
  const normalizedPhrase = normalizeCityText(phrase)
  const normalizedCity = normalizeCityText(city.name)
  if (!normalizedPhrase || !normalizedCity) return 0

  const lev = levenshteinSimilarity(normalizedPhrase, normalizedCity)
  const dam = damerauSimilarity(normalizedPhrase, normalizedCity)
  const token = tokenSimilarity(normalizedPhrase, normalizedCity)
  const tokenWise = tokenWiseTypoSimilarity(normalizedPhrase, normalizedCity)
  const sub = substringScore(normalizedPhrase, normalizedCity)
  const alias = aliasScore(normalizedPhrase, city)
  const align = tokenAlignScore(phrase, city.name)

  const blended =
    0.4 * tokenWise + 0.3 * dam + 0.15 * lev + 0.1 * token + 0.05 * sub

  let score = Math.max(lev, dam, tokenWise, token, sub, alias, align, blended)

  if (isStrongTypoMatch(phrase, city.name)) {
    score = Math.max(score, dam, tokenWise)
  }

  if (alias >= 0.95) score = Math.max(score, alias)

  if (options?.regionHint && city.region) {
    score +=
      city.region.toLowerCase() === options.regionHint.toLowerCase() ? 0.03 : -0.03
  }

  if (city.priority) {
    score += Math.min(Math.max(city.priority, 0) / 100, 0.03)
  }

  return Math.max(0, Math.min(1, score))
}

function resolveConfidence(
  bestScore: number,
  gap: number
): CityMatchConfidence {
  if (bestScore >= AUTO_ACCEPT_SCORE && gap >= AUTO_ACCEPT_GAP) {
    return 'auto_accept'
  }
  if (bestScore >= CONFIRM_MIN_SCORE) {
    return 'confirm'
  }
  return 'reject'
}

function detectMethod(
  score: number,
  aliasUsed: boolean,
  typoMatch: boolean
): CityMatchDetail['method'] {
  if (aliasUsed) return 'alias'
  if (score >= 0.98) return 'exact'
  if (score >= 0.9) return 'substring'
  if (typoMatch || score >= 0.72) return 'fuzzy'
  if (score >= 0.65) return 'token'
  return 'phrase'
}

export function matchCityFromAddressText(
  cities: CityCandidate[],
  address: string,
  options?: CityMatchOptions
): CityMatchOutcome {
  const trimmed = address.trim()
  const normalizedAddress = normalizeCityText(trimmed)

  if (!trimmed || cities.length === 0) {
    return { best: null, alternatives: [], normalizedAddress }
  }

  const phrases = generateNgrams(tokenize(trimmed), 5)

  const ranked = cities.map(city => {
    let bestScore = 0
    let aliasUsed = false
    let typoMatch = false

    for (const phrase of phrases) {
      const phraseScore = scorePhraseAgainstCity(phrase, city, options)
      bestScore = Math.max(bestScore, phraseScore)
      if (aliasScore(phrase, city) >= 0.85) aliasUsed = true
      if (isStrongTypoMatch(phrase, city.name)) typoMatch = true
    }

    return {
      city,
      score: Number(bestScore.toFixed(4)),
      method: detectMethod(bestScore, aliasUsed, typoMatch),
      confidence: 'reject' as CityMatchConfidence,
    }
  })

  ranked.sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name))

  const best = ranked[0]
  const second = ranked[1]
  if (!best || best.score < CONFIRM_MIN_SCORE) {
    return {
      best: null,
      alternatives: ranked.filter(item => item.score >= 0.35).slice(0, 5),
      normalizedAddress,
    }
  }

  const gap = second ? best.score - second.score : best.score
  const confidence = resolveConfidence(best.score, gap)

  const bestDetail: CityMatchDetail = { ...best, confidence }
  const alternatives = ranked
    .slice(0, 5)
    .map(item => ({
      ...item,
      confidence: item.city.id === best.city.id ? confidence : 'confirm',
    }))
    .filter(item => item.score >= CONFIRM_MIN_SCORE - 0.05)

  return {
    best: bestDetail,
    alternatives,
    normalizedAddress,
  }
}

/** Backward-compatible single match — auto-accept only. */
export function matchCityAutoOnly(
  cities: CityCandidate[],
  address: string,
  options?: CityMatchOptions
): CityMatchDetail | null {
  const outcome = matchCityFromAddressText(cities, address, options)
  if (!outcome.best || outcome.best.confidence !== 'auto_accept') return null
  return outcome.best
}

export function toLlmMatchDetail(match: CityMatchDetail): CityMatchDetail {
  return { ...match, method: 'phrase' }
}
