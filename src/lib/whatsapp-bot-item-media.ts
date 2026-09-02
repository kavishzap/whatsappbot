import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export const PRODUCT_MEDIA_BUCKET = 'whatsapp-bot-item-media'
export const PRODUCT_MEDIA_MAX_IMAGES = 3
export const PRODUCT_MEDIA_MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const PRODUCT_MEDIA_MAX_VIDEO_BYTES = 50 * 1024 * 1024

export const PRODUCT_MEDIA_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export const PRODUCT_MEDIA_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const

export type ProductMediaKind = 'image' | 'video' | 'cover'

export interface ProductMediaItem {
  id: string
  item_id: string
  kind: ProductMediaKind
  storage_path: string
  public_url: string
  mime_type: string | null
  sort_order: number
  created_at: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

const IMAGE_TYPE_SET = new Set<string>(PRODUCT_MEDIA_IMAGE_TYPES)
const VIDEO_TYPE_SET = new Set<string>(PRODUCT_MEDIA_VIDEO_TYPES)

export function productMediaFolder(kind: ProductMediaKind): 'images' | 'video' | 'cover' {
  if (kind === 'video') return 'video'
  if (kind === 'cover') return 'cover'
  return 'images'
}

export function isImageMediaKind(kind: ProductMediaKind): boolean {
  return kind === 'image' || kind === 'cover'
}

function companyQuery(company: WhatsAppCompany): string {
  return `company=${company}`
}

async function parseResponse<T>(res: Response): Promise<T> {
  const json: ApiResponse<T> = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed')
  }
  return json.data as T
}

export function fetchProductMedia(
  company: WhatsAppCompany,
  itemId: string
): Promise<ProductMediaItem[]> {
  return fetch(`/api/whatsapp-bot-item-media?${companyQuery(company)}&item_id=${itemId}`)
    .then(res => parseResponse<ProductMediaItem[]>(res))
}

export async function prepareProductMediaUpload(
  company: WhatsAppCompany,
  itemId: string,
  kind: ProductMediaKind,
  file: File
): Promise<{ path: string; token: string; bucket: string }> {
  return fetch(`/api/whatsapp-bot-item-media?${companyQuery(company)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'prepare',
      item_id: itemId,
      kind,
      mime_type: file.type,
      size: file.size,
    }),
  }).then(res => parseResponse<{ path: string; token: string; bucket: string }>(res))
}

export function completeProductMediaUpload(
  company: WhatsAppCompany,
  itemId: string,
  kind: ProductMediaKind,
  storagePath: string,
  mimeType: string
): Promise<ProductMediaItem> {
  return fetch(`/api/whatsapp-bot-item-media?${companyQuery(company)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'complete',
      item_id: itemId,
      kind,
      storage_path: storagePath,
      mime_type: mimeType,
    }),
  }).then(res => parseResponse<ProductMediaItem>(res))
}

export async function deleteProductMedia(company: WhatsAppCompany, id: string): Promise<void> {
  const res = await fetch(`/api/whatsapp-bot-item-media?${companyQuery(company)}&id=${id}`, {
    method: 'DELETE',
  })
  await parseResponse<unknown>(res)
}

export function validateProductMediaFile(kind: ProductMediaKind, file: File): string | null {
  if (isImageMediaKind(kind)) {
    if (!IMAGE_TYPE_SET.has(file.type)) {
      return 'Please choose a JPG, PNG, WEBP, or GIF image.'
    }
    if (file.size > PRODUCT_MEDIA_MAX_IMAGE_BYTES) {
      return 'That image is too large. Please use a file under 5 MB.'
    }
    return null
  }

  if (!VIDEO_TYPE_SET.has(file.type)) {
    return 'Please choose an MP4, WEBM, or MOV video.'
  }
  if (file.size > PRODUCT_MEDIA_MAX_VIDEO_BYTES) {
    return 'That video is too large. Please use a file under 50 MB.'
  }
  return null
}

export function getProductMediaErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()

  if (lower.includes('unauthorized')) {
    return 'Your session has expired. Please log in again.'
  }
  if (
    (lower.includes('not found') && lower.includes('bucket')) ||
    lower.includes('bucket not found') ||
    (lower.includes('whatsapp_bot_item_media') && lower.includes('does not exist'))
  ) {
    return 'Extra images aren’t set up yet. Run the SQL in Supabase first, then try again.'
  }
  if (lower.includes('at most 3')) {
    return 'This product already has 3 extra images. Remove one to add another.'
  }
  if (lower.includes('at most 1 video') || (lower.includes('duplicate key') && lower.includes('video'))) {
    return 'This product already has a video. Remove it to add a different one.'
  }
  if (lower.includes('duplicate key') && lower.includes('cover')) {
    return 'This product already has a front cover. Remove it to add a different one.'
  }
  if (lower.includes('fetch') || lower.includes('network')) {
    return 'Unable to upload right now. Please check your connection and try again.'
  }

  return message || 'Something went wrong. Please try again.'
}
