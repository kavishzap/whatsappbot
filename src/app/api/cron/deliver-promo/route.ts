import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { deliverScheduledSodamaxFlavourPromoById } from '@/lib/sodamax/promo-schedule'

/** Internal endpoint used by the delayed SodaMax promo background worker. */
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: { promoId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const promoId = body.promoId?.trim()

  if (!promoId) {
    return NextResponse.json({ success: false, error: 'Missing promoId' }, { status: 400 })
  }

  try {
    const sent = await deliverScheduledSodamaxFlavourPromoById(promoId)
    return NextResponse.json({
      success: true,
      sent,
      promoId,
      company: 'sodamax',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Promo delivery failed'
    console.error('deliver-promo error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
