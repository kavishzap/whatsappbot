import { AsyncLocalStorage } from 'async_hooks'

export type WhatsAppLine = 'spark' | 'sodamax'

export const LINE_LABELS: Record<WhatsAppLine, string> = {
  spark: 'Spark Distributors',
  sodamax: 'SodaMax',
}

const lineStorage = new AsyncLocalStorage<WhatsAppLine>()

export function getCurrentWhatsAppLine(): WhatsAppLine {
  return lineStorage.getStore() ?? 'spark'
}

export function runWithWhatsAppLine<T>(line: WhatsAppLine, fn: () => T): T {
  return lineStorage.run(line, fn)
}

export function resolveWhatsAppLine(phoneNumberId?: string): WhatsAppLine {
  if (!phoneNumberId) return 'spark'

  const secondary = process.env.WHATSAPP_PHONE_NUMBER_ID_2?.trim()
  if (secondary && phoneNumberId === secondary) return 'sodamax'

  return 'spark'
}

export function getPhoneNumberIdForLine(line: WhatsAppLine = getCurrentWhatsAppLine()): string {
  const accessToken = (
    process.env.META_ACCESS_TOKEN ??
    process.env.WHATSAPP_ACCESS_TOKEN
  )?.trim()

  if (!accessToken) {
    throw new Error('META_ACCESS_TOKEN is not set.')
  }

  if (line === 'sodamax') {
    const id = process.env.WHATSAPP_PHONE_NUMBER_ID_2?.trim()
    if (!id) {
      throw new Error(
        'WHATSAPP_PHONE_NUMBER_ID_2 is not set. Add it to .env.local for the SodaMax number.'
      )
    }
    return id
  }

  const id = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  if (!id) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set.')
  }
  return id
}
