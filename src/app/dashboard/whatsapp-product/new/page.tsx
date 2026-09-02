import { ProductDetailPage } from '@/components/whatsapp-bot/product-detail-page'

export default function SodamaxNewProductPage() {
  return (
    <ProductDetailPage
      company="sodamax"
      productId={null}
      listHref="/dashboard/whatsapp-product"
      showColors
    />
  )
}
