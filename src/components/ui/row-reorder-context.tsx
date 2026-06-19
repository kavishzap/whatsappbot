'use client'

import { createContext, useContext, type DragEvent, type ReactNode } from 'react'

export interface RowReorderContextValue {
  dragRowId: string | null
  dragOverRowId: string | null
  disabled: boolean
  onDragStart: (event: DragEvent, rowId: string) => void
  onDragEnd: () => void
}

const RowReorderContext = createContext<RowReorderContextValue | null>(null)

export function RowReorderProvider({
  value,
  children,
}: {
  value: RowReorderContextValue
  children: ReactNode
}) {
  return <RowReorderContext.Provider value={value}>{children}</RowReorderContext.Provider>
}

export function useRowReorder(): RowReorderContextValue | null {
  return useContext(RowReorderContext)
}
