import { createClient } from '@/lib/supabase/client'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import {
  completeProductMediaUpload,
  prepareProductMediaUpload,
  type ProductMediaItem,
  type ProductMediaKind,
} from '@/lib/whatsapp-bot-item-media'

export async function uploadProductMedia(
  company: WhatsAppCompany,
  itemId: string,
  kind: ProductMediaKind,
  file: File
): Promise<ProductMediaItem> {
  const prepared = await prepareProductMediaUpload(company, itemId, kind, file)
  const supabase = createClient()
  const { error: uploadError } = await supabase.storage
    .from(prepared.bucket)
    .uploadToSignedUrl(prepared.path, prepared.token, file)

  if (uploadError) {
    throw new Error(uploadError.message || 'Could not upload the file. Please try again.')
  }

  return completeProductMediaUpload(company, itemId, kind, prepared.path, file.type)
}
