'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  colorsFromApi,
  colorsToApi,
  createBotItem,
  deleteBotItem,
  fetchBotItem,
  toImageSrc,
  updateBotItem,
  type WhatsAppBotItem,
} from '@/lib/whatsapp-bot-items'
import { getBotItemErrorMessage, validateBotItemRow, validateProductColors } from '@/lib/error-messages'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  ProductDetailForm,
  createEmptyProductRow,
  type ProductDetailRow,
} from '@/components/whatsapp-bot/product-detail-form'

interface ProductDetailPageProps {
  company: WhatsAppCompany
  productId: string | null
  listHref: string
  showColors?: boolean
}

function itemToDetail(item: WhatsAppBotItem): ProductDetailRow {
  const imageBase64 = item.image_base64 ?? null
  return {
    id: item.id,
    productName: item.product_name ?? '',
    price: item.price != null ? String(item.price) : '',
    adId: item.ad_id ?? '',
    adId2: item.ad_id_2 ?? '',
    adLink: item.ad_link ?? '',
    adLink2: item.ad_link_2 ?? '',
    imageBase64,
    imagePreview: toImageSrc(imageBase64),
    description: item.description ?? '',
    isWebsite: item.is_website === true,
    isWhatsapp: item.is_whatsapp !== false,
    promo: item.promo === true,
    preOrder: item.pre_order === true,
    soldOut: item.sold_out === true,
    colors: colorsFromApi(item.colors ?? []),
    isNew: false,
  }
}

export function ProductDetailPage({
  company,
  productId,
  listHref,
  showColors = false,
}: ProductDetailPageProps) {
  const router = useRouter()
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const isNew = productId === null

  const [row, setRow] = useState<ProductDetailRow | null>(() => (isNew ? createEmptyProductRow() : null))
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const goBack = useCallback(() => {
    router.push(listHref)
  }, [listHref, router])

  useEffect(() => {
    if (isNew || !productId) return

    let cancelled = false
    setLoading(true)
    fetchBotItem(company, productId)
      .then(item => {
        if (cancelled) return
        setRow(itemToDetail(item))
      })
      .catch(err => {
        if (cancelled) return
        toastRef.current.error(getBotItemErrorMessage(err))
        goBack()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [company, goBack, isNew, productId])

  const updateRow = (_id: string, updates: Partial<ProductDetailRow>) => {
    setRow(prev => (prev ? { ...prev, ...updates } : prev))
  }

  const handleSave = async () => {
    if (!row) return

    const validationError =
      validateBotItemRow(row) ?? (showColors ? validateProductColors(row.colors) : null)
    if (validationError) {
      toast.error(validationError)
      return
    }

    const payload = {
      company,
      ad_id: row.adId.trim() || null,
      ad_id_2: row.adId2.trim() || null,
      ad_link: row.adLink.trim() || null,
      ad_link_2: row.adLink2.trim() || null,
      product_name: row.productName.trim(),
      price: parseFloat(row.price),
      image_base64: row.imageBase64,
      description: row.description.trim(),
      is_website: row.isWebsite,
      is_whatsapp: row.isWhatsapp,
      promo: row.promo,
      pre_order: row.preOrder,
      sold_out: row.soldOut,
      ...(showColors ? { colors: colorsToApi(row.colors) } : {}),
    }

    setSaving(true)
    try {
      if (row.isNew) {
        const created = await createBotItem(company, payload)
        toast.success('Product added')
        if (created?.id) {
          router.replace(`${listHref}/${created.id}`)
          return
        }
        setRow(itemToDetail(created))
      } else {
        const saved = await updateBotItem(company, row.id, payload)
        setRow(itemToDetail(saved))
        toast.success('Product saved')
      }
    } catch (err) {
      toast.error(getBotItemErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!row || row.isNew) return
    setDeleting(true)
    try {
      await deleteBotItem(company, row.id)
      toast.success('Product deleted')
      goBack()
    } catch (err) {
      toast.error(getBotItemErrorMessage(err))
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full gap-3 overflow-hidden">
      <ConfirmDialog
        open={deleteOpen}
        title="Delete product?"
        description={
          row?.productName
            ? `"${row.productName}" will be permanently removed from the bot catalog.`
            : 'This product will be permanently removed from the bot catalog.'
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onCancel={() => !deleting && setDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      <button
        type="button"
        onClick={() => !saving && goBack()}
        disabled={saving}
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-500 hover:text-ink-800 disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to products
      </button>

      {loading || !row ? (
        <div className="panel flex-1 min-h-0 flex items-center justify-center text-sm text-ink-400">
          Loading product…
        </div>
      ) : (
        <ProductDetailForm
          row={row}
          company={company}
          saving={saving || deleting}
          showColors={showColors}
          onCancel={goBack}
          onSave={handleSave}
          onUpdate={updateRow}
          onDelete={row.isNew ? undefined : () => setDeleteOpen(true)}
        />
      )}
    </div>
  )
}
