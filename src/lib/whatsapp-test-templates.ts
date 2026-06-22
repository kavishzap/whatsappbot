import type { WhatsAppLine } from '@/lib/whatsapp-line'

/** Default Meta template names for admin test sends (override via env). */
export const DEFAULT_WHATSAPP_TEST_TEMPLATES: Record<WhatsAppLine, string> = {
  spark: 'spark_welcome',
  sodamax: 'sodamax_welcome',
}

export function resolveWhatsAppTestTemplateName(line: WhatsAppLine): string {
  if (line === 'sodamax') {
    return (
      process.env.WHATSAPP_TEST_TEMPLATE_2?.trim() ||
      process.env.WHATSAPP_TEST_TEMPLATE?.trim() ||
      DEFAULT_WHATSAPP_TEST_TEMPLATES.sodamax
    )
  }

  return (
    process.env.WHATSAPP_TEST_TEMPLATE?.trim() || DEFAULT_WHATSAPP_TEST_TEMPLATES.spark
  )
}

export function resolveWhatsAppTestTemplateLanguage(): string {
  return process.env.WHATSAPP_TEST_TEMPLATE_LANGUAGE?.trim() || 'en_US'
}

export function welcomeTemplateLabel(line: WhatsAppLine): string {
  return resolveWhatsAppTestTemplateName(line)
}
