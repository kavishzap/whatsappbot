import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

declare global {
  // eslint-disable-next-line no-var
  var __whatsappInboundInflight: Set<string> | undefined
}

const INFLIGHT = globalThis.__whatsappInboundInflight ?? new Set<string>()
globalThis.__whatsappInboundInflight = INFLIGHT

function dedupKey(messageId: string): string {
  return messageId.trim()
}

/** Same Node process — parallel webhook deliveries for one wamid. */
export function beginInboundProcessing(messageId: string): boolean {
  const key = dedupKey(messageId)
  if (!key || INFLIGHT.has(key)) return false
  INFLIGHT.add(key)
  return true
}

export function endInboundProcessing(messageId: string): void {
  INFLIGHT.delete(dedupKey(messageId))
}

/** DB claim — false if this wamid was already processed (Meta retry / second webhook URL). */
export async function claimInboundWhatsAppMessage(
  company: WhatsAppCompany,
  messageId: string,
  phone: string
): Promise<boolean> {
  const key = dedupKey(messageId)
  if (!key) return true

  try {
    const result = await invokeEdgeFunction<{ claimed: boolean }>('whatsapp-bot-sessions', {
      method: 'POST',
      body: {
        action: 'claim_inbound',
        message_id: key,
        phone: phone.trim(),
        company,
      },
    })

    return result.data?.claimed !== false
  } catch (err) {
    console.error('Inbound dedup claim failed (handling message anyway):', err)
    return true
  }
}
