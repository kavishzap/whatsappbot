'use client'

import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/toast'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import {
  deleteProductMedia,
  fetchProductMedia,
  getProductMediaErrorMessage,
  validateProductMediaFile,
  type ProductMediaItem,
} from '@/lib/whatsapp-bot-item-media'
import { uploadProductMedia } from '@/lib/whatsapp-bot-item-media-upload'

interface ProductFrontCoverProps {
  company: WhatsAppCompany
  itemId: string | null
}

export function ProductFrontCover({ company, itemId }: ProductFrontCoverProps) {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cover, setCover] = useState<ProductMediaItem | null>(null)
  const [loading, setLoading] = useState(Boolean(itemId))
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!itemId) {
      setCover(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    fetchProductMedia(company, itemId)
      .then(items => {
        if (cancelled) return
        setCover(items.find(item => item.kind === 'cover') ?? null)
      })
      .catch(err => {
        if (cancelled) return
        toastRef.current.error(getProductMediaErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [company, itemId])

  const busy = uploading || removing
  const canEdit = Boolean(itemId) && !loading

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !itemId) return

    const validationError = validateProductMediaFile('cover', file)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setUploading(true)
    try {
      const saved = await uploadProductMedia(company, itemId, 'cover', file)
      setCover(saved)
      toast.success(cover ? 'Front cover replaced' : 'Front cover added')
    } catch (err) {
      toast.error(getProductMediaErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!itemId || !cover) return
    setRemoving(true)
    try {
      await deleteProductMedia(company, cover.id)
      setCover(null)
      toast.success('Front cover removed')
    } catch (err) {
      toast.error(getProductMediaErrorMessage(err))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="shrink-0">
      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">Front cover</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
        disabled={!canEdit || busy}
      />
      {loading ? (
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-ink-50 animate-pulse" />
      ) : (
        <div className="relative w-24 h-24 sm:w-28 sm:h-28">
          <button
            type="button"
            disabled={!canEdit || busy}
            onClick={() => fileInputRef.current?.click()}
            className="group relative w-full h-full rounded-xl overflow-hidden border border-ink-200 bg-ink-50 focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:opacity-50"
          >
            {cover ? (
              <img src={cover.public_url} alt="Front cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400">
                {uploading ? (
                  <span className="text-[10px] font-medium">Uploading…</span>
                ) : (
                  <>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-[10px] font-medium">Upload</span>
                  </>
                )}
              </div>
            )}
            <span className="absolute inset-0 bg-gray-900/0 group-hover:bg-gray-900/30 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-[10px] font-medium bg-gray-900/70 px-2 py-1 rounded">
                {cover ? 'Change' : 'Upload'}
              </span>
            </span>
          </button>
          {cover && canEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={handleRemove}
              className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[28px] min-h-[28px] rounded-lg bg-gray-900/70 text-white hover:bg-red-600 disabled:opacity-50"
              title="Remove front cover"
            >
              {removing ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          )}
        </div>
      )}
      <p className="text-[10px] text-ink-400 mt-1.5 max-w-[7.5rem] sm:max-w-[8rem]">
        {itemId ? 'Shown on the website product page.' : 'Save the product first, then add a front cover.'}
      </p>
    </div>
  )
}
