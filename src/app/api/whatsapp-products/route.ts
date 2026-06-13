import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/admin'
import { isAllowedRole } from '@/lib/auth'

const LIST_COLUMNS = 'id, name, price, created_at, updated_at'
const COLOR_COLUMNS = 'id, color_name, color_hex, sort_order'

interface ColorInput {
  color_name: string
  color_hex?: string | null
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

function normalizeColors(colors: ColorInput[] | undefined): ColorInput[] {
  if (!Array.isArray(colors)) return []
  return colors
    .map((c, index) => ({
      color_name: String(c.color_name ?? '').trim(),
      color_hex: c.color_hex?.trim() || null,
      sort_order: index,
    }))
    .filter(c => c.color_name.length > 0)
}

async function syncProductColors(productId: string, colors: ColorInput[]) {
  const supabase = getServiceClient()

  const { error: deleteError } = await supabase
    .from('whatsapp_product_colors')
    .delete()
    .eq('product_id', productId)

  if (deleteError) throw new Error(deleteError.message)

  if (colors.length === 0) return

  const { error: insertError } = await supabase.from('whatsapp_product_colors').insert(
    colors.map((color, index) => ({
      product_id: productId,
      color_name: color.color_name,
      color_hex: color.color_hex ?? null,
      sort_order: index,
    }))
  )

  if (insertError) throw new Error(insertError.message)
}

async function fetchProductWithColors(id: string) {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('whatsapp_products')
    .select(`*, colors:whatsapp_product_colors(${COLOR_COLUMNS})`)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)

  if (data.colors) {
    data.colors.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
  }

  return data
}

export async function GET(request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')

  try {
    const supabase = getServiceClient()

    if (id) {
      const data = await fetchProductWithColors(id)
      return NextResponse.json({ success: true, data })
    }

    const { data, error } = await supabase
      .from('whatsapp_products')
      .select(`${LIST_COLUMNS}, colors:whatsapp_product_colors(${COLOR_COLUMNS})`)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const sorted = (data ?? []).map(item => ({
      ...item,
      colors: [...(item.colors ?? [])].sort(
        (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
      ),
    }))

    return NextResponse.json({ success: true, data: sorted })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const colors = normalizeColors(body.colors)

    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: 'Product name is required' }, { status: 400 })
    }

    if (body.price == null || Number.isNaN(Number(body.price)) || Number(body.price) <= 0) {
      return NextResponse.json({ success: false, error: 'Valid price is required' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const { data: product, error } = await supabase
      .from('whatsapp_products')
      .insert({
        name: body.name.trim(),
        price: body.price,
        image_base64: body.image_base64 ?? null,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    await syncProductColors(product.id, colors)
    const data = await fetchProductWithColors(product.id)

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const colors = normalizeColors(body.colors)

    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: 'Product name is required' }, { status: 400 })
    }

    if (body.price == null || Number.isNaN(Number(body.price)) || Number(body.price) <= 0) {
      return NextResponse.json({ success: false, error: 'Valid price is required' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const { error } = await supabase
      .from('whatsapp_products')
      .update({
        name: body.name.trim(),
        price: body.price,
        image_base64: body.image_base64 ?? null,
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    await syncProductColors(id, colors)
    const data = await fetchProductWithColors(id)

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
  }

  try {
    const supabase = getServiceClient()
    const { error } = await supabase.from('whatsapp_products').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Product deleted successfully' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
