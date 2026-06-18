import { fetchSession, saveSession, clearSession, mergeSessionWrite } from '@/lib/spark/session-client'
import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import type { SodamaxChatState, SodamaxSession } from './types'

const SODAMAX_COMPANY = 'sodamax' as const

const DEFAULT_SESSION: Omit<SodamaxSession, 'phone' | 'updated_at'> = {
  company: SODAMAX_COMPANY,
  state: 'idle',
  selected_item_id: null,
  quantity: null,
  region: null,
  city: null,
  address: null,
  customer_name: null,
  total: null,
  draft_order_id: null,
  reminder_count: 0,
  last_inbound_at: null,
  last_reminder_at: null,
}

function normalizeState(state: string): SodamaxChatState {
  if (state === 'awaiting_city') return 'awaiting_delivery_address'
  return state as SodamaxChatState
}

function normalizeSession(raw: SodamaxSession): SodamaxSession {
  return {
    ...DEFAULT_SESSION,
    ...raw,
    state: normalizeState(raw.state),
    company: SODAMAX_COMPANY,
    reminder_count: raw.reminder_count ?? 0,
    draft_order_id: raw.draft_order_id ?? null,
    region: raw.region ?? null,
    last_inbound_at: raw.last_inbound_at ?? null,
    last_reminder_at: raw.last_reminder_at ?? null,
  }
}

export async function loadSession(phone: string): Promise<SodamaxSession> {
  try {
    const data = await fetchSession<SodamaxSession>(SODAMAX_COMPANY, phone, { touch: true })
    return normalizeSession(data)
  } catch (err) {
    console.error('Sodamax loadSession error:', err)
    return { phone, ...DEFAULT_SESSION, updated_at: new Date().toISOString() }
  }
}

export async function getSession(phone: string): Promise<SodamaxSession> {
  try {
    const data = await fetchSession<SodamaxSession>(SODAMAX_COMPANY, phone)
    return normalizeSession(data)
  } catch (err) {
    console.error('Sodamax getSession error:', err)
    return { phone, ...DEFAULT_SESSION, updated_at: new Date().toISOString() }
  }
}

export async function updateSession(
  phone: string,
  updates: Partial<Omit<SodamaxSession, 'phone' | 'updated_at'>>,
  options?: { previous?: SodamaxSession }
): Promise<SodamaxSession> {
  const saved = await saveSession<SodamaxSession>(SODAMAX_COMPANY, phone, updates)
  const normalized = normalizeSession(saved)

  if (options?.previous) {
    return mergeSessionWrite<SodamaxSession>(options.previous, updates, normalized)
  }

  return normalized
}

/** @deprecated Use loadSession */
export async function touchInboundActivity(phone: string): Promise<void> {
  await fetchSession(SODAMAX_COMPANY, phone, { touch: true })
}

export async function resetSession(phone: string): Promise<void> {
  await clearSession(SODAMAX_COMPANY, phone)
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
