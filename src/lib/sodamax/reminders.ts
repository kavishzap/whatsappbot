import type { SodamaxSession } from './types'
import { isDailyReminderEligible } from '@/lib/reminder-schedule'

/** Reminders only while an order flow is in progress — stops when session returns to idle. */
export function isSodamaxReminderEligible(session: SodamaxSession): boolean {
  return isDailyReminderEligible(session)
}
