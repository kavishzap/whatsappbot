import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import { fetchSession, saveSession, clearSession, mergeSessionWrite } from './session-client'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import type { ChatState, WhatsAppSession } from './types'

const SPARK_COMPANY: WhatsAppCompany = 'spark'

const DEFAULT_SESSION: Omit<WhatsAppSession, 'phone' | 'updated_at'> = {
  company: SPARK_COMPANY,
  state: 'idle',
  selected_item_id: null,
  quantity: null,
  region: null,
  city: null,
  address: null,
  customer_name: null,
  total: null,
  draft_order_id: null,
  cart_items: [],
  reminder_count: 0,
  last_inbound_at: null,
  last_reminder_at: null,
}

function normalizeState(state: string): ChatState {
  if (state === 'awaiting_city') return 'awaiting_delivery_address'
  return state as ChatState
}

function normalizeSession(raw: WhatsAppSession): WhatsAppSession {
  return {
    ...DEFAULT_SESSION,
    ...raw,
    state: normalizeState(raw.state),
    company: raw.company ?? SPARK_COMPANY,
    reminder_count: raw.reminder_count ?? 0,
    draft_order_id: raw.draft_order_id ?? null,
    cart_items: Array.isArray(raw.cart_items) ? raw.cart_items : [],
    region: raw.region ?? null,
    last_inbound_at: raw.last_inbound_at ?? null,
    last_reminder_at: raw.last_reminder_at ?? null,
  }
}

/** Single round-trip: load session and record inbound activity. */
export async function loadSession(phone: string): Promise<WhatsAppSession> {
  try {
    const data = await fetchSession<WhatsAppSession>(SPARK_COMPANY, phone, { touch: true })
    return normalizeSession(data)
  } catch (err) {
    console.error('loadSession error:', err)
    return { phone, ...DEFAULT_SESSION, updated_at: new Date().toISOString() }
  }
}

export async function getSession(phone: string): Promise<WhatsAppSession> {
  try {
    const data = await fetchSession<WhatsAppSession>(SPARK_COMPANY, phone)
    return normalizeSession(data)
  } catch (err) {
    console.error('getSession error:', err)
    return { phone, ...DEFAULT_SESSION, updated_at: new Date().toISOString() }
  }
}

export async function updateSession(
  phone: string,
  updates: Partial<Omit<WhatsAppSession, 'phone' | 'updated_at'>>,
  options?: { includeCart?: boolean; previous?: WhatsAppSession }
): Promise<WhatsAppSession> {
  const includeCart = options?.includeCart ?? 'cart_items' in updates
  const saved = await saveSession<WhatsAppSession>(SPARK_COMPANY, phone, updates, { includeCart })
  const normalized = normalizeSession(saved)

  if (options?.previous) {
    return mergeSessionWrite<WhatsAppSession>(options.previous, updates, normalized)
  }

  return normalized
}

/** @deprecated Use loadSession — touch is folded into the GET. */
export async function touchInboundActivity(phone: string): Promise<void> {
  await fetchSession(SPARK_COMPANY, phone, { touch: true })
}

export async function resetSession(phone: string): Promise<void> {
  await clearSession(SPARK_COMPANY, phone)
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
