import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export interface BotItemColor {
  id?: string
  color_name: string
  color_hex: string | null
  sort_order?: number
}

export interface WhatsAppBotItemSummary {
  id: string
  company: WhatsAppCompany
  ad_link: string | null
  product_name: string
  price: number | null
  description: string
  has_image: boolean
  colors?: BotItemColor[]
  created_at: string
  updated_at: string
}

export interface WhatsAppBotItem extends WhatsAppBotItemSummary {
  image_base64: string | null
}

export interface BotItemPayload {
  company: WhatsAppCompany
  ad_link?: string | null
  product_name: string
  price: number
  image_base64: string | null
  description?: string
  colors?: BotItemColor[]
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

function companyQuery(company: WhatsAppCompany): string {
  return `company=${company}`
}

async function request<T>(
  method: string,
  company: WhatsAppCompany,
  options?: { id?: string; body?: BotItemPayload }
): Promise<T> {
  const idPart = options?.id ? `&id=${options.id}` : ''
  const params = `?${companyQuery(company)}${idPart}`
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

async function requestVoid(method: string, company: WhatsAppCompany, id: string): Promise<void> {
  const res = await fetch(`/api/whatsapp-bot-items?${companyQuery(company)}&id=${id}`, { method })
  const json: ApiResponse<unknown> = await res.json()

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed')
  }
}

export function fetchBotItems(company: WhatsAppCompany): Promise<WhatsAppBotItemSummary[]> {
  return request<WhatsAppBotItemSummary[]>('GET', company)
}

export function fetchBotItem(company: WhatsAppCompany, id: string): Promise<WhatsAppBotItem> {
  return request<WhatsAppBotItem>('GET', company, { id })
}

export function createBotItem(company: WhatsAppCompany, body: BotItemPayload): Promise<WhatsAppBotItem> {
  return request<WhatsAppBotItem>('POST', company, { body: { ...body, company } })
}

export function updateBotItem(
  company: WhatsAppCompany,
  id: string,
  body: BotItemPayload
): Promise<WhatsAppBotItem> {
  return request<WhatsAppBotItem>('PUT', company, { id, body: { ...body, company } })
}

export function deleteBotItem(company: WhatsAppCompany, id: string): Promise<void> {
  return requestVoid('DELETE', company, id)
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

export function colorsFromApi(
  colors: BotItemColor[] | undefined
): { id: string; colorName: string; colorHex: string }[] {
  return (colors ?? []).map(c => ({
    id: c.id ?? crypto.randomUUID(),
    colorName: c.color_name,
    colorHex: c.color_hex ?? '#10b981',
  }))
}

export function colorsToApi(
  colors: { colorName: string; colorHex: string }[]
): BotItemColor[] {
  return colors
    .filter(c => c.colorName.trim())
    .map((c, index) => ({
      color_name: c.colorName.trim(),
      color_hex: c.colorHex.trim() || null,
      sort_order: index,
    }))
}
