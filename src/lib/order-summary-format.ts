export const ORDER_SUMMARY_TITLE = '*📋 Order summary*'

export function formatOrderSummaryRef(ref: string): string {
  return `*Ref:* ${ref}`
}

export function formatOrderSummaryName(name: string): string {
  return `Name: ${name}`
}

export function formatOrderSummaryAddress(address: string): string {
  return `Address: ${address}`
}

export function formatOrderSummaryCity(city: string): string {
  return `📍 City: ${city}`
}

export function formatOrderSummaryProductsHeader(): string {
  return 'Products:'
}

export function formatOrderSummaryItemsHeader(): string {
  return 'Items:'
}

export function formatOrderSummaryDeliveryAddress(city: string): string {
  return `📍 Delivery address: ${city}`
}

export function formatOrderSummaryTotal(total: string): string {
  return `*💰 Total: ${total}*`
}

export function buildOrderSummaryTotalSection(
  notesLines: string[],
  totalFormatted: string
): string[] {
  return [...notesLines, '', formatOrderSummaryTotal(totalFormatted)]
}

export function buildWebOrderSummaryLines(params: {
  orderRef: string
  customerName: string
  address: string
  city: string
  itemLines: string[]
  notesLines: string[]
  totalFormatted: string
}): string[] {
  return [
    ORDER_SUMMARY_TITLE,
    '',
    formatOrderSummaryRef(params.orderRef),
    formatOrderSummaryName(params.customerName),
    formatOrderSummaryAddress(params.address),
    formatOrderSummaryCity(params.city),
    '',
    formatOrderSummaryItemsHeader(),
    ...params.itemLines,
    '',
    ...buildOrderSummaryTotalSection(params.notesLines, params.totalFormatted),
  ]
}

export function buildSimpleOrderSummaryLines(params: {
  customerName: string
  productLines: string[]
  deliveryAddress: string
  notesLines: string[]
  totalFormatted: string
}): string[] {
  return [
    ORDER_SUMMARY_TITLE,
    '',
    formatOrderSummaryName(params.customerName),
    formatOrderSummaryProductsHeader(),
    ...params.productLines,
    formatOrderSummaryDeliveryAddress(params.deliveryAddress),
    ...buildOrderSummaryTotalSection(params.notesLines, params.totalFormatted),
  ]
}
