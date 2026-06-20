import { sendWhatsAppButtons } from '@/lib/whatsapp'
import { getDraftOrderById, patchDraftOrder } from './orders'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import type { MessageInput } from './types'

export const SPARK_SKIP_NOTES_BUTTON = { id: 'skip_notes', title: 'Skip' } as const
export const SODAMAX_SKIP_NOTES_BUTTON = { id: 'sm_skip_notes', title: 'Skip' } as const

export async function fetchDraftOrderNotes(
  draftOrderId: string | null | undefined,
  company: WhatsAppCompany
): Promise<string | null> {
  if (!draftOrderId) return null
  const order = await getDraftOrderById(draftOrderId, company)
  const notes = order?.notes?.trim()
  return notes || null
}

export function formatNotesSummaryLines(notes: string | null): string[] {
  return notes ? [`Notes: ${notes}`] : []
}

export function isSkipNotesAnswer(input: MessageInput, skipButtonId: string): boolean {
  return input.type === 'button' && input.value === skipButtonId
}

export function parseOrderNotesText(input: MessageInput): string | null {
  if (input.type !== 'text') return null
  const text = input.value.trim()
  if (!text) return null
  return text.slice(0, 500)
}

export async function sendOrderNotesPrompt(
  phone: string,
  skipButton: { id: string; title: string }
): Promise<void> {
  await sendWhatsAppButtons(phone, 'Please type your order notes.', [skipButton])
}

export async function saveDraftOrderNotes(
  orderId: string,
  notes: string | null,
  company: WhatsAppCompany
): Promise<{ success: boolean; error?: string }> {
  return patchDraftOrder(orderId, { company, notes })
}
