export interface WhatsAppProductColor {
  id?: string
  color_name: string
  color_hex: string | null
  sort_order?: number
}

export interface WhatsAppProductSummary {
  id: string
  name: string
  price: number
  created_at: string
  updated_at: string
  colors: WhatsAppProductColor[]
}

export interface WhatsAppProduct extends WhatsAppProductSummary {
  image_base64: string | null
}

export interface WhatsAppProductPayload {
  name: string
  price: number
  image_base64: string | null
  colors: WhatsAppProductColor[]
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

async function request<T>(
  method: string,
  options?: { id?: string; body?: WhatsAppProductPayload }
): Promise<T> {
  const params = options?.id ? `?id=${options.id}` : ''
  const res = await fetch(`/api/whatsapp-products${params}`, {
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
  const res = await fetch(`/api/whatsapp-products?id=${id}`, { method })
  const json: ApiResponse<unknown> = await res.json()

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed')
  }
}

export function fetchWhatsAppProducts(): Promise<WhatsAppProductSummary[]> {
  return request<WhatsAppProductSummary[]>('GET')
}

export function fetchWhatsAppProduct(id: string): Promise<WhatsAppProduct> {
  return request<WhatsAppProduct>('GET', { id })
}

export function createWhatsAppProduct(body: WhatsAppProductPayload): Promise<WhatsAppProduct> {
  return request<WhatsAppProduct>('POST', { body })
}

export function updateWhatsAppProduct(
  id: string,
  body: WhatsAppProductPayload
): Promise<WhatsAppProduct> {
  return request<WhatsAppProduct>('PUT', { id, body })
}

export function deleteWhatsAppProduct(id: string): Promise<void> {
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

export function validateWhatsAppProduct(row: {
  name: string
  price: string
  colors: { color_name: string }[]
}): string | null {
  if (!row.name.trim()) {
    return 'Please enter a product name before saving.'
  }

  const price = parseFloat(row.price)
  if (!row.price.trim() || Number.isNaN(price) || price <= 0) {
    return 'Please enter a valid price greater than 0.'
  }

  const validColors = row.colors.filter(c => c.color_name.trim())
  if (validColors.length > 0) {
    const names = validColors.map(c => c.color_name.trim().toLowerCase())
    if (new Set(names).size !== names.length) {
      return 'Each color name must be unique for this product.'
    }
  }

  return null
}

export function getWhatsAppProductErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()

  if (lower.includes('unauthorized')) {
    return 'Your session has expired. Please log in again.'
  }
  if (lower.includes('fetch') || lower.includes('network')) {
    return 'Unable to save changes. Please check your connection and try again.'
  }
  if (lower.includes('payload too large') || lower.includes('too large')) {
    return 'The image is too large. Please choose a smaller image and try again.'
  }
  if (lower.includes('unique') || lower.includes('duplicate')) {
    return 'A color with this name already exists on this product.'
  }

  return message || 'Something went wrong. Please try again.'
}
