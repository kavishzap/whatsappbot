import type { SodamaxSession } from './types'
import { isReminderEligible as isSparkReminderEligible, isRegionStepComplete } from '@/lib/spark/types'
import type { WhatsAppSession } from '@/lib/spark/types'

/** Same reminder rules as Spark — stops after region is selected or 3 reminders in 24h. */
export function isSodamaxReminderEligible(session: SodamaxSession): boolean {
  return isSparkReminderEligible(session as unknown as WhatsAppSession)
}

export { isRegionStepComplete }
