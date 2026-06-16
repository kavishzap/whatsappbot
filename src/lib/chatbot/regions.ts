import { sendWhatsAppList } from '@/lib/whatsapp'
import { MAURITIUS_DISTRICTS } from './constants'

export async function sendCityList(phone: string): Promise<void> {
  await sendWhatsAppList(
    phone,
    'Select your region:',
    'Select region',
    MAURITIUS_DISTRICTS.map(d => ({ id: d.id, title: d.name })),
    'Regions'
  )
}
