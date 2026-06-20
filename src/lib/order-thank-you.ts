import { sendWhatsAppButtons } from '@/lib/whatsapp'
import { DELIVERY_CONFIRMATION_MESSAGE, formatTotal } from '@/lib/spark/constants'

export function buildOrderThankYouMessage(orderRef: string, total: number): string {
  return [
    'Thank you! 🎉 Your order has been confirmed.',
    '',
    `*Order ref:* *${orderRef}*`,
    `*Total:* *${formatTotal(total)}*`,
    '',
    DELIVERY_CONFIRMATION_MESSAGE,
    '',
    'Need help with something else? 😊',
  ].join('\n')
}

export async function sendOrderThankYouWithOtherQuery(
  phone: string,
  orderRef: string,
  total: number,
  button: { id: string; title?: string }
): Promise<void> {
  await sendWhatsAppButtons(phone, buildOrderThankYouMessage(orderRef, total), [
    { id: button.id, title: button.title ?? 'Other Query' },
  ])
}
