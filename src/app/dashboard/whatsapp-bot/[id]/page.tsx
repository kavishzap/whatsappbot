import { ProductDetailPage } from '@/components/whatsapp-bot/product-detail-page'

export default function SparkProductDetailRoute({ params }: { params: { id: string } }) {
  return <ProductDetailPage company="spark" productId={params.id} listHref="/dashboard/whatsapp-bot" />
}
