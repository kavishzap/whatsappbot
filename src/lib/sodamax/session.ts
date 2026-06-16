import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import type { SodamaxChatState, SodamaxSession } from './types'

const SODAMAX_COMPANY = 'sodamax' as const

const DEFAULT_SESSION: Omit<SodamaxSession, 'phone' | 'updated_at'> = {
  company: SODAMAX_COMPANY,
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

function normalizeSession(raw: SodamaxSession): SodamaxSession {
  return {
    ...DEFAULT_SESSION,
    ...raw,
    company: SODAMAX_COMPANY,
    reminder_count: raw.reminder_count ?? 0,
    draft_order_id: raw.draft_order_id ?? null,
    last_inbound_at: raw.last_inbound_at ?? null,
    last_reminder_at: raw.last_reminder_at ?? null,
  }
}

export async function getSession(phone: string): Promise<SodamaxSession> {
  try {
    const result = await invokeEdgeFunction<SodamaxSession>('whatsapp-bot-sessions', {
      query: { phone, company: SODAMAX_COMPANY },
    })
    return normalizeSession(result.data as SodamaxSession)
  } catch (err) {
    console.error('Sodamax getSession error:', err)
    return { phone, ...DEFAULT_SESSION, updated_at: new Date().toISOString() }
  }
}

export async function updateSession(
  phone: string,
  updates: Partial<Omit<SodamaxSession, 'phone' | 'updated_at'>>
): Promise<SodamaxSession> {
  const result = await invokeEdgeFunction<SodamaxSession>('whatsapp-bot-sessions', {
    method: 'PUT',
    query: { phone, company: SODAMAX_COMPANY },
    body: { company: SODAMAX_COMPANY, ...updates },
  })
  return normalizeSession(result.data as SodamaxSession)
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
    query: { phone, company: SODAMAX_COMPANY },
  })
}

export async function setSessionState(phone: string, state: SodamaxChatState): Promise<void> {
  await updateSession(phone, { state })
}

export async function listReminderCandidateSessions(): Promise<SodamaxSession[]> {
  const result = await invokeEdgeFunction<SodamaxSession[]>('whatsapp-bot-sessions', {
    query: { list: 'reminder_candidates', list_company: SODAMAX_COMPANY },
  })
  return (result.data ?? []).map(normalizeSession)
}
