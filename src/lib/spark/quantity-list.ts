import { sendWhatsAppButtons, sendWhatsAppList, sendWhatsAppText } from '@/lib/whatsapp'
import { QUANTITY_OPTIONS } from './constants'

export const BACK_TO_SUMMARY_ROW = {
  id: 'back_to_summary',
  title: 'Back to summary',
} as const

export async function sendQuantityList(
  phone: string,
  options?: { showBackToSummary?: boolean }
): Promise<void> {
  const rows: { id: string; title: string }[] = QUANTITY_OPTIONS.map(opt => ({
    id: opt.id,
    title: opt.label,
  }))

  if (options?.showBackToSummary) {
    rows.push(BACK_TO_SUMMARY_ROW)
  }

  await sendWhatsAppList(
    phone,
    'How many would you like to order?',
    'Select quantity',
    rows
  )
}

export async function sendCustomQuantityPrompt(
  phone: string,
  options?: { showBackToSummary?: boolean; message?: string }
): Promise<void> {
  const message =
    options?.message ?? 'Please type your custom quantity (e.g. 5, 10, 25).'

  if (options?.showBackToSummary) {
    await sendWhatsAppButtons(phone, message, [BACK_TO_SUMMARY_ROW])
    return
  }

  await sendWhatsAppText(phone, message)
}
