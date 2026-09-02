'use client'

import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/toast'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import {
  PRODUCT_MEDIA_MAX_IMAGES,
  deleteProductMedia,
  fetchProductMedia,
  getProductMediaErrorMessage,
  validateProductMediaFile,
  type ProductMediaItem,
} from '@/lib/whatsapp-bot-item-media'
import { uploadProductMedia } from '@/lib/whatsapp-bot-item-media-upload'

interface ProductItemMediaSectionProps {
  company: WhatsAppCompany
  itemId: string | null
}

export function ProductItemMediaSection({ company, itemId }: ProductItemMediaSectionProps) {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<ProductMediaItem[]>([])
  const [video, setVideo] = useState<ProductMediaItem | null>(null)
  const [loading, setLoading] = useState(Boolean(itemId))
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    if (!itemId) {
      setImages([])
      setVideo(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    fetchProductMedia(company, itemId)
      .then(items => {
        if (cancelled) return
        setImages(items.filter(item => item.kind === 'image'))
        setVideo(items.find(item => item.kind === 'video') ?? null)
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

  const busy = uploadingImage || uploadingVideo || Boolean(removingId)
  const canEdit = Boolean(itemId) && !loading

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !itemId) return

    if (images.length >= PRODUCT_MEDIA_MAX_IMAGES) {
      toast.error('This product already has 3 extra images. Remove one to add another.')
      return
    }

    const validationError = validateProductMediaFile('image', file)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setUploadingImage(true)
    try {
      const saved = await uploadProductMedia(company, itemId, 'image', file)
      setImages(prev => [...prev, saved].slice(0, PRODUCT_MEDIA_MAX_IMAGES))
      toast.success('Image added')
    } catch (err) {
      toast.error(getProductMediaErrorMessage(err))
    } finally {
      setUploadingImage(false)
    }
  }

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !itemId) return

    const validationError = validateProductMediaFile('video', file)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setUploadingVideo(true)
    try {
      const saved = await uploadProductMedia(company, itemId, 'video', file)
      setVideo(saved)
      toast.success(video ? 'Video replaced' : 'Video added')
    } catch (err) {
      toast.error(getProductMediaErrorMessage(err))
    } finally {
      setUploadingVideo(false)
    }
  }

  const handleRemove = async (media: ProductMediaItem) => {
    if (!itemId) return
    setRemovingId(media.id)
    try {
      await deleteProductMedia(company, media.id)
      if (media.kind === 'image') {
        setImages(prev => prev.filter(item => item.id !== media.id))
      } else {
        setVideo(null)
      }
      toast.success(media.kind === 'image' ? 'Image removed' : 'Video removed')
    } catch (err) {
      toast.error(getProductMediaErrorMessage(err))
    } finally {
      setRemovingId(null)
    }
  }

  const emptySlots = Math.max(0, PRODUCT_MEDIA_MAX_IMAGES - images.length)

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Items images</p>
        <p className="text-[10px] text-ink-400 mt-0.5">
          Up to {PRODUCT_MEDIA_MAX_IMAGES} extra photos and 1 video. Stored per product.
        </p>
      </div>

      {!itemId && (
        <p className="text-sm text-ink-500 rounded-xl border border-ink-100 bg-ink-50/50 px-4 py-3">
          Save the product first, then you can add extra images and a video.
        </p>
      )}

      <div>
        <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
          Extra photos
        </p>
        <p className="text-[10px] text-ink-400 mb-2">
          {images.length}/{PRODUCT_MEDIA_MAX_IMAGES} images
        </p>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleImageChange}
          className="hidden"
          disabled={!canEdit || busy || images.length >= PRODUCT_MEDIA_MAX_IMAGES}
        />
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: PRODUCT_MEDIA_MAX_IMAGES }).map((_, index) => (
              <div key={index} className="aspect-square rounded-xl bg-ink-50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {images.map(image => (
              <MediaTile
                key={image.id}
                disabled={!canEdit || busy}
                removing={removingId === image.id}
                onRemove={() => handleRemove(image)}
              >
                <img src={image.public_url} alt="Product extra" className="w-full h-full object-cover" />
              </MediaTile>
            ))}
            {Array.from({ length: emptySlots }).map((_, index) => (
              <button
                key={`empty-${index}`}
                type="button"
                disabled={!canEdit || busy}
                onClick={() => imageInputRef.current?.click()}
                className="aspect-square rounded-xl border border-dashed border-ink-200 bg-ink-50/50 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-brand-400 hover:text-brand-600 disabled:opacity-50 disabled:hover:border-ink-200 disabled:hover:text-gray-400"
              >
                {uploadingImage && index === 0 ? (
                  <span className="text-[10px] font-medium">Uploading…</span>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span className="text-[10px] font-medium">Add image</span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">Video</p>
        <p className="text-[10px] text-ink-400 mb-2">Optional. One video per product, up to 50 MB.</p>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={handleVideoChange}
          className="hidden"
          disabled={!canEdit || busy}
        />
        {loading ? (
          <div className="h-40 rounded-xl bg-ink-50 animate-pulse" />
        ) : video ? (
          <MediaTile
            disabled={!canEdit || busy}
            removing={removingId === video.id}
            onRemove={() => handleRemove(video)}
            className="aspect-video max-w-md"
          >
            <video src={video.public_url} controls className="w-full h-full object-cover bg-black" />
          </MediaTile>
        ) : (
          <button
            type="button"
            disabled={!canEdit || busy}
            onClick={() => videoInputRef.current?.click()}
            className="w-full max-w-md aspect-video rounded-xl border border-dashed border-ink-200 bg-ink-50/50 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-brand-400 hover:text-brand-600 disabled:opacity-50 disabled:hover:border-ink-200 disabled:hover:text-gray-400"
          >
            {uploadingVideo ? (
              <span className="text-[10px] font-medium">Uploading…</span>
            ) : (
              <>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-[10px] font-medium">Add video</span>
              </>
            )}
          </button>
        )}
        {video && canEdit && (
          <button
            type="button"
            disabled={busy}
            onClick={() => videoInputRef.current?.click()}
            className="mt-2 text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
          >
            Replace video
          </button>
        )}
      </div>
    </div>
  )
}

function MediaTile({
  children,
  disabled,
  removing,
  onRemove,
  className = 'aspect-square',
}: {
  children: React.ReactNode
  disabled: boolean
  removing: boolean
  onRemove: () => void
  className?: string
}) {
  return (
    <div className={`relative rounded-xl overflow-hidden border border-ink-200 bg-ink-50 ${className}`}>
      {children}
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[32px] min-h-[32px] rounded-lg bg-gray-900/70 text-white hover:bg-red-600 disabled:opacity-50"
        title="Remove"
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
    </div>
  )
}
