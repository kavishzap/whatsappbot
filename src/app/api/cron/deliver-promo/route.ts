import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { deliverFlavourPromo } from '@/lib/spark/promo-schedule'
import type { WhatsAppLine } from '@/lib/whatsapp-line'

/** Internal endpoint used by the delayed promo background worker. */
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: { phone?: string; company?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const phone = body.phone?.trim()
  const company = body.company

  if (!phone || (company !== 'spark' && company !== 'sodamax')) {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
  }

  try {
    await deliverFlavourPromo(phone, company as WhatsAppLine)
    return NextResponse.json({ success: true, phone, company })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Promo delivery failed'
    console.error('deliver-promo error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
