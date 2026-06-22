'use client'

import { useEffect, useRef } from 'react'
import { WHATSAPP_LIST_ROW_TITLE_MAX } from '@/lib/whatsapp-list-limits'
import { fileToBase64, toImageSrc } from '@/lib/whatsapp-bot-items'
import { useToast } from '@/components/ui/toast'

export interface ProductColorRow {
  id: string
  colorName: string
  colorHex: string
}

export interface ProductDetailRow {
  id: string
  productName: string
  price: string
  adId: string
  adId2: string
  adLink: string
  adLink2: string
  imageBase64: string | null
  imagePreview: string | null
  description: string
  colors: ProductColorRow[]
  isNew: boolean
}

interface ProductDetailModalProps {
  row: ProductDetailRow | null
  saving?: boolean
  showColors?: boolean
  onClose: () => void
  onSave: () => void
  onUpdate: (id: string, updates: Partial<ProductDetailRow>) => void
  onDelete?: () => void
}

const DEFAULT_HEX = '#10b981'

export function createEmptyColor(): ProductColorRow {
  return { id: crypto.randomUUID(), colorName: '', colorHex: DEFAULT_HEX }
}

export function ProductDetailModal({
  row,
  saving = false,
  showColors = false,
  onClose,
  onSave,
  onUpdate,
  onDelete,
}: ProductDetailModalProps) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!row) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [row, saving, onClose])

  if (!row) return null

  const imageSrc = row.imagePreview ?? toImageSrc(row.imageBase64)

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await fileToBase64(file)
      onUpdate(row.id, { imageBase64: base64, imagePreview: toImageSrc(base64) })
    } catch {
      toast.error('Could not read the selected image. Please try a different file (JPG or PNG).')
    }
    e.target.value = ''
  }

  const updateColor = (colorId: string, updates: Partial<ProductColorRow>) => {
    onUpdate(row.id, {
      colors: row.colors.map(c => (c.id === colorId ? { ...c, ...updates } : c)),
    })
  }

  const addColor = () => {
    onUpdate(row.id, { colors: [...row.colors, createEmptyColor()] })
  }

  const removeColor = (colorId: string) => {
    onUpdate(row.id, { colors: row.colors.filter(c => c.id !== colorId) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close product details"
        onClick={onClose}
        disabled={saving}
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm disabled:cursor-not-allowed"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
        className="relative bg-white rounded-2xl shadow-card border border-ink-200/80 w-full max-w-lg max-h-[min(90dvh,900px)] flex flex-col animate-fade-in mx-auto"
      >
        <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 border-b border-ink-100 shrink-0">
          <h2 id="product-detail-title" className="text-lg font-bold text-ink-900 tracking-tight">
            {row.isNew ? 'Add product' : 'Edit product'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 disabled:opacity-50 transition-colors shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 min-h-0">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative rounded-xl overflow-hidden border border-ink-200 bg-ink-50 focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={row.productName || 'Product'}
                    className="w-24 h-24 sm:w-28 sm:h-28 object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 flex flex-col items-center justify-center gap-1 text-gray-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px] font-medium">Upload</span>
                  </div>
                )}
                <span className="absolute inset-0 bg-gray-900/0 group-hover:bg-gray-900/30 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 text-white text-[10px] font-medium bg-gray-900/70 px-2 py-1 rounded">
                    {imageSrc ? 'Change' : 'Upload'}
                  </span>
                </span>
              </button>
            </div>

            <div className="flex-1 min-w-0 space-y-3">
              <DetailField label="Product name">
                <input
                  type="text"
                  value={row.productName}
                  onChange={e => onUpdate(row.id, { productName: e.target.value })}
                  placeholder="Product name"
                  maxLength={WHATSAPP_LIST_ROW_TITLE_MAX}
                  className={inputClass}
                />
                <p className="text-[10px] text-ink-400 mt-1">
                  Max {WHATSAPP_LIST_ROW_TITLE_MAX} characters (WhatsApp product list).
                  {row.productName.length}/{WHATSAPP_LIST_ROW_TITLE_MAX}
                </p>
              </DetailField>

              <DetailField label="Price">
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-xs font-medium text-gray-400 pointer-events-none">
                    Rs
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.price}
                    onChange={e => onUpdate(row.id, { price: e.target.value })}
                    placeholder="0.00"
                    className={`${inputClass} pl-9 text-right tabular-nums`}
                  />
                </div>
              </DetailField>
            </div>
          </div>

          <DetailField label="Facebook Ad ID">
            <input
              type="text"
              inputMode="numeric"
              value={row.adId}
              onChange={e => onUpdate(row.id, { adId: e.target.value })}
              placeholder="555555555"
              className={`${inputClass} tabular-nums`}
            />
            <p className="text-[10px] text-ink-400 mt-1">
              Copy from Meta Ads Manager → Ads → your ad → Ad ID. Matches WhatsApp{' '}
              <span className="font-medium">referral.source_id</span>.
            </p>
          </DetailField>

          <DetailField label="Facebook Ad ID 2">
            <input
              type="text"
              inputMode="numeric"
              value={row.adId2}
              onChange={e => onUpdate(row.id, { adId2: e.target.value })}
              placeholder="Optional second ad"
              className={`${inputClass} tabular-nums`}
            />
            <p className="text-[10px] text-ink-400 mt-1">
              Optional second ad ID for the same product (e.g. another creative).
            </p>
          </DetailField>

          <details className="rounded-xl border border-ink-100 bg-ink-50/50 px-4 py-3">
            <summary className="text-xs font-medium text-ink-600 cursor-pointer select-none">
              Legacy fb.me links (optional fallback)
            </summary>
            <div className="mt-3 space-y-3">
              <DetailField label="Facebook ad link">
                <input
                  type="url"
                  value={row.adLink}
                  onChange={e => onUpdate(row.id, { adLink: e.target.value })}
                  placeholder="https://fb.me/6L2QqVYgY"
                  className={`${inputClass} break-all`}
                />
              </DetailField>

              <DetailField label="Facebook ad link 2">
                <input
                  type="url"
                  value={row.adLink2}
                  onChange={e => onUpdate(row.id, { adLink2: e.target.value })}
                  placeholder="https://fb.me/optional-second-link"
                  className={`${inputClass} break-all`}
                />
              </DetailField>
              <p className="text-[10px] text-ink-400">
                Only needed for older setups. Ad ID matching is preferred.
              </p>
            </div>
          </details>

          <DetailField label="Description">
            <textarea
              value={row.description}
              onChange={e => onUpdate(row.id, { description: e.target.value })}
              placeholder="Describe the product for customers… (optional)"
              rows={6}
              className="input-field resize-y min-h-[120px] h-auto py-2.5"
            />
          </DetailField>

          {showColors && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Colors</p>
                  <p className="text-[10px] text-ink-400 mt-0.5">Optional</p>
                </div>
                <button
                  type="button"
                  onClick={addColor}
                  className="inline-flex items-center min-h-[44px] px-2 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  + Add color
                </button>
              </div>

              <div className="space-y-2">
                {row.colors.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">
                    No colors added. Click &quot;Add color&quot; if this product has variants.
                  </p>
                ) : (
                  row.colors.map((color, index) => (
                    <div key={color.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 text-center shrink-0">{index + 1}</span>
                      <input
                        type="color"
                        value={color.colorHex || DEFAULT_HEX}
                        onChange={e => updateColor(color.id, { colorHex: e.target.value })}
                        className="w-11 h-11 rounded-lg border border-gray-200 cursor-pointer shrink-0 p-0.5"
                        title="Pick color"
                      />
                      <input
                        type="text"
                        value={color.colorName}
                        onChange={e => updateColor(color.id, { colorName: e.target.value })}
                        placeholder="e.g. Navy Blue"
                        maxLength={WHATSAPP_LIST_ROW_TITLE_MAX}
                        className={`${inputClass} flex-1 min-w-0`}
                      />
                      <button
                        type="button"
                        onClick={() => removeColor(color.id)}
                        className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                        title="Remove color"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-ink-100 shrink-0 space-y-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!row.isNew && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="w-full btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Delete product
            </button>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={onSave} disabled={saving} className="flex-1 btn-primary">
              {saving ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : (
                'Save product'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputClass = 'input-field h-10'

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">{label}</p>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
