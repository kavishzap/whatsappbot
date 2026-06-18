'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

interface DashboardHeaderContextValue {
  actions: ReactNode
  setActions: (actions: ReactNode) => void
}

const DashboardHeaderContext = createContext<DashboardHeaderContextValue | null>(null)

export function DashboardHeaderProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null)

  const value = useMemo(
    () => ({
      actions,
      setActions,
    }),
    [actions]
  )

  return <DashboardHeaderContext.Provider value={value}>{children}</DashboardHeaderContext.Provider>
}

export function useDashboardHeaderActions(actions: ReactNode) {
  const context = useContext(DashboardHeaderContext)
  if (!context) {
    throw new Error('useDashboardHeaderActions must be used within DashboardHeaderProvider')
  }

  useEffect(() => {
    context.setActions(actions)
    return () => context.setActions(null)
  }, [actions, context])
}

export function useDashboardHeaderActionsOptional() {
  return useContext(DashboardHeaderContext)
}
