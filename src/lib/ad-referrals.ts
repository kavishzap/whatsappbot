import { getServiceClient } from '@/lib/supabase/admin'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import type { WhatsAppReferral } from '@/lib/spark/types'

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

export async function countAdReferralsInRange(
  company: WhatsAppCompany,
  start: Date | null,
  end: Date | null
): Promise<number> {
  const supabase = getServiceClient()
  let query = supabase
    .from('whatsapp_ad_referrals')
    .select('id', { count: 'exact', head: true })
    .eq('company', company)

  if (start) query = query.gte('received_at', start.toISOString())
  if (end) query = query.lte('received_at', end.toISOString())

  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}
