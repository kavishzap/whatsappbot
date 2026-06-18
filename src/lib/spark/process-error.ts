import { sendWhatsAppCtaUrl, isWhatsAppAuthError } from '@/lib/whatsapp'

export type ProcessErrorSupportOptions = {
  message: string
  ctaLabel: string
  supportUrl: string
  reset?: () => Promise<void>
  logLabel?: string
}

/** Send a user-facing error with the same WhatsApp "Message us" CTA as Other Query. */
export async function sendProcessErrorWithSupport(
  phone: string,
  options: ProcessErrorSupportOptions
): Promise<void> {
  const { message, ctaLabel, supportUrl, reset, logLabel = 'WhatsApp bot' } = options

  try {
    await sendWhatsAppCtaUrl(phone, message, ctaLabel, supportUrl)
  } catch (replyErr) {
    if (isWhatsAppAuthError(replyErr)) {
      console.error(`${logLabel} auth error (could not send process error):`, replyErr.message)
    } else {
      console.error(`${logLabel} failed to send process error message:`, replyErr)
    }
  }

  if (reset) {
    try {
      await reset()
    } catch {
      /* ignore */
    }
  }
}
