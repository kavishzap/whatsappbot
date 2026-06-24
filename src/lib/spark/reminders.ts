import { sendWhatsAppText, isWhatsAppAuthError } from '@/lib/whatsapp'
import { runWithWhatsAppLine } from '@/lib/whatsapp-line'
import { isDailyReminderEligible } from '@/lib/reminder-schedule'
import {
  getSession,
  getSessionWithCart,
  listReminderCandidateSessions as listSparkReminderCandidates,
  updateSession as updateSparkSession,
} from './session'
import {
  getSession as getSodamaxSession,
  listReminderCandidateSessions as listSodamaxReminderCandidates,
  updateSession as updateSodamaxSession,
} from '@/lib/sodamax/session'
import { resumeSessionFlow as resumeSparkSessionFlow } from './resume-flow'
import { resumeSodamaxSessionFlow } from '../sodamax/resume-flow'
import type { WhatsAppSession } from './types'
import type { SodamaxSession } from '@/lib/sodamax/types'

type ReminderSession = (WhatsAppSession | SodamaxSession) & { company: 'spark' | 'sodamax' }

async function listAllReminderCandidates(): Promise<ReminderSession[]> {
  const [spark, sodamax] = await Promise.all([
    listSparkReminderCandidates(),
    listSodamaxReminderCandidates(),
  ])
  return [...spark, ...sodamax]
}

function sparkSessionNeedsCart(session: WhatsAppSession): boolean {
  return Boolean(
    session.draft_order_id ||
      session.state === 'awaiting_confirm' ||
      session.state === 'awaiting_customer_name' ||
      session.state === 'awaiting_add_more_product' ||
      session.state === 'awaiting_quantity' ||
      session.state === 'awaiting_quantity_custom'
  )
}

async function loadSparkSessionForResume(phone: string, session: WhatsAppSession): Promise<WhatsAppSession> {
  if (sparkSessionNeedsCart(session)) {
    return getSessionWithCart(phone)
  }
  return getSession(phone)
}

async function loadSodamaxSessionForResume(phone: string): Promise<SodamaxSession> {
  return getSodamaxSession(phone)
}

export async function processSessionReminders(): Promise<{
  processed: number
  sent: number
  skipped: number
  errors: number
}> {
  const candidates = await listAllReminderCandidates()
  let sent = 0
  let skipped = 0
  let errors = 0

  for (const session of candidates) {
    if (!isDailyReminderEligible(session)) {
      skipped++
      continue
    }

    try {
      await runWithWhatsAppLine(session.company, async () => {
        if (session.company === 'sodamax') {
          const fresh = await loadSodamaxSessionForResume(session.phone)
          await resumeSodamaxSessionFlow(session.phone, fresh)
          await updateSodamaxSession(session.phone, {
            reminder_count: (fresh.reminder_count ?? 0) + 1,
            last_reminder_at: new Date().toISOString(),
          })
        } else {
          const fresh = await loadSparkSessionForResume(session.phone, session as WhatsAppSession)
          await resumeSparkSessionFlow(session.phone, fresh)
          await updateSparkSession(session.phone, {
            reminder_count: (fresh.reminder_count ?? 0) + 1,
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

  return { processed: candidates.length, sent, skipped, errors }
}

export async function sendReminderPing(phone: string): Promise<void> {
  await sendWhatsAppText(
    phone,
    'Reminder: you have an incomplete order. Reply to this chat to continue where you left off.'
  )
}
