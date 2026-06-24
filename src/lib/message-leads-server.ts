import {
  fetchAdReferrals,
  fetchBotItems,
  fetchSessionSnapshots,
  isPreDraftSessionState,
  resolveProductNameForItemId,
  resolveProductNameForReferral,
} from '@/lib/ad-referrals'
import type { MessageLead } from '@/lib/message-leads-types'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export async function buildMessageLeads(company: WhatsAppCompany): Promise<MessageLead[]> {
  const [referrals, sessions, items] = await Promise.all([
    fetchAdReferrals(company),
    fetchSessionSnapshots(company),
    fetchBotItems(company),
  ])

  const sessionByPhone = new Map(sessions.map(session => [session.phone, session]))
  const adLeads: MessageLead[] = referrals.map(referral => {
    const session = sessionByPhone.get(referral.phone)
    const productFromAd = resolveProductNameForReferral(referral, items)
    const productFromSession = resolveProductNameForItemId(session?.selected_item_id, items)

    return {
      id: referral.id,
      phone: referral.phone,
      company,
      source: 'ad',
      source_id: referral.source_id,
      received_at: referral.received_at,
      session_state: session?.state ?? 'ad_click',
      product_name: productFromSession ?? productFromAd,
      customer_name: session?.customer_name?.trim() || null,
      draft_order_id: session?.draft_order_id ?? null,
    }
  })

  const phonesWithAdLead = new Set(referrals.map(referral => referral.phone))

  const organicLeads: MessageLead[] = sessions
    .filter(
      session =>
        !session.draft_order_id &&
        isPreDraftSessionState(session.state) &&
        !phonesWithAdLead.has(session.phone)
    )
    .map(session => ({
      id: `session:${session.phone}`,
      phone: session.phone,
      company,
      source: 'organic' as const,
      source_id: null,
      received_at: session.last_inbound_at ?? session.updated_at,
      session_state: session.state,
      product_name: resolveProductNameForItemId(session.selected_item_id, items),
      customer_name: session.customer_name?.trim() || null,
      draft_order_id: null,
    }))

  return [...adLeads, ...organicLeads].sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
  )
}
