import { sendWhatsAppText } from '@/lib/whatsapp'
import type { CityMatchResult } from '@/lib/spark/match-city'

/** Session.region sentinel while waiting for one re-enter after city match failure. */
export const ADDRESS_CITY_RETRY_FLAG = '__city_retry__'

export function isAddressCityRetryPending(session: { region: string | null }): boolean {
  return session.region === ADDRESS_CITY_RETRY_FLAG
}

export function isCityMatchUnresolved(match: CityMatchResult): boolean {
  return !match.cityId || match.confidence === 'reject'
}

export async function sendAddressCityRetryPrompt(phone: string): Promise<void> {
  await sendWhatsAppText(
    phone,
    "We couldn't detect your town or village from that address. Please re-enter your *full delivery address* including your area or town."
  )
}

export function addressCityRetrySessionUpdate(): { region: string } {
  return { region: ADDRESS_CITY_RETRY_FLAG }
}

export function clearAddressCityRetryUpdate(): { region: null } {
  return { region: null }
}
