'use client'

import { useEffect, useState } from 'react'

const ORDERING_PLATFORM_URL = 'https://sodamax-online-order.netlify.app'

export default function OrderingPlatformTestPage() {
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)

  useEffect(() => {
    setIframeSrc(ORDERING_PLATFORM_URL)
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="panel flex-1 min-h-0 overflow-hidden flex flex-col">
        {iframeSrc ? (
          <iframe
            src={iframeSrc}
            title="Ordering Platform Test"
            className="flex-1 w-full min-h-0 border-0 bg-white"
            loading="lazy"
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div className="flex-1 min-h-[200px] flex items-center justify-center text-sm text-ink-400">
            Loading platform…
          </div>
        )}
      </div>
    </div>
  )
}
