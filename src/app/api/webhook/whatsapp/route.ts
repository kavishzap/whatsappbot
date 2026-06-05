import { handleChatbotMessage } from '@/lib/chatbot/flow'
import { isWhatsAppAuthError } from '@/lib/whatsapp'
import type { IncomingWhatsAppMessage } from '@/lib/chatbot/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return Response.json({ received: true })
  }

  console.log('Webhook payload:', JSON.stringify(body, null, 2))

  const value = (body as { entry?: { changes?: { value?: unknown }[] }[] })
    .entry?.[0]?.changes?.[0]?.value as {
    messages?: IncomingWhatsAppMessage[]
  } | undefined

  const message = value?.messages?.[0]

  if (!message) {
    console.log('No message in payload (likely status update)')
    return Response.json({ received: true })
  }

  console.log('Message type:', message.type, 'From:', message.from)

  // Respond to Meta immediately; process the bot flow in the background.
  handleChatbotMessage(message).catch(error => {
    if (isWhatsAppAuthError(error)) {
      console.error('WhatsApp auth error:', error.message)
      return
    }
    console.error('Webhook handler error:', error)
  })

  return Response.json({ received: true })
}
