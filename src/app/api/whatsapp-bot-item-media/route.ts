import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/admin'
import { isAllowedRole } from '@/lib/auth'
import { isWhatsAppCompany } from '@/lib/whatsapp-company'
import {
  PRODUCT_MEDIA_BUCKET,
  PRODUCT_MEDIA_IMAGE_TYPES,
  PRODUCT_MEDIA_MAX_IMAGE_BYTES,
  PRODUCT_MEDIA_MAX_IMAGES,
  PRODUCT_MEDIA_MAX_VIDEO_BYTES,
  PRODUCT_MEDIA_VIDEO_TYPES,
  type ProductMediaKind,
} from '@/lib/whatsapp-bot-item-media'

const IMAGE_TYPE_SET = new Set<string>(PRODUCT_MEDIA_IMAGE_TYPES)
const VIDEO_TYPE_SET = new Set<string>(PRODUCT_MEDIA_VIDEO_TYPES)

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

async function requireAuth() {
  const supabase = createAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (!isAllowedRole(profile?.system_role)) return null

  return user
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function parseKind(value: unknown): ProductMediaKind | null {
  return value === 'image' || value === 'video' ? value : null
}

function publicUrlFor(path: string): string {
  const supabase = getServiceClient()
  const { data } = supabase.storage.from(PRODUCT_MEDIA_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function requireOwnedItem(itemId: string, company: string) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('whatsapp_bot_items')
    .select('id, company')
    .eq('id', itemId)
    .maybeSingle()

  if (error) throw error
  if (!data) return { error: jsonError('Product not found.', 404) }
  if (data.company !== company) {
    return { error: jsonError('This product doesn’t belong to that company.', 403) }
  }
  return { item: data }
}

export async function GET(request: NextRequest) {
  const user = await requireAuth()
  if (!user) return jsonError('Unauthorized', 401)

  const company = request.nextUrl.searchParams.get('company')
  const itemId = request.nextUrl.searchParams.get('item_id')

  if (!isWhatsAppCompany(company) || !itemId) {
    return jsonError('Missing company or product.', 400)
  }

  try {
    const owned = await requireOwnedItem(itemId, company)
    if ('error' in owned && owned.error) return owned.error

    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('whatsapp_bot_item_media')
      .select('id, item_id, kind, storage_path, public_url, mime_type, sort_order, created_at')
      .eq('item_id', itemId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return jsonError(message, 500)
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth()
  if (!user) return jsonError('Unauthorized', 401)

  const company = request.nextUrl.searchParams.get('company')
  if (!isWhatsAppCompany(company)) {
    return jsonError('Missing or invalid company (spark|sodamax)', 400)
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const action = body.action
    const itemId = typeof body.item_id === 'string' ? body.item_id : ''
    const kind = parseKind(body.kind)
    const mimeType = typeof body.mime_type === 'string' ? body.mime_type : ''

    if (!itemId || !kind) {
      return jsonError('Missing product or file type.', 400)
    }

    const owned = await requireOwnedItem(itemId, company)
    if ('error' in owned && owned.error) return owned.error

    const supabase = getServiceClient()

    if (action === 'prepare') {
      const size = typeof body.size === 'number' ? body.size : Number(body.size)
      const allowedTypes = kind === 'image' ? IMAGE_TYPE_SET : VIDEO_TYPE_SET
      const maxBytes = kind === 'image' ? PRODUCT_MEDIA_MAX_IMAGE_BYTES : PRODUCT_MEDIA_MAX_VIDEO_BYTES

      if (!allowedTypes.has(mimeType)) {
        return jsonError(
          kind === 'image'
            ? 'Please choose a JPG, PNG, WEBP, or GIF image.'
            : 'Please choose an MP4, WEBM, or MOV video.',
          400
        )
      }
      if (!Number.isFinite(size) || size <= 0 || size > maxBytes) {
        return jsonError(
          kind === 'image'
            ? 'That image is too large. Please use a file under 5 MB.'
            : 'That video is too large. Please use a file under 50 MB.',
          400
        )
      }

      if (kind === 'image') {
        const { count, error: countError } = await supabase
          .from('whatsapp_bot_item_media')
          .select('id', { count: 'exact', head: true })
          .eq('item_id', itemId)
          .eq('kind', 'image')

        if (countError) throw countError
        if ((count ?? 0) >= PRODUCT_MEDIA_MAX_IMAGES) {
          return jsonError('This product already has 3 extra images. Remove one to add another.', 400)
        }
      }

      const ext = MIME_EXTENSION[mimeType]
      if (!ext) return jsonError('That file type isn’t supported.', 400)

      const folder = kind === 'image' ? 'images' : 'video'
      const path = `${itemId}/${folder}/${crypto.randomUUID()}.${ext}`

      const { data, error } = await supabase.storage
        .from(PRODUCT_MEDIA_BUCKET)
        .createSignedUploadUrl(path)

      if (error) throw error
      if (!data?.path || !data.token) {
        return jsonError('Could not start the upload. Please try again.', 500)
      }

      return NextResponse.json({
        success: true,
        data: {
          path: data.path,
          token: data.token,
          bucket: PRODUCT_MEDIA_BUCKET,
        },
      })
    }

    if (action === 'complete') {
      const storagePath = typeof body.storage_path === 'string' ? body.storage_path : ''
      const expectedPrefix = `${itemId}/${kind === 'image' ? 'images' : 'video'}/`
      if (!storagePath.startsWith(expectedPrefix)) {
        return jsonError('Invalid upload path.', 400)
      }

      if (kind === 'image') {
        const { count, error: countError } = await supabase
          .from('whatsapp_bot_item_media')
          .select('id', { count: 'exact', head: true })
          .eq('item_id', itemId)
          .eq('kind', 'image')

        if (countError) throw countError
        if ((count ?? 0) >= PRODUCT_MEDIA_MAX_IMAGES) {
          await supabase.storage.from(PRODUCT_MEDIA_BUCKET).remove([storagePath])
          return jsonError('This product already has 3 extra images. Remove one to add another.', 400)
        }
      }

      let nextSort = 0
      if (kind === 'image') {
        const { data: last, error: lastError } = await supabase
          .from('whatsapp_bot_item_media')
          .select('sort_order')
          .eq('item_id', itemId)
          .eq('kind', 'image')
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastError) throw lastError
        nextSort = (last?.sort_order ?? -1) + 1
      }

      if (kind === 'video') {
        const { data: existing, error: existingError } = await supabase
          .from('whatsapp_bot_item_media')
          .select('id, storage_path')
          .eq('item_id', itemId)
          .eq('kind', 'video')
          .maybeSingle()

        if (existingError) throw existingError

        if (existing) {
          const { data, error } = await supabase
            .from('whatsapp_bot_item_media')
            .update({
              storage_path: storagePath,
              public_url: publicUrlFor(storagePath),
              mime_type: mimeType || null,
            })
            .eq('id', existing.id)
            .select('id, item_id, kind, storage_path, public_url, mime_type, sort_order, created_at')
            .single()

          if (error) throw error
          if (existing.storage_path !== storagePath) {
            await supabase.storage.from(PRODUCT_MEDIA_BUCKET).remove([existing.storage_path])
          }
          return NextResponse.json({ success: true, data })
        }
      }

      const { data, error } = await supabase
        .from('whatsapp_bot_item_media')
        .insert({
          item_id: itemId,
          kind,
          storage_path: storagePath,
          public_url: publicUrlFor(storagePath),
          mime_type: mimeType || null,
          sort_order: nextSort,
        })
        .select('id, item_id, kind, storage_path, public_url, mime_type, sort_order, created_at')
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    return jsonError('Unknown action.', 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return jsonError(message, 500)
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireAuth()
  if (!user) return jsonError('Unauthorized', 401)

  const company = request.nextUrl.searchParams.get('company')
  const id = request.nextUrl.searchParams.get('id')

  if (!isWhatsAppCompany(company) || !id) {
    return jsonError('Missing company or media id.', 400)
  }

  try {
    const supabase = getServiceClient()
    const { data: media, error: mediaError } = await supabase
      .from('whatsapp_bot_item_media')
      .select('id, item_id, storage_path')
      .eq('id', id)
      .maybeSingle()

    if (mediaError) throw mediaError
    if (!media) return jsonError('File not found.', 404)

    const owned = await requireOwnedItem(media.item_id, company)
    if ('error' in owned && owned.error) return owned.error

    await supabase.storage.from(PRODUCT_MEDIA_BUCKET).remove([media.storage_path])

    const { error: deleteError } = await supabase.from('whatsapp_bot_item_media').delete().eq('id', id)
    if (deleteError) throw deleteError

    return NextResponse.json({ success: true, data: { id } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return jsonError(message, 500)
  }
}
