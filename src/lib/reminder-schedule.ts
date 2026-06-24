/** Max reminders per customer while their order flow is incomplete. */
export const REMINDER_MAX_COUNT = 3

/** Daily batch time — 20:00 in Mauritius (UTC+4, no DST). */
export const REMINDER_TIMEZONE = 'Indian/Mauritius'
export const REMINDER_DAILY_HOUR = 20

/** WhatsApp session messages require an inbound within this window. */
export const REMINDER_WHATSAPP_WINDOW_HOURS = 24

const mauritiusDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REMINDER_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const mauritiusHourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: REMINDER_TIMEZONE,
  hour: 'numeric',
  hour12: false,
})

export function getMauritiusDateKey(date: Date = new Date()): string {
  return mauritiusDateFormatter.format(date)
}

export function getMauritiusHour(date: Date = new Date()): number {
  return Number(mauritiusHourFormatter.format(date))
}

/** True during the 20:00 hour in Mauritius (when the daily cron fires). */
export function isReminderSendWindow(now: Date = new Date()): boolean {
  if (process.env.REMINDER_SKIP_TIME_CHECK === '1') return true
  return getMauritiusHour(now) === REMINDER_DAILY_HOUR
}

export type ReminderSessionFields = {
  state: string
  reminder_count?: number | null
  last_inbound_at?: string | null
  last_reminder_at?: string | null
}

/** Incomplete flow, at most one reminder per Mauritius calendar day, max 3 total. */
export function isDailyReminderEligible(
  session: ReminderSessionFields,
  now: Date = new Date()
): boolean {
  if (session.state === 'idle') return false
  if ((session.reminder_count ?? 0) >= REMINDER_MAX_COUNT) return false
  if (!session.last_inbound_at) return false

  const hoursSinceInbound =
    (now.getTime() - new Date(session.last_inbound_at).getTime()) / (1000 * 60 * 60)
  if (hoursSinceInbound >= REMINDER_WHATSAPP_WINDOW_HOURS) return false

  const today = getMauritiusDateKey(now)
  if (session.last_reminder_at) {
    const lastReminderDay = getMauritiusDateKey(new Date(session.last_reminder_at))
    if (lastReminderDay === today) return false
  }

  if (!isReminderSendWindow(now)) return false

  return true
}
