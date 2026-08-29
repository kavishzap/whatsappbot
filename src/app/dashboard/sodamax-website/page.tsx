'use client'

import { WebsiteEmbed } from '@/components/dashboard/website-embed'

const SODAMAX_WEBSITE_URL = 'https://sodamax-online-order.netlify.app'

export default function SodamaxWebsitePage() {
  return <WebsiteEmbed url={SODAMAX_WEBSITE_URL} title="SodaMax website" />
}
