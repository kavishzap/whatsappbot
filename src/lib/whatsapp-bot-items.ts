export interface WhatsAppBotItem {
  id: string
  ad_link: string
  product_name: string
  price: number | null
  image_base64: string | null
  description: string
  created_at: string
  updated_at: string
}

export interface BotItemPayload {
  ad_link: string
  product_name: string
  price: number
  image_base64: string | null
  description: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

async function request<T>(
  method: string,
  options?: { id?: string; body?: BotItemPayload }
): Promise<T> {
  const params = options?.id ? `?id=${options.id}` : ''
  const res = await fetch(`/api/whatsapp-bot-items${params}`, {
    method,
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  const json: ApiResponse<T> = await res.json()

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed')
  }

  return json.data as T
}

async function requestVoid(method: string, id: string): Promise<void> {
  const res = await fetch(`/api/whatsapp-bot-items?id=${id}`, { method })
  const json: ApiResponse<unknown> = await res.json()

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed')
  }
}

export function fetchBotItems(): Promise<WhatsAppBotItem[]> {
  return request<WhatsAppBotItem[]>('GET')
}

export function createBotItem(body: BotItemPayload): Promise<WhatsAppBotItem> {
  return request<WhatsAppBotItem>('POST', { body })
}

export function updateBotItem(id: string, body: BotItemPayload): Promise<WhatsAppBotItem> {
  return request<WhatsAppBotItem>('PUT', { id, body })
}

export function deleteBotItem(id: string): Promise<void> {
  return requestVoid('DELETE', id)
}

export function stripBase64Prefix(dataUrl: string): string {
  const idx = dataUrl.indexOf(',')
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl
}

export function toImageSrc(base64: string | null): string | null {
  if (!base64) return null
  if (base64.startsWith('data:')) return base64
  return `data:image/jpeg;base64,${base64}`
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(stripBase64Prefix(reader.result as string))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
