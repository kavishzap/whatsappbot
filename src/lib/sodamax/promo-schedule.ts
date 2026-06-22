import { getServiceClient } from '@/lib/supabase/admin'
import { getCronSecret } from '@/lib/cron-auth'
import { sendSodamaxFlavourPromo } from '@/lib/sodamax/promo'
import { runWithWhatsAppLine } from '@/lib/whatsapp-line'
import { isWhatsAppAuthError } from '@/lib/whatsapp'

export const SODAMAX_FLAVOUR_PROMO_DELAY_MS = 60_000

const COMPANY = 'sodamax' as const

function getSiteUrl(): string {
  return (
    process.env.URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    ''
  )
}

export async function deliverScheduledSodamaxFlavourPromo(phone: string): Promise<void> {
  await runWithWhatsAppLine('sodamax', async () => {
    await sendSodamaxFlavourPromo(phone)
  })
}

async function queueFlavourPromoInDb(phone: string): Promise<void> {
  const supabase = getServiceClient()
  const sendAt = new Date(Date.now() + SODAMAX_FLAVOUR_PROMO_DELAY_MS).toISOString()

  await supabase
    .from('whatsapp_scheduled_promos')
    .delete()
    .eq('phone', phone)
    .eq('company', COMPANY)
    .is('sent_at', null)

  const { error } = await supabase.from('whatsapp_scheduled_promos').insert({
    phone,
    company: COMPANY,
    kind: 'flavour_promo',
    send_at: sendAt,
  })

  if (error) throw error
}

async function invokeDelayedPromoBackground(phone: string): Promise<boolean> {
  const siteUrl = getSiteUrl()
  const secret = getCronSecret()
  if (!siteUrl || !secret) return false

  const res = await fetch(`${siteUrl}/.netlify/functions/delayed-flavour-promo-background`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone, delayMs: SODAMAX_FLAVOUR_PROMO_DELAY_MS }),
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

/** Queue SodaMax MONIN promo 60s after order thank-you. */
export async function scheduleSodamaxFlavourPromo(phone: string): Promise<void> {
  if (process.env.NODE_ENV === 'development' && !getSiteUrl()) {
    setTimeout(() => {
      void deliverScheduledSodamaxFlavourPromo(phone).catch(err => {
        if (!isWhatsAppAuthError(err)) {
          console.error('Dev delayed SodaMax promo failed:', err)
        }
      })
    }, SODAMAX_FLAVOUR_PROMO_DELAY_MS)
    return
  }

  const invoked = await invokeDelayedPromoBackground(phone).catch(err => {
    console.error('invokeDelayedPromoBackground error:', err)
    return false
  })

  if (invoked) return

  await queueFlavourPromoInDb(phone)
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
    .select('id, phone')
    .eq('company', COMPANY)
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
      await deliverScheduledSodamaxFlavourPromo(row.phone)

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
        console.error('Scheduled SodaMax promo failed for', row.phone, err)
      }
    }
  }

  return { processed: rows.length, sent, errors }
}
