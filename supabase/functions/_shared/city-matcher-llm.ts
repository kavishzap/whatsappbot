import {
  matchCityFromAddressText,
  type CityCandidate,
  type CityMatchDetail,
  type CityMatchOptions,
  type CityMatchOutcome,
} from './city-matcher.ts'

/** Fuzzy hybrid matcher — rules-based only (no LLM). */
export function matchCityHybrid(
  cities: CityCandidate[],
  address: string,
  options?: CityMatchOptions
): CityMatchOutcome {
  return matchCityFromAddressText(cities, address, options)
}

/** @deprecated Use matchCityHybrid — kept for imports that expect a single match. */
export async function matchCityWithLlm(
  _cities: CityCandidate[],
  _address: string,
  _options?: CityMatchOptions
): Promise<CityMatchDetail | null> {
  return null
}
