import type { IncomingWhatsAppMessage } from './types'

/**
 * Maps bulk / template marketing copy to whatsapp_bot_items.id.
 * Add a row per campaign: include product name fragments and the item UUID.
 *
 * Tip: In Meta, set the template button payload to the product name (or UUID)
 * so "Order Now" clicks include a matchable string even when the title is generic.
 */
export interface MarketingProductMapping {
  itemId: string
  /** Case-insensitive substring match against inbound text / button payload / descriptions */
  contains: string[]
  /**
   * Template CTA labels (e.g. "Order Now") when Meta sends the same payload for every campaign.
   * Matched on webhook `type: "button"` (marketing templates), not in-bot reply buttons.
   */
  templateButtonLabels?: string[]
}

export const SPARK_MARKETING_PRODUCT_MAPPINGS: MarketingProductMapping[] = [
  {
    itemId: 'd32cc4c1-6aac-4886-b542-c25f8a3de6f7',
    contains: [
      'd32cc4c1-6aac-4886-b542-c25f8a3de6f7',
      '6-IN-1 STEAM CLEANER',
      '6 in 1 steam cleaner',
      'STEAM CLEANER',
      'WAS Rs 1,800',
      'NOW ONLY Rs 1,500',
      'Chemical-free cleaning',
    ],
    // Current bulk template CTA — Meta often only sends payload "Order Now".
    templateButtonLabels: ['Order Now'],
  },
  {
    itemId: '60f48211-7495-4e29-ad12-7fdbc1bc492d',
    contains: [
      '60f48211-7495-4e29-ad12-7fdbc1bc492d',
      'Premium 8 Sizes Glass Container Set',
      '8 Sizes Glass Container',
      'Glass Container Set',
    ],
  },
]

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** All user-visible strings from a webhook message (template body, button payload, etc.). */
export function collectInboundCorpus(message: IncomingWhatsAppMessage): string {
  const parts: string[] = []

  if (message.text?.body?.trim()) parts.push(message.text.body.trim())

  if (message.type === 'button' && message.button) {
    if (message.button.payload?.trim()) parts.push(message.button.payload.trim())
    if (message.button.text?.trim()) parts.push(message.button.text.trim())
  }

  const buttonReply = message.interactive?.button_reply
  if (buttonReply?.id?.trim()) parts.push(buttonReply.id.trim())
  if (buttonReply?.title?.trim()) parts.push(buttonReply.title.trim())

  const listReply = message.interactive?.list_reply
  if (listReply?.id?.trim()) parts.push(listReply.id.trim())
  if (listReply?.title?.trim()) parts.push(listReply.title.trim())
  if (listReply?.description?.trim()) parts.push(listReply.description.trim())

  return parts.join('\n')
}

function templateButtonLabel(message: IncomingWhatsAppMessage): string {
  if (message.type !== 'button' || !message.button) return ''
  return (message.button.payload?.trim() || message.button.text?.trim() || '').trim()
}

export function resolveMarketingProductItemId(message: IncomingWhatsAppMessage): string | null {
  const templateLabel = normalizeForMatch(templateButtonLabel(message))

  if (templateLabel) {
    for (const mapping of SPARK_MARKETING_PRODUCT_MAPPINGS) {
      for (const label of mapping.templateButtonLabels ?? []) {
        if (templateLabel === normalizeForMatch(label)) {
          return mapping.itemId
        }
      }
    }
  }

  const corpus = normalizeForMatch(collectInboundCorpus(message))
  if (!corpus) return null

  for (const mapping of SPARK_MARKETING_PRODUCT_MAPPINGS) {
    for (const needle of mapping.contains) {
      const normalizedNeedle = normalizeForMatch(needle)
      if (!normalizedNeedle) continue
      if (corpus.includes(normalizedNeedle)) {
        return mapping.itemId
      }
    }
  }

  return null
}
