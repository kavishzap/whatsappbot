import type { SodamaxSession } from './types'
import { isReminderEligible as isSparkReminderEligible } from '@/lib/spark/types'
import type { WhatsAppSession } from '@/lib/spark/types'

/** Reminders only while an order flow is in progress — stops when session returns to idle. */
export function isSodamaxReminderEligible(session: SodamaxSession): boolean {
  return isSparkReminderEligible(session as unknown as WhatsAppSession)
}
