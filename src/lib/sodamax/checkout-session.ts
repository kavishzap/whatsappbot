import { createHmac, timingSafeEqual } from 'crypto'
import { normalizeWhatsAppPhone } from '@/lib/spark/orders'

export interface CheckoutSessionPayload {
  phone: string
  name: string | null
  exp: number
}

const DEFAULT_TTL_HOURS = 48

function getSecret(): string {
  const secret = process.env.SODAMAX_CHECKOUT_SESSION_SECRET?.trim()
  if (!secret) {
    throw new Error(
      'SODAMAX_CHECKOUT_SESSION_SECRET is not set. Add it to .env.local (same value on the order platform).'
    )
  }
  return secret
}

export function signCheckoutSession(
  phone: string,
  name?: string | null,
  ttlHours = DEFAULT_TTL_HOURS
): string {
  const secret = getSecret()
  const payload: CheckoutSessionPayload = {
    phone: normalizeWhatsAppPhone(phone),
    name: name?.trim() || null,
    exp: Math.floor(Date.now() / 1000) + ttlHours * 3600,
  }

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

export function verifyCheckoutSession(token: string): CheckoutSessionPayload | null {
  const secret = process.env.SODAMAX_CHECKOUT_SESSION_SECRET?.trim()
  if (!secret) return null

  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [encoded, sig] = parts
  if (!encoded || !sig) return null

  const expected = createHmac('sha256', secret).update(encoded).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)

  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as CheckoutSessionPayload
    if (!payload.phone || typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return {
      phone: normalizeWhatsAppPhone(payload.phone),
      name: payload.name?.trim() || null,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}
