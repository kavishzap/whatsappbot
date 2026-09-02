import { getServiceClient } from '@/lib/supabase/admin'
import { PRODUCT_MEDIA_BUCKET } from '@/lib/whatsapp-bot-item-media'

export async function deleteStoredProductMedia(itemId: string): Promise<void> {
  try {
    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('whatsapp_bot_item_media')
      .select('storage_path')
      .eq('item_id', itemId)

    if (error) {
      if (error.message.toLowerCase().includes('does not exist')) return
      throw error
    }

    const paths = (data ?? []).map(row => row.storage_path).filter(Boolean)
    if (paths.length === 0) return

    await supabase.storage.from(PRODUCT_MEDIA_BUCKET).remove(paths)
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
    if (message.includes('does not exist') || message.includes('bucket not found')) return
    throw err
  }
}
