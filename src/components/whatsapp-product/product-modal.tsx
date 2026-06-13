'use client'

import { useEffect, useRef } from 'react'
import {
  fileToBase64,
  toImageSrc,
  type WhatsAppProductColor,
} from '@/lib/whatsapp-products'
import { useToast } from '@/components/ui/toast'

export interface ProductColorRow {
  id: string
  colorName: string
  colorHex: string
}

export interface WhatsAppProductModalRow {
  id: string
  name: string
  price: string
  imageBase64: string | null
  imagePreview: string | null
  colors: ProductColorRow[]
  isNew: boolean
}

interface WhatsAppProductModalProps {
  row: WhatsAppProductModalRow | null
  saving?: boolean
  onClose: () => void
  onSave: () => void
  onUpdate: (id: string, updates: Partial<WhatsAppProductModalRow>) => void
  onDelete?: () => void
}

const DEFAULT_HEX = '#10b981'

export function createEmptyColor(): ProductColorRow {
  return { id: crypto.randomUUID(), colorName: '', colorHex: DEFAULT_HEX }
}

export function WhatsAppProductModal({
  row,
  saving = false,
  onClose,
  onSave,
  onUpdate,
  onDelete,
}: WhatsAppProductModalProps) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!row) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !row.isNew) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [row, saving, onClose])

  if (!row) return null

  const dismissOnBackdrop = !row.isNew && !saving

  const imageSrc = row.imagePreview ?? toImageSrc(row.imageBase64)

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await fileToBase64(file)
      onUpdate(row.id, { imageBase64: base64, imagePreview: toImageSrc(base64) })
    } catch {
      toast.error('Could not read the selected image. Please try a different file.')
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
      {dismissOnBackdrop ? (
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          disabled={saving}
          className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm disabled:cursor-not-allowed"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-product-title"
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-fade-in"
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 id="whatsapp-product-title" className="text-lg font-semibold text-gray-900">
            {row.isNew ? 'Add product' : 'Edit product'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
          <div className="flex gap-4 items-start">
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
                className="group relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={row.name || 'Product'}
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
              <DetailField label="Name">
                <input
                  type="text"
                  value={row.name}
                  onChange={e => onUpdate(row.id, { name: e.target.value })}
                  placeholder="Product name"
                  className={inputClass}
                />
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Colors</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Optional</p>
              </div>
              <button
                type="button"
                onClick={addColor}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                + Add color
              </button>
            </div>

            <div className="space-y-2">
              {row.colors.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No colors added. Click &quot;Add color&quot; if this product has variants.</p>
              ) : (
                row.colors.map((color, index) => (
                  <div key={color.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-center shrink-0">{index + 1}</span>
                    <input
                      type="color"
                      value={color.colorHex || DEFAULT_HEX}
                      onChange={e => updateColor(color.id, { colorHex: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer shrink-0 p-0.5"
                      title="Pick color"
                    />
                    <input
                      type="text"
                      value={color.colorName}
                      onChange={e => updateColor(color.id, { colorName: e.target.value })}
                      placeholder="e.g. Navy Blue"
                      className={`${inputClass} flex-1 min-w-0`}
                    />
                    <button
                      type="button"
                      onClick={() => removeColor(color.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0"
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
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
          {!row.isNew && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="w-full py-2 text-sm font-medium rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Delete product
            </button>
          )}
          <div className="flex gap-2">
            {!row.isNew && (
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={`py-2.5 text-sm font-medium rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2 ${row.isNew ? 'w-full' : 'flex-1'}`}
            >
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

const inputClass =
  'w-full h-10 border border-gray-200 rounded-lg px-3 text-sm text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400'

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
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

export function colorsFromApi(colors: WhatsAppProductColor[]): ProductColorRow[] {
  return colors.map(c => ({
    id: c.id ?? crypto.randomUUID(),
    colorName: c.color_name,
    colorHex: c.color_hex ?? DEFAULT_HEX,
  }))
}

export function colorsToApi(colors: ProductColorRow[]): WhatsAppProductColor[] {
  return colors
    .filter(c => c.colorName.trim())
    .map(c => ({
      color_name: c.colorName.trim(),
      color_hex: c.colorHex || null,
    }))
}
