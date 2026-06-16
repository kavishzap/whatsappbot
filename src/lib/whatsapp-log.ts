import { getCurrentWhatsAppLine, getPhoneNumberIdForLine } from './whatsapp-line'

function formatLog(data: unknown): string {
  return JSON.stringify(data, null, 2)
}

export function logWhatsAppInbound(details: Record<string, unknown>): void {
  console.log(`WhatsApp inbound:\n${formatLog(details)}`)
}

export function logWhatsAppOutbound(
  to: string,
  payload: Record<string, unknown>,
  extra?: Record<string, unknown>
): void {
  const line = getCurrentWhatsAppLine()
  console.log(
    `WhatsApp outbound:\n${formatLog({
      line,
      phoneNumberId: getPhoneNumberIdForLine(line),
      to,
      ...extra,
      payload,
    })}`
  )
}

export function logWhatsAppMediaUpload(details: Record<string, unknown>): void {
  const line = getCurrentWhatsAppLine()
  console.log(
    `WhatsApp media upload:\n${formatLog({
      line,
      phoneNumberId: getPhoneNumberIdForLine(line),
      ...details,
    })}`
  )
}
