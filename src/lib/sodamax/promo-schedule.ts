import { getServiceClient } from '@/lib/supabase/admin'
import { getCronSecret } from '@/lib/cron-auth'
import { getDraftOrderById } from '@/lib/spark/orders'
import { sendSodamaxFlavourPromo } from '@/lib/sodamax/promo'
import { runWithWhatsAppLine } from '@/lib/whatsapp-line'
import { isWhatsAppAuthError } from '@/lib/whatsapp'
import { normalizeWhatsAppPhone } from '@/lib/phone'

export const SODAMAX_FLAVOUR_PROMO_DELAY_MS = 60_000

const COMPANY = 'sodamax' as const

type ScheduledPromoRow = {
  id: string
  phone: string
  order_id: string | null
  send_at: string
  sent_at: string | null
}

function getSiteUrl(): string {
  return (
    process.env.URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    ''
  )
}

async function isPromoOrderEligible(orderId: string, phone: string): Promise<boolean> {
  const order = await getDraftOrderById(orderId, COMPANY)
  if (!order || order.status !== 'complete') return false

  return (
    normalizeWhatsAppPhone(order.customer_phone_number) === normalizeWhatsAppPhone(phone)
  )
}

async function markPromoSkipped(promoId: string, reason: string): Promise<void> {
  const supabase = getServiceClient()
  await supabase
    .from('whatsapp_scheduled_promos')
    .update({ error: reason, sent_at: new Date().toISOString() })
    .eq('id', promoId)
    .is('sent_at', null)
}

/** Deliver only when linked to a confirmed SodaMax order and the delay has elapsed. */
export async function deliverScheduledSodamaxFlavourPromoById(
  promoId: string
): Promise<boolean> {
  const supabase = getServiceClient()
  const now = new Date().toISOString()

  const { data: row, error } = await supabase
    .from('whatsapp_scheduled_promos')
    .select('id, phone, order_id, send_at, sent_at')
    .eq('id', promoId)
    .eq('company', COMPANY)
    .maybeSingle()

  if (error) throw error
  if (!row || row.sent_at) return false

  const promo = row as ScheduledPromoRow

  if (new Date(promo.send_at).getTime() > Date.now()) return false

  if (!promo.order_id) {
    await markPromoSkipped(promo.id, 'missing order_id')
    return false
  }

  if (!(await isPromoOrderEligible(promo.order_id, promo.phone))) {
    await markPromoSkipped(promo.id, 'order not confirmed')
    return false
  }

  const { data: claimed, error: claimError } = await supabase
    .from('whatsapp_scheduled_promos')
    .update({ sent_at: now, error: null })
    .eq('id', promoId)
    .is('sent_at', null)
    .lte('send_at', now)
    .select('id')
    .maybeSingle()

  if (claimError) throw claimError
  if (!claimed) return false

  try {
    await runWithWhatsAppLine(COMPANY, async () => {
      await sendSodamaxFlavourPromo(promo.phone)
    })
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('whatsapp_scheduled_promos')
      .update({ sent_at: null, error: message })
      .eq('id', promoId)

    if (isWhatsAppAuthError(err)) throw err
    throw err
  }
}

async function queueFlavourPromoInDb(
  phone: string,
  orderId: string
): Promise<string> {
  const supabase = getServiceClient()
  const sendAt = new Date(Date.now() + SODAMAX_FLAVOUR_PROMO_DELAY_MS).toISOString()

  await supabase
    .from('whatsapp_scheduled_promos')
    .delete()
    .eq('phone', phone)
    .eq('company', COMPANY)
    .is('sent_at', null)

  const { data, error } = await supabase
    .from('whatsapp_scheduled_promos')
    .insert({
      phone,
      company: COMPANY,
      kind: 'flavour_promo',
      order_id: orderId,
      send_at: sendAt,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

async function invokeDelayedPromoBackground(
  promoId: string,
  phone: string
): Promise<boolean> {
  const siteUrl = getSiteUrl()
  const secret = getCronSecret()
  if (!siteUrl || !secret) return false

  const res = await fetch(`${siteUrl}/.netlify/functions/delayed-flavour-promo-background`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      promoId,
      phone,
      delayMs: SODAMAX_FLAVOUR_PROMO_DELAY_MS,
    }),
  })

  if (!res.ok) {
    console.error(
      'delayed-flavour-promo background invoke failed:',
      res.status,
      await res.text()
    )
    return false
  }

  return true
}

/** Queue SodaMax MONIN promo 60s after a confirmed order only. */
export async function scheduleSodamaxFlavourPromo(
  phone: string,
  orderId: string
): Promise<void> {
  const promoId = await queueFlavourPromoInDb(phone, orderId)

  if (process.env.NODE_ENV === 'development' && !getSiteUrl()) {
    setTimeout(() => {
      void deliverScheduledSodamaxFlavourPromoById(promoId).catch(err => {
        if (!isWhatsAppAuthError(err)) {
          console.error('Dev delayed SodaMax promo failed:', err)
        }
      })
    }, SODAMAX_FLAVOUR_PROMO_DELAY_MS)
    return
  }

  await invokeDelayedPromoBackground(promoId, phone).catch(err => {
    console.error('invokeDelayedPromoBackground error:', err)
  })
}

export async function processScheduledPromos(): Promise<{
  processed: number
  sent: number
  skipped: number
  errors: number
}> {
  const supabase = getServiceClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('whatsapp_scheduled_promos')
    .select('id, phone, order_id')
    .eq('company', COMPANY)
    .is('sent_at', null)
    .lte('send_at', now)
    .order('send_at', { ascending: true })
    .limit(50)

  if (error) throw error

  const rows = data ?? []
  let sent = 0
  let skipped = 0
  let errors = 0

  for (const row of rows) {
    if (!row.order_id) {
      await markPromoSkipped(row.id, 'missing order_id')
      skipped++
      continue
    }

    try {
      const delivered = await deliverScheduledSodamaxFlavourPromoById(row.id)
      if (delivered) sent++
      else skipped++
    } catch (err) {
      errors++
      if (isWhatsAppAuthError(err)) {
        console.error(
          'WhatsApp auth error sending scheduled promo:',
          err instanceof Error ? err.message : err
        )
      } else {
        console.error('Scheduled SodaMax promo failed for', row.phone, err)
      }
    }
  }

  return { processed: rows.length, sent, skipped, errors }
}
