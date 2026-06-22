import { getServiceClient } from '@/lib/supabase/admin'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import type { WhatsAppReferral } from '@/lib/spark/types'

export interface AdReferralRecord {
  id: string
  company: WhatsAppCompany
  source_url: string
  source_id: string | null
  source_type: string | null
  phone: string | null
  received_at: string
}

export async function recordAdReferral(
  company: WhatsAppCompany,
  referral: WhatsAppReferral,
  phone: string
): Promise<void> {
  const sourceUrl = referral.source_url?.trim()
  if (!sourceUrl) return

  const supabase = getServiceClient()
  const { error } = await supabase.from('whatsapp_ad_referrals').insert({
    company,
    source_url: sourceUrl,
    source_id: referral.source_id?.trim() || null,
    source_type: referral.source_type?.trim() || null,
    phone,
  })

  if (error) {
    console.error('recordAdReferral failed:', error.message)
  }
}

/** Latest unique source_url values for a company (most recent first). */
export async function fetchRecentAdReferrals(
  company: WhatsAppCompany,
  limit = 10
): Promise<AdReferralRecord[]> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('whatsapp_ad_referrals')
    .select('id, company, source_url, source_id, source_type, phone, received_at')
    .eq('company', company)
    .order('received_at', { ascending: false })
    .limit(50)

  if (error) throw error

  const seen = new Set<string>()
  const unique: AdReferralRecord[] = []

  for (const row of data ?? []) {
    const url = row.source_url?.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    unique.push(row as AdReferralRecord)
    if (unique.length >= limit) break
  }

  return unique
}
