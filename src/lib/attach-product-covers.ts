import { getServiceClient } from '@/lib/supabase/admin'

export async function attachCoverUrls<T extends { id: string }>(
  items: T[]
): Promise<(T & { cover_url: string | null })[]> {
  if (items.length === 0) {
    return []
  }

  try {
    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('whatsapp_bot_item_media')
      .select('item_id, public_url')
      .eq('kind', 'cover')
      .in(
        'item_id',
        items.map(item => item.id)
      )

    if (error) {
      if (error.message.toLowerCase().includes('does not exist')) {
        return items.map(item => ({ ...item, cover_url: null }))
      }
      throw error
    }

    const byItem = new Map((data ?? []).map(row => [row.item_id as string, row.public_url as string]))
    return items.map(item => ({ ...item, cover_url: byItem.get(item.id) ?? null }))
  } catch {
    return items.map(item => ({ ...item, cover_url: null }))
  }
}
