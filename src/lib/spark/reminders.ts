import { sendWhatsAppText, isWhatsAppAuthError } from '@/lib/whatsapp'
import { runWithWhatsAppLine } from '@/lib/whatsapp-line'
import { listReminderCandidateSessions as listSparkReminderCandidates, updateSession as updateSparkSession } from './session'
import { listReminderCandidateSessions as listSodamaxReminderCandidates, updateSession as updateSodamaxSession } from '@/lib/sodamax/session'
import { resumeSessionFlow as resumeSparkSessionFlow } from './resume-flow'
import { resumeSodamaxSessionFlow } from '../sodamax/resume-flow'
import { isReminderEligible } from './types'
import type { WhatsAppSession } from './types'
import { isSodamaxReminderEligible } from '@/lib/sodamax/reminders'
import type { SodamaxSession } from '@/lib/sodamax/types'

type ReminderSession = (WhatsAppSession | SodamaxSession) & { company: 'spark' | 'sodamax' }

async function listAllReminderCandidates(): Promise<ReminderSession[]> {
  const [spark, sodamax] = await Promise.all([
    listSparkReminderCandidates(),
    listSodamaxReminderCandidates(),
  ])
  return [...spark, ...sodamax]
}

export async function processSessionReminders(): Promise<{
  processed: number
  sent: number
  errors: number
}> {
  const candidates = await listAllReminderCandidates()
  let sent = 0
  let errors = 0

  for (const session of candidates) {
    const eligible =
      session.company === 'sodamax'
        ? isSodamaxReminderEligible(session as SodamaxSession)
        : isReminderEligible(session as WhatsAppSession)
    if (!eligible) continue

    try {
      await runWithWhatsAppLine(session.company, async () => {
        if (session.company === 'sodamax') {
          await resumeSodamaxSessionFlow(session.phone, session as SodamaxSession)
          await updateSodamaxSession(session.phone, {
            reminder_count: (session.reminder_count ?? 0) + 1,
            last_reminder_at: new Date().toISOString(),
          })
        } else {
          await resumeSparkSessionFlow(session.phone, session as WhatsAppSession)
          await updateSparkSession(session.phone, {
            reminder_count: (session.reminder_count ?? 0) + 1,
            last_reminder_at: new Date().toISOString(),
          })
        }
      })
      sent++
    } catch (err) {
      errors++
      if (isWhatsAppAuthError(err)) {
        console.error('WhatsApp auth error sending reminder:', err.message)
      } else {
        console.error('Reminder failed for', session.company, session.phone, err)
      }
    }
  }

  return { processed: candidates.length, sent, errors }
}

export async function sendReminderPing(phone: string): Promise<void> {
  await sendWhatsAppText(
    phone,
    'Reminder: you have an incomplete order. Reply to this chat to continue where you left off.'
  )
}
