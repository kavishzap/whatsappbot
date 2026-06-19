'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WhatsAppBotOrder } from '@/lib/whatsapp-bot-orders'

const MENU_WIDTH = 152

interface OrderActionsMenuProps {
  order: WhatsAppBotOrder
  updating: boolean
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
}

export function OrderActionsMenu({
  order,
  updating,
  onApprove,
  onReject,
  onDelete,
}: OrderActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return

    const updatePosition = () => {
      if (!buttonRef.current) return
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + 4,
        left: Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  const run = (action: () => void) => {
    setOpen(false)
    action()
  }

  const items = [
    { key: 'approve', label: 'Approve', onClick: () => run(onApprove) },
    { key: 'reject', label: 'Reject', onClick: () => run(onReject), tone: 'danger' as const },
    { key: 'delete', label: 'Delete', onClick: () => run(onDelete), tone: 'danger' as const },
  ]

  const menu =
    open &&
    menuPosition &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={menuRef}
        role="menu"
        style={{
          position: 'fixed',
          top: menuPosition.top,
          left: menuPosition.left,
          width: MENU_WIDTH,
          zIndex: 9999,
        }}
        className="flex flex-col rounded-lg border border-ink-200 bg-white py-1 shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        {items.map(item => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            disabled={updating}
            onClick={item.onClick}
            className={`block w-full whitespace-nowrap px-3 py-2 text-left text-sm disabled:opacity-40 ${
              item.tone === 'danger'
                ? 'text-red-600 hover:bg-red-50'
                : 'text-ink-700 hover:bg-ink-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>,
      document.body
    )

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={updating}
        onClick={e => {
          e.stopPropagation()
          setOpen(prev => !prev)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for order ${order.order_ref}`}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 disabled:opacity-40"
      >
        {updating ? <Spinner /> : <MoreIcon />}
      </button>
      {menu}
    </>
  )
}

function MoreIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
