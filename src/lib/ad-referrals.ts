import { getServiceClient } from '@/lib/supabase/admin'
import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import { normalizeAdId, normalizeAdLink } from '@/lib/spark/products'
import type { BotItem } from '@/lib/spark/types'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import type { WhatsAppReferral } from '@/lib/spark/types'

export interface AdReferralRecord {
  id: string
  company: WhatsAppCompany
  source_url: string | null
  source_id: string | null
  source_type: string | null
  phone: string
  received_at: string
}

const PRE_DRAFT_IGNORED_STATES = new Set(['idle', 'awaiting_menu_selection'])

function adIdsMatch(stored: string | null | undefined, incoming: string): boolean {
  if (!stored) return false
  return normalizeAdId(stored) === normalizeAdId(incoming)
}

function linksMatch(stored: string | null | undefined, incoming: string): boolean {
  if (!stored) return false
  if (stored.trim() === incoming.trim()) return true
  return normalizeAdLink(stored) === normalizeAdLink(incoming)
}

function itemMatchesReferral(item: BotItem, referral: Pick<AdReferralRecord, 'source_id' | 'source_url'>): boolean {
  const sourceId = referral.source_id?.trim()
  if (sourceId && (adIdsMatch(item.ad_id, sourceId) || adIdsMatch(item.ad_id_2, sourceId))) {
    return true
  }

  const sourceUrl = referral.source_url?.trim()
  if (!sourceUrl) return false

  return linksMatch(item.ad_link, sourceUrl) || linksMatch(item.ad_link_2, sourceUrl)
}

export function resolveProductNameForReferral(
  referral: Pick<AdReferralRecord, 'source_id' | 'source_url'>,
  items: BotItem[]
): string | null {
  const hit = items.find(item => itemMatchesReferral(item, referral))
  return hit?.product_name?.trim() || null
}

export function resolveProductNameForItemId(
  itemId: string | null | undefined,
  items: BotItem[]
): string | null {
  if (!itemId) return null
  const hit = items.find(item => item.id === itemId)
  return hit?.product_name?.trim() || null
}

export async function recordAdReferral(
  company: WhatsAppCompany,
  referral: WhatsAppReferral,
  phone: string
): Promise<void> {
  const sourceId = referral.source_id?.trim() || null
  const sourceUrl = referral.source_url?.trim() || null
  if (!sourceId && !sourceUrl) return

  const supabase = getServiceClient()
  const { error } = await supabase.from('whatsapp_ad_referrals').insert({
    company,
    source_url: sourceUrl,
    source_id: sourceId,
    source_type: referral.source_type?.trim() || null,
    phone,
  })

  if (error) {
    console.error('recordAdReferral failed:', error.message)
  }
}

export async function fetchAdReferrals(company: WhatsAppCompany, limit = 500): Promise<AdReferralRecord[]> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('whatsapp_ad_referrals')
    .select('id, company, source_url, source_id, source_type, phone, received_at')
    .eq('company', company)
    .order('received_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as AdReferralRecord[]
}

export async function fetchBotItems(company: WhatsAppCompany): Promise<BotItem[]> {
  try {
    const result = await invokeEdgeFunction<BotItem[]>('whatsapp-bot-items', {
      query: { company },
    })
    return result.data ?? []
  } catch (err) {
    console.error('fetchBotItems for message leads failed:', err)
    return []
  }
}

type SessionSnapshot = {
  phone: string
  state: string
  selected_item_id: string | null
  draft_order_id: string | null
  customer_name: string | null
  last_inbound_at: string | null
  updated_at: string
}

export async function fetchSessionSnapshots(company: WhatsAppCompany): Promise<SessionSnapshot[]> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select(
      'phone, state, selected_item_id, draft_order_id, customer_name, last_inbound_at, updated_at'
    )
    .eq('company', company)

  if (error) throw error
  return (data ?? []) as SessionSnapshot[]
}

export function isPreDraftSessionState(state: string): boolean {
  return !PRE_DRAFT_IGNORED_STATES.has(state)
}

export { PRE_DRAFT_IGNORED_STATES }
