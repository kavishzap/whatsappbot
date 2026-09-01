'use client'

import { WebsiteEmbed } from '@/components/dashboard/website-embed'

const SPARK_WEBSITE_URL = 'https://sparkmauritius.com'

export default function SparkWebsitePage() {
  return <WebsiteEmbed url={SPARK_WEBSITE_URL} title="Spark website" />
}
