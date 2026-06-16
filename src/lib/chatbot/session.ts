import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import type { ChatState, WhatsAppSession } from './types'

const SPARK_COMPANY: WhatsAppCompany = 'spark'

const DEFAULT_SESSION: Omit<WhatsAppSession, 'phone' | 'updated_at'> = {
  company: SPARK_COMPANY,
  state: 'idle',
  selected_item_id: null,
  quantity: null,
  city: null,
  address: null,
  customer_name: null,
  total: null,
  draft_order_id: null,
  reminder_count: 0,
  last_inbound_at: null,
  last_reminder_at: null,
}

function normalizeSession(raw: WhatsAppSession): WhatsAppSession {
  return {
    ...DEFAULT_SESSION,
    ...raw,
    company: raw.company ?? SPARK_COMPANY,
    reminder_count: raw.reminder_count ?? 0,
    draft_order_id: raw.draft_order_id ?? null,
    last_inbound_at: raw.last_inbound_at ?? null,
    last_reminder_at: raw.last_reminder_at ?? null,
  }
}

export async function getSession(phone: string): Promise<WhatsAppSession> {
  try {
    const result = await invokeEdgeFunction<WhatsAppSession>('whatsapp-bot-sessions', {
      query: { phone, company: SPARK_COMPANY },
    })
    return normalizeSession(result.data as WhatsAppSession)
  } catch (err) {
    console.error('getSession error:', err)
    return { phone, ...DEFAULT_SESSION, updated_at: new Date().toISOString() }
  }
}

export async function updateSession(
  phone: string,
  updates: Partial<Omit<WhatsAppSession, 'phone' | 'updated_at'>>
): Promise<WhatsAppSession> {
  const result = await invokeEdgeFunction<WhatsAppSession>('whatsapp-bot-sessions', {
    method: 'PUT',
    query: { phone, company: SPARK_COMPANY },
    body: { company: SPARK_COMPANY, ...updates },
  })

  return normalizeSession(result.data as WhatsAppSession)
}

export async function touchInboundActivity(phone: string): Promise<void> {
  await updateSession(phone, {
    last_inbound_at: new Date().toISOString(),
    reminder_count: 0,
  })
}

export async function resetSession(phone: string): Promise<void> {
  await invokeEdgeFunction('whatsapp-bot-sessions', {
    method: 'DELETE',
    query: { phone, company: SPARK_COMPANY },
  })
}

export async function setSessionState(phone: string, state: ChatState): Promise<void> {
  await updateSession(phone, { state })
}

export async function listReminderCandidateSessions(): Promise<WhatsAppSession[]> {
  const result = await invokeEdgeFunction<WhatsAppSession[]>('whatsapp-bot-sessions', {
    query: { list: 'reminder_candidates', list_company: SPARK_COMPANY },
  })
  return (result.data ?? []).map(normalizeSession)
}
