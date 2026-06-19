import fs from 'fs'
import path from 'path'
import {
  sendWhatsAppButtons,
  sendWhatsAppImage,
  uploadWhatsAppMedia,
  isWhatsAppAuthError,
} from '@/lib/whatsapp'
import { getCachedMediaId, setCachedMediaId } from '@/lib/spark/media-cache'
import {
  SODAMAX_FLAVOUR_PROMO_BUTTON,
  SODAMAX_FLAVOUR_PROMO_CAPTION,
} from './constants'

const PROMO_MEDIA_CACHE_KEY = 'sodamax_flavour_promo'

function resolvePromoImagePath(): string {
  const candidates = [
    path.join(process.cwd(), 'public', 'sodamaxflavour.jpeg'),
    path.join(process.cwd(), 'src', 'app', 'sodamaxflavour.jpeg'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  throw new Error('sodamaxflavour.jpeg not found in public/ or src/app/')
}

async function getPromoMediaId(): Promise<string> {
  const cached = getCachedMediaId(PROMO_MEDIA_CACHE_KEY)
  if (cached) return cached

  const buffer = fs.readFileSync(resolvePromoImagePath())
  const mediaId = await uploadWhatsAppMedia(buffer, 'image/jpeg')
  setCachedMediaId(PROMO_MEDIA_CACHE_KEY, mediaId)
  return mediaId
}

/** Post-order MONIN / refill promo with CTA back into the product menu flow. */
export async function sendSodamaxFlavourPromo(phone: string): Promise<void> {
  try {
    const mediaId = await getPromoMediaId()
    await sendWhatsAppImage(phone, mediaId, SODAMAX_FLAVOUR_PROMO_CAPTION)
    await sendWhatsAppButtons(phone, 'Would you like to order?', [
      {
        id: SODAMAX_FLAVOUR_PROMO_BUTTON.id,
        title: SODAMAX_FLAVOUR_PROMO_BUTTON.title,
      },
    ])
  } catch (err) {
    if (isWhatsAppAuthError(err)) throw err
    console.error('SodaMax flavour promo failed:', err)
    await sendWhatsAppButtons(phone, SODAMAX_FLAVOUR_PROMO_CAPTION, [
      {
        id: SODAMAX_FLAVOUR_PROMO_BUTTON.id,
        title: SODAMAX_FLAVOUR_PROMO_BUTTON.title,
      },
    ])
  }
}
