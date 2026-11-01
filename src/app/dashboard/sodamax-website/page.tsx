'use client'

import { WebsiteEmbed } from '@/components/dashboard/website-embed'

const SODAMAX_WEBSITE_URL = 'https://sodamax.mu'

export default function SodamaxWebsitePage() {
  return <WebsiteEmbed url={SODAMAX_WEBSITE_URL} title="SodaMax website" />
}
