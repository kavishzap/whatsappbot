import type { ComponentType } from 'react'

export type NavIcon = ComponentType<{ className?: string }>

export interface NavItem {
  href: string
  label: string
  icon: NavIcon
}

export interface NavSection {
  id: string
  label: string
  accent: 'spark' | 'soda' | 'admin'
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'spark',
    label: 'Spark',
    accent: 'spark',
    items: [
      { href: '/dashboard/spark', label: 'Dashboard', icon: DashboardIcon },
      { href: '/dashboard/whatsapp-bot', label: 'Products', icon: ProductIcon },
      { href: '/dashboard/orders', label: 'Orders', icon: OrdersIcon },
      { href: '/dashboard/messages', label: 'Messages', icon: MessagesIcon },
      { href: '/dashboard/spark-website', label: 'Website', icon: PlatformIcon },
    ],
  },
  {
    id: 'sodamax',
    label: 'SodaMax',
    accent: 'soda',
    items: [
      { href: '/dashboard/sodamax', label: 'Dashboard', icon: DashboardIcon },
      { href: '/dashboard/whatsapp-product', label: 'Products', icon: ProductIcon },
      { href: '/dashboard/sodamax-orders', label: 'Orders', icon: OrdersIcon },
      { href: '/dashboard/sodamax-messages', label: 'Messages', icon: MessagesIcon },
      { href: '/dashboard/sodamax-website', label: 'Website', icon: PlatformIcon },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    accent: 'admin',
    items: [
      { href: '/dashboard/admin/whatsapp', label: 'WhatsApp Integration', icon: IntegrationIcon },
    ],
  },
]

export const PAGE_META: Record<string, { title: string }> = {
  '/dashboard/spark': {
    title: 'Dashboard: Spark',
  },
  '/dashboard/whatsapp-bot': {
    title: 'Products: Spark',
  },
  '/dashboard/orders': {
    title: 'Orders: Spark',
  },
  '/dashboard/messages': {
    title: 'Messages: Spark',
  },
  '/dashboard/spark-website': {
    title: 'Website: Spark',
  },
  '/dashboard/sodamax': {
    title: 'Dashboard: SodaMax',
  },
  '/dashboard/whatsapp-product': {
    title: 'Products: SodaMax',
  },
  '/dashboard/sodamax-orders': {
    title: 'Orders: SodaMax',
  },
  '/dashboard/sodamax-messages': {
    title: 'Messages: SodaMax',
  },
  '/dashboard/sodamax-website': {
    title: 'Website: SodaMax',
  },
  '/dashboard/ordering-platform-test': {
    title: 'Website: SodaMax',
  },
  '/dashboard/admin/whatsapp': {
    title: 'WhatsApp Integration: Admin',
  },
}

export function findSectionForPath(pathname: string): string | null {
  for (const section of NAV_SECTIONS) {
    if (section.items.some(item => isNavItemActive(pathname, item.href))) return section.id
  }
  return null
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getPageMeta(pathname: string): { title: string } {
  if (PAGE_META[pathname]) return PAGE_META[pathname]
  if (pathname.startsWith('/dashboard/whatsapp-bot/')) {
    return { title: pathname.endsWith('/new') ? 'Add product: Spark' : 'Edit product: Spark' }
  }
  if (pathname.startsWith('/dashboard/whatsapp-product/')) {
    return { title: pathname.endsWith('/new') ? 'Add product: SodaMax' : 'Edit product: SodaMax' }
  }
  return PAGE_META['/dashboard/whatsapp-bot']
}

export function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h7V3H3v7zm11 11h7v-7h-7v7zM3 21h7v-7H3v7zm11-11h7V3h-7v7z"
      />
    </svg>
  )
}

export function ProductIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  )
}

export function OrdersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
}

export function PlatformIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  )
}

export function IntegrationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

export function MessagesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-1m6-4V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l4-4h4z"
      />
    </svg>
  )
}
