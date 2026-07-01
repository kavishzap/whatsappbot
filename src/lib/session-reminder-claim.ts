import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

type ClaimedSession = Record<string, unknown> | null

/** Atomically reserve one daily reminder slot before sending WhatsApp messages. */
export async function claimSessionReminder(
  company: WhatsAppCompany,
  phone: string
): Promise<ClaimedSession> {
  const result = await invokeEdgeFunction<ClaimedSession>('whatsapp-bot-sessions', {
    method: 'POST',
    body: { action: 'claim_reminder', phone, company },
  })

  return result.data ?? null
}
