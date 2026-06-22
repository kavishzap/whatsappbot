import { getServiceClient } from '@/lib/supabase/admin'
import { getCronSecret } from '@/lib/cron-auth'
import { sendSodamaxFlavourPromo } from '@/lib/sodamax/promo'
import { runWithWhatsAppLine, type WhatsAppLine } from '@/lib/whatsapp-line'
import { isWhatsAppAuthError } from '@/lib/whatsapp'

export const FLAVOUR_PROMO_DELAY_MS = 60_000

/** @deprecated Use FLAVOUR_PROMO_DELAY_MS */
export const SPARK_FLAVOUR_PROMO_DELAY_MS = FLAVOUR_PROMO_DELAY_MS

function getSiteUrl(): string {
  return (
    process.env.URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    ''
  )
}

export async function deliverFlavourPromo(phone: string, company: WhatsAppLine): Promise<void> {
  await runWithWhatsAppLine(company, async () => {
    await sendSodamaxFlavourPromo(phone)
  })
}

async function queueFlavourPromoInDb(phone: string, company: WhatsAppLine): Promise<void> {
  const supabase = getServiceClient()
  const sendAt = new Date(Date.now() + FLAVOUR_PROMO_DELAY_MS).toISOString()

  await supabase
    .from('whatsapp_scheduled_promos')
    .delete()
    .eq('phone', phone)
    .eq('company', company)
    .is('sent_at', null)

  const { error } = await supabase.from('whatsapp_scheduled_promos').insert({
    phone,
    company,
    kind: 'flavour_promo',
    send_at: sendAt,
  })

  if (error) throw error
}

async function invokeDelayedPromoBackground(
  phone: string,
  company: WhatsAppLine
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
    body: JSON.stringify({ phone, company, delayMs: FLAVOUR_PROMO_DELAY_MS }),
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

/** Queue MONIN / Refill & Products promo 60s after order thank-you. */
export async function scheduleFlavourPromo(phone: string, company: WhatsAppLine): Promise<void> {
  if (process.env.NODE_ENV === 'development' && !getSiteUrl()) {
    setTimeout(() => {
      void deliverFlavourPromo(phone, company).catch(err => {
        if (!isWhatsAppAuthError(err)) {
          console.error(`Dev delayed ${company} promo failed:`, err)
        }
      })
    }, FLAVOUR_PROMO_DELAY_MS)
    return
  }

  const invoked = await invokeDelayedPromoBackground(phone, company).catch(err => {
    console.error('invokeDelayedPromoBackground error:', err)
    return false
  })

  if (invoked) return

  await queueFlavourPromoInDb(phone, company)
}

/** @deprecated Use scheduleFlavourPromo(phone, 'spark') */
export async function scheduleSparkFlavourPromo(phone: string): Promise<void> {
  return scheduleFlavourPromo(phone, 'spark')
}

export async function processScheduledPromos(): Promise<{
  processed: number
  sent: number
  errors: number
}> {
  const supabase = getServiceClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('whatsapp_scheduled_promos')
    .select('id, phone, company')
    .is('sent_at', null)
    .lte('send_at', now)
    .order('send_at', { ascending: true })
    .limit(50)

  if (error) throw error

  const rows = data ?? []
  let sent = 0
  let errors = 0

  for (const row of rows) {
    try {
      if (row.company === 'spark' || row.company === 'sodamax') {
        await deliverFlavourPromo(row.phone, row.company)
      }

      await supabase
        .from('whatsapp_scheduled_promos')
        .update({ sent_at: new Date().toISOString(), error: null })
        .eq('id', row.id)

      sent++
    } catch (err) {
      errors++
      const message = err instanceof Error ? err.message : String(err)
      await supabase
        .from('whatsapp_scheduled_promos')
        .update({ error: message })
        .eq('id', row.id)

      if (isWhatsAppAuthError(err)) {
        console.error('WhatsApp auth error sending scheduled promo:', message)
      } else {
        console.error('Scheduled promo failed for', row.company, row.phone, err)
      }
    }
  }

  return { processed: rows.length, sent, errors }
}
