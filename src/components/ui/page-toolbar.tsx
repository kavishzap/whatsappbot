interface PageToolbarProps {
  actions?: React.ReactNode
  filters?: React.ReactNode
}

export function PageToolbar({ actions, filters }: PageToolbarProps) {
  if (!actions && !filters) return null

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
      {filters ? <div className="flex-1 min-w-0">{filters}</div> : <div />}
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
