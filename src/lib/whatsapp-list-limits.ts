/** WhatsApp interactive list row title limit. */
export const WHATSAPP_LIST_ROW_TITLE_MAX = 24

export function whatsappListTitleLimitMessage(fieldLabel = 'Name'): string {
  return `${fieldLabel} must be ${WHATSAPP_LIST_ROW_TITLE_MAX} characters or fewer (WhatsApp list limit).`
}
