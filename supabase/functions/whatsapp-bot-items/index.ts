import { getServiceClient, handleOptions, jsonResponse } from '../_shared/http.ts'

const LIST_COLUMNS =
  'id, ad_link, ad_link_2, product_name, price, description, company, sort_order, created_at, updated_at'
const COLOR_COLUMNS = 'id, color_name, color_hex, sort_order'

interface ColorInput {
  color_name: string
  color_hex?: string | null
  sort_order?: number
}

function parseCompany(value: string | null): string | null {
  if (value === 'spark' || value === 'sodamax') return value
  return null
}

function normalizeColors(colors: ColorInput[] | undefined): ColorInput[] {
  if (!Array.isArray(colors)) return []
  return colors
    .map((c, index) => ({
      color_name: String(c.color_name ?? '').trim(),
      color_hex: c.color_hex?.trim() || null,
      sort_order: c.sort_order ?? index,
    }))
    .filter(c => c.color_name.length > 0)
}

async function syncItemColors(
  supabase: ReturnType<typeof getServiceClient>,
  itemId: string,
  colors: ColorInput[]
) {
  const { error: deleteError } = await supabase
    .from('whatsapp_bot_item_colors')
    .delete()
    .eq('item_id', itemId)

  if (deleteError) throw deleteError

  if (colors.length === 0) return

  const { error: insertError } = await supabase.from('whatsapp_bot_item_colors').insert(
    colors.map((color, index) => ({
      item_id: itemId,
      color_name: color.color_name,
      color_hex: color.color_hex ?? null,
      sort_order: index,
    }))
  )

  if (insertError) throw insertError
}

async function nextSortOrder(
  supabase: ReturnType<typeof getServiceClient>,
  company: string
): Promise<number> {
  const { data, error } = await supabase
    .from('whatsapp_bot_items')
    .select('sort_order')
    .eq('company', company)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data?.sort_order ?? 0) + 1
}

async function fetchItemWithColors(
  supabase: ReturnType<typeof getServiceClient>,
  id: string
) {
  const { data, error } = await supabase
    .from('whatsapp_bot_items')
    .select(`*, colors:whatsapp_bot_item_colors(${COLOR_COLUMNS})`)
    .eq('id', id)
    .single()

  if (error) throw error

  if (data.colors) {
    data.colors.sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    )
  }

  return data
}

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const company = parseCompany(url.searchParams.get('company'))

  try {
    const supabase = getServiceClient()

    if (req.method === 'GET') {
      if (id) {
        const data = await fetchItemWithColors(supabase, id)
        if (company && data.company !== company) {
          return jsonResponse({ success: false, error: 'Item not found' }, 404)
        }
        return jsonResponse({ success: true, data })
      }

      if (!company) {
        return jsonResponse({ success: false, error: 'Missing or invalid company (spark|sodamax)' }, 400)
      }

      const { data, error } = await supabase
        .from('whatsapp_bot_items')
        .select(`${LIST_COLUMNS}, image_base64, colors:whatsapp_bot_item_colors(${COLOR_COLUMNS})`)
        .eq('company', company)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error

      const items = (data ?? []).map(({ image_base64, colors, ...item }) => ({
        ...item,
        has_image: Boolean(image_base64),
        colors: [...(colors ?? [])].sort(
          (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
        ),
      }))

      return jsonResponse({ success: true, data: items })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const itemCompany = parseCompany(body.company) ?? 'spark'
      const colors = normalizeColors(body.colors)
      const sortOrder =
        body.sort_order != null ? Number(body.sort_order) : await nextSortOrder(supabase, itemCompany)

      const { data, error } = await supabase
        .from('whatsapp_bot_items')
        .insert({
          ad_link: body.ad_link?.trim() || null,
          ad_link_2: body.ad_link_2?.trim() || null,
          product_name: body.product_name ?? body.name ?? null,
          price: body.price != null ? String(body.price) : null,
          image_base64: body.image_base64 ?? null,
          description: body.description ?? '',
          company: itemCompany,
          sort_order: sortOrder,
        })
        .select('id')
        .single()

      if (error) throw error

      await syncItemColors(supabase, data.id, colors)
      const full = await fetchItemWithColors(supabase, data.id)
      return jsonResponse({ success: true, data: full })
    }

    if (req.method === 'PUT') {
      if (!id) {
        return jsonResponse({ success: false, error: 'Missing id' }, 400)
      }

      const body = await req.json()
      const colors = body.colors !== undefined ? normalizeColors(body.colors) : undefined

      const updates: Record<string, unknown> = {}
      if (body.ad_link !== undefined) updates.ad_link = body.ad_link?.trim() || null
      if (body.ad_link_2 !== undefined) updates.ad_link_2 = body.ad_link_2?.trim() || null
      if (body.product_name !== undefined) updates.product_name = body.product_name
      if (body.name !== undefined) updates.product_name = body.name
      if (body.price !== undefined) updates.price = body.price != null ? String(body.price) : null
      if (body.image_base64 !== undefined) updates.image_base64 = body.image_base64
      if (body.description !== undefined) updates.description = body.description
      if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order)
      if (body.company !== undefined) {
        const itemCompany = parseCompany(body.company)
        if (itemCompany) updates.company = itemCompany
      }

      const { error } = await supabase.from('whatsapp_bot_items').update(updates).eq('id', id)
      if (error) throw error

      if (colors !== undefined) {
        await syncItemColors(supabase, id, colors)
      }

      const full = await fetchItemWithColors(supabase, id)
      return jsonResponse({ success: true, data: full })
    }

    if (req.method === 'DELETE') {
      if (!id) {
        return jsonResponse({ success: false, error: 'Missing id' }, 400)
      }

      const { error } = await supabase.from('whatsapp_bot_items').delete().eq('id', id)
      if (error) throw error

      return jsonResponse({ success: true, message: 'Item deleted successfully' })
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405)
  } catch (error) {
    console.error('whatsapp-bot-items error:', error)
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})
