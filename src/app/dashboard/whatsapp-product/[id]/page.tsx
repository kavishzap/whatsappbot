import { ProductDetailPage } from '@/components/whatsapp-bot/product-detail-page'

export default function SodamaxProductDetailRoute({ params }: { params: { id: string } }) {
  return (
    <ProductDetailPage
      company="sodamax"
      productId={params.id}
      listHref="/dashboard/whatsapp-product"
      showColors
    />
  )
}
