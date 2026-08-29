'use client'

import { useEffect, useState } from 'react'

interface WebsiteEmbedProps {
  url: string
  title: string
  /** Sites with X-Frame-Options / CSP frame-ancestors must open externally. */
  display?: 'iframe' | 'external'
  description?: string
}

function displayHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export function WebsiteEmbed({
  url,
  title,
  display = 'iframe',
  description,
}: WebsiteEmbedProps) {
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)

  useEffect(() => {
    if (display === 'iframe') {
      setIframeSrc(url)
    }
  }, [url, display])

  if (display === 'external') {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="panel flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 sm:py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-5">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight">{title}</h2>
          <p className="mt-2 text-sm sm:text-base text-ink-500 max-w-md leading-relaxed">
            {description ??
              'This site cannot be embedded here for security reasons. Open it in a new tab to browse the live store.'}
          </p>
          <p className="mt-3 text-sm font-medium text-brand-700 break-all">{displayHost(url)}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-6 inline-flex items-center gap-2"
          >
            Open website
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="panel flex-1 min-h-0 overflow-hidden flex flex-col">
        {iframeSrc ? (
          <iframe
            src={iframeSrc}
            title={title}
            className="flex-1 w-full min-h-0 border-0 bg-white"
            loading="lazy"
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div className="flex-1 min-h-[200px] flex items-center justify-center text-sm text-ink-400">
            Loading website…
          </div>
        )}
      </div>
    </div>
  )
}
