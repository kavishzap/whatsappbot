'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface HoverTooltipProps {
  content: string
  children: ReactNode
  className?: string
}

export function HoverTooltip({ content, children, className }: HoverTooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)

  const show = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCoords({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    })
    setVisible(true)
  }, [])

  const hide = useCallback(() => setVisible(false), [])

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={className ?? 'inline-flex'}
        aria-label={content}
      >
        {children}
      </span>
      {visible &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              transform: 'translate(-50%, -100%)',
            }}
            className="z-[200] w-max max-w-[18rem] px-2.5 py-1.5 rounded-lg bg-ink-900 text-white text-xs leading-snug shadow-lg pointer-events-none whitespace-normal text-left"
          >
            {content}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-ink-900" />
          </div>,
          document.body
        )}
    </>
  )
}
