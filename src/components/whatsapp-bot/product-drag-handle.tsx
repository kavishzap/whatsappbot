'use client'

import { useRowReorder } from '@/components/ui/row-reorder-context'

interface ProductDragHandleProps {
  rowId: string
  sortOrder: number
}

export function ProductDragHandle({ rowId, sortOrder }: ProductDragHandleProps) {
  const reorder = useRowReorder()
  const disabled = reorder?.disabled ?? true
  const isDragging = reorder?.dragRowId === rowId

  return (
    <div
      className="inline-flex items-center gap-1.5 select-none"
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        draggable={!disabled}
        onDragStart={event => reorder?.onDragStart(event, rowId)}
        onDragEnd={reorder?.onDragEnd}
        disabled={disabled}
        title={disabled ? 'Clear search to reorder' : 'Drag to reorder'}
        aria-label={`Drag product order ${sortOrder}`}
        className={`inline-flex items-center justify-center w-7 h-7 rounded text-ink-400 hover:text-ink-700 hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed ${
          disabled ? '' : 'cursor-grab active:cursor-grabbing'
        } ${isDragging ? 'opacity-50' : ''}`}
      >
        <GripIcon />
      </button>
      <span className="text-xs font-semibold text-ink-600 tabular-nums min-w-[1ch]">
        {sortOrder}
      </span>
    </div>
  )
}

function GripIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
    </svg>
  )
}
