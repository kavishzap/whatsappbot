import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { method } = req
  const url = new URL(req.url)
  const id = url.searchParams.get('id')

  try {
    if (method === 'GET') {
      let query = supabase
        .from('whatsapp_bot_items')
        .select('*')
        .order('created_at', { ascending: false })

      if (id) {
        query = query.eq('id', id)
      }

      const { data, error } = await query

      if (error) throw error

      return Response.json({ success: true, data })
    }

    if (method === 'POST') {
      const body = await req.json()

      const { data, error } = await supabase
        .from('whatsapp_bot_items')
        .insert({
          ad_link: body.ad_link,
          product_name: body.product_name,
          price: body.price,
          image_base64: body.image_base64,
          description: body.description,
        })
        .select()
        .single()

      if (error) throw error

      return Response.json({ success: true, data })
    }

    if (method === 'PUT') {
      if (!id) {
        return Response.json({ success: false, error: 'Missing id' }, { status: 400 })
      }

      const body = await req.json()

      const { data, error } = await supabase
        .from('whatsapp_bot_items')
        .update({
          ad_link: body.ad_link,
          product_name: body.product_name,
          price: body.price,
          image_base64: body.image_base64,
          description: body.description,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return Response.json({ success: true, data })
    }

    if (method === 'DELETE') {
      if (!id) {
        return Response.json({ success: false, error: 'Missing id' }, { status: 400 })
      }

      const { error } = await supabase.from('whatsapp_bot_items').delete().eq('id', id)

      if (error) throw error

      return Response.json({ success: true, message: 'Item deleted successfully' })
    }

    return Response.json({ success: false, error: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
})
