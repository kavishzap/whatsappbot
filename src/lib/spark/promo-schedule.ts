import { getServiceClient } from '@/lib/supabase/admin'
import { sendSodamaxFlavourPromo } from '@/lib/sodamax/promo'
import { runWithWhatsAppLine } from '@/lib/whatsapp-line'
import { isWhatsAppAuthError } from '@/lib/whatsapp'

export const SPARK_FLAVOUR_PROMO_DELAY_MS = 60_000

export async function deliverSparkFlavourPromo(phone: string): Promise<void> {
  await runWithWhatsAppLine('spark', async () => {
    await sendSodamaxFlavourPromo(phone)
  })
}

/** Queue MONIN / Refill & Products promo 60s after Spark order thank-you. */
export async function scheduleSparkFlavourPromo(phone: string): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    setTimeout(() => {
      void deliverSparkFlavourPromo(phone).catch(err => {
        if (!isWhatsAppAuthError(err)) {
          console.error('Dev delayed Spark promo failed:', err)
        }
      })
    }, SPARK_FLAVOUR_PROMO_DELAY_MS)
    return
  }

  const supabase = getServiceClient()
  const sendAt = new Date(Date.now() + SPARK_FLAVOUR_PROMO_DELAY_MS).toISOString()

  await supabase
    .from('whatsapp_scheduled_promos')
    .delete()
    .eq('phone', phone)
    .eq('company', 'spark')
    .is('sent_at', null)

  const { error } = await supabase.from('whatsapp_scheduled_promos').insert({
    phone,
    company: 'spark',
    kind: 'flavour_promo',
    send_at: sendAt,
  })

  if (error) throw error
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
      if (row.company === 'spark') {
        await deliverSparkFlavourPromo(row.phone)
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
