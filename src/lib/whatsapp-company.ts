export type WhatsAppCompany = 'spark' | 'sodamax'

export const WHATSAPP_COMPANIES: WhatsAppCompany[] = ['spark', 'sodamax']

export function isWhatsAppCompany(value: string | null | undefined): value is WhatsAppCompany {
  return value === 'spark' || value === 'sodamax'
}
