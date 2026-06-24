import { sendWhatsAppList, sendWhatsAppText } from '@/lib/whatsapp'
import { MAURITIUS_REGIONS } from './constants'

export async function sendRegionList(phone: string): Promise<void> {
  await sendWhatsAppList(
    phone,
    'Select your region:',
    'Select region',
    MAURITIUS_REGIONS.map(r => ({ id: r.id, title: r.name })),
    'Regions'
  )
}

export async function sendDeliveryAddressPrompt(phone: string): Promise<void> {
  await sendWhatsAppText(
    phone,
    '📍 Please enter your *Delivery Address*.'
  )
}
