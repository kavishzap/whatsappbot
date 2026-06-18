'use client'

import { useDashboardHeaderActionsOptional } from './dashboard-header-context'

export function DashboardTopBar({ title }: { title: string }) {
  const header = useDashboardHeaderActionsOptional()

  return (
    <div className="flex flex-1 items-center gap-3 min-w-0 h-full">
      <h1 className="text-base sm:text-lg font-semibold text-ink-900 tracking-tight truncate min-w-0">
        {title}
      </h1>
      {header?.actions && (
        <div className="ml-auto flex items-center gap-2 shrink-0">{header.actions}</div>
      )}
    </div>
  )
}
