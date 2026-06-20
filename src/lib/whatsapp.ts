const GRAPH_API = 'https://graph.facebook.com/v21.0'

export class WhatsAppAuthError extends Error {
  readonly code: number
  readonly expired: boolean

  constructor(message: string, code: number, expired: boolean) {
    super(message)
    this.name = 'WhatsAppAuthError'
    this.code = code
    this.expired = expired
  }
}

function parseApiError(result: { error?: { message?: string; code?: number; error_subcode?: number } }) {
  const err = result?.error
  const code = err?.code ?? 0
  const message = err?.message ?? 'WhatsApp API request failed'
  const expired = code === 190 || err?.error_subcode === 463

  if (code === 190 || message.toLowerCase().includes('authentication')) {
    throw new WhatsAppAuthError(
      expired
        ? 'Meta access token has expired. Generate a new token in Meta Developer Console and update META_ACCESS_TOKEN in .env.local, then restart the dev server.'
        : `Meta authentication failed: ${message}`,
      code,
      expired
    )
  }

  throw new Error(message)
}

export function formatWhatsAppSendError(result: {
  error?: { message?: string; code?: number; error_subcode?: number }
}): string {
  const err = result?.error
  const message = err?.message ?? 'WhatsApp API request failed'
  const code = err?.code ?? 0

  if (
    code === 131047 ||
    message.toLowerCase().includes('24 hours') ||
    message.toLowerCase().includes('re-engagement')
  ) {
    return 'This number has not messaged your WhatsApp line recently. Use a template message (configured automatically for test sends).'
  }

  if (code === 131026 || message.toLowerCase().includes('not a valid whatsapp')) {
    return 'That phone number is not registered on WhatsApp or is invalid.'
  }

  if (code === 132000 || message.toLowerCase().includes('template')) {
    return `WhatsApp template error: ${message}. Check that the template exists and is approved in Meta Business Manager.`
  }

  return message
}

import { getCurrentWhatsAppLine, getPhoneNumberIdForLine } from './whatsapp-line'
import { logWhatsAppMediaUpload, logWhatsAppOutbound } from './whatsapp-log'

function getConfig() {
  const accessToken = (
    process.env.META_ACCESS_TOKEN ??
    process.env.WHATSAPP_ACCESS_TOKEN
  )?.trim()

  if (!accessToken) {
    throw new WhatsAppAuthError(
      'META_ACCESS_TOKEN is not set. Add your Meta WhatsApp access token to .env.local and restart the dev server.',
      0,
      false
    )
  }

  const line = getCurrentWhatsAppLine()
  const phoneNumberId = getPhoneNumberIdForLine(line)

  return { phoneNumberId, accessToken }
}

export async function sendWhatsAppText(to: string, text: string) {
  const { phoneNumberId, accessToken } = getConfig()

  const payload = {
    type: 'text',
    text: { body: text },
  }

  const response = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      ...payload,
    }),
  })

  const result = await response.json()

  if (!response.ok) {
    console.error('WhatsApp text error:', response.status, JSON.stringify(result))
    parseApiError(result)
  }

  logWhatsAppOutbound(to, payload, { response: result })

  return result
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode = 'en_US'
) {
  const payload = {
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  }

  return sendMessagePayload(to, payload)
}

export async function uploadWhatsAppMedia(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const { phoneNumberId, accessToken } = getConfig()
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'

  const formData = new FormData()
  formData.append('messaging_product', 'whatsapp')
  formData.append('type', mimeType)
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), `image.${ext}`)

  const response = await fetch(`${GRAPH_API}/${phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  })

  const result = await response.json()

  if (!response.ok || !result.id) {
    console.error('WhatsApp media upload error:', response.status, JSON.stringify(result))
    parseApiError(result)
  }

  logWhatsAppMediaUpload({ mimeType, bytes: buffer.length, mediaId: result.id, response: result })

  return result.id as string
}

export async function sendWhatsAppImage(to: string, mediaId: string, caption?: string) {
  const { phoneNumberId, accessToken } = getConfig()

  const image: { id: string; caption?: string } = { id: mediaId }
  if (caption) {
    image.caption = caption.slice(0, 1024)
  }

  const payload = { type: 'image', image }
  const response = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      ...payload,
    }),
  })

  const result = await response.json()

  if (!response.ok) {
    console.error('WhatsApp image error:', response.status, JSON.stringify(result))
    parseApiError(result)
  }

  logWhatsAppOutbound(to, payload, { response: result })

  return result
}

async function sendMessagePayload(to: string, payload: Record<string, unknown>) {
  const { phoneNumberId, accessToken } = getConfig()

  const response = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, ...payload }),
  })

  const result = await response.json()

  if (!response.ok) {
    console.error('WhatsApp API error:', response.status, JSON.stringify(result))
    parseApiError(result)
  }

  logWhatsAppOutbound(to, payload, { response: result })

  return result
}

export async function sendWhatsAppButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
) {
  return sendMessagePayload(to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText.slice(0, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  })
}

export async function sendWhatsAppCtaUrl(
  to: string,
  bodyText: string,
  buttonLabel: string,
  url: string
) {
  return sendMessagePayload(to, {
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      body: { text: bodyText.slice(0, 1024) },
      action: {
        name: 'cta_url',
        parameters: {
          display_text: buttonLabel.slice(0, 20),
          url,
        },
      },
    },
  })
}

export async function sendWhatsAppList(
  to: string,
  bodyText: string,
  buttonLabel: string,
  rows: { id: string; title: string; description?: string }[],
  sectionTitle = 'Products'
) {
  return sendMessagePayload(to, {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText.slice(0, 1024) },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: [
          {
            title: sectionTitle.slice(0, 24),
            rows: rows.slice(0, 10).map(r => ({
              id: r.id,
              title: r.title.slice(0, 24),
              description: r.description?.slice(0, 72),
            })),
          },
        ],
      },
    },
  })
}

export function base64ToBuffer(base64: string): { buffer: Buffer; mimeType: string } {
  if (base64.startsWith('data:')) {
    const [header, data] = base64.split(',')
    const mimeMatch = header.match(/data:(.*?);/)
    return {
      buffer: Buffer.from(data, 'base64'),
      mimeType: mimeMatch?.[1] ?? 'image/jpeg',
    }
  }

  return { buffer: Buffer.from(base64, 'base64'), mimeType: 'image/jpeg' }
}

export function isWhatsAppAuthError(err: unknown): err is WhatsAppAuthError {
  return err instanceof WhatsAppAuthError
}
