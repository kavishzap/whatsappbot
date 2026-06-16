import {
  sendWhatsAppText,
  sendWhatsAppButtons,
  sendWhatsAppList,
  sendWhatsAppImage,
  sendWhatsAppCtaUrl,
  uploadWhatsAppMedia,
  base64ToBuffer,
  isWhatsAppAuthError,
} from '@/lib/whatsapp'
import { getCachedMediaId, setCachedMediaId } from '@/lib/chatbot/media-cache'
import { sendCityList } from '@/lib/chatbot/regions'
import { createDraftOrder, completeDraftOrder } from '@/lib/chatbot/orders'
import { extractMessageInput } from '@/lib/chatbot/parse-input'
import { getSession, updateSession, resetSession, touchInboundActivity } from './session'
import { findSodamaxProductById, getSodamaxProductLabel, findNewMachineProduct, isNewMachineProductId } from './products'
import { sendSodamaxProductList } from './product-list'
import {
  parseMenuSelection,
  isYesAnswer,
  isSeeMoreAnswer,
  parseProductSelection,
  parseProductListPage,
  isColorYesAnswer,
  isColorNoAnswer,
  parseQuantitySelection,
  parseQuantity,
  parseCitySelection,
  parseCustomerName,
} from './parse-input'
import {
  MAIN_MENU_BUTTONS,
  WELCOME_MENU_MESSAGE,
  OTHER_QUERY_MESSAGE,
  OTHER_QUERY_CTA_LABEL,
  SUPPORT_WHATSAPP_URL,
  QUANTITY_OPTIONS,
  formatTotal,
  computeOrderTotal,
  PROCESS_ERROR_MESSAGE,
  DELIVERY_CONFIRMATION_MESSAGE,
} from './constants'
import type { IncomingWhatsAppMessage, MessageInput, SodamaxProduct, SodamaxSession } from './types'

async function sendProcessError(phone: string, reset = true): Promise<void> {
  try {
    await sendWhatsAppText(phone, PROCESS_ERROR_MESSAGE)
  } catch (replyErr) {
    if (isWhatsAppAuthError(replyErr)) {
      console.error('SodaMax WhatsApp auth error:', replyErr.message)
    }
  }
  if (reset) {
    try {
      await resetSession(phone)
    } catch {
      /* ignore */
    }
  }
}

export async function handleSodamaxMessage(message: IncomingWhatsAppMessage): Promise<void> {
  const phone = message.from
  const input = extractMessageInput(message)

  if (!input.value && input.type === 'text') return

  let session: SodamaxSession

  try {
    session = await getSession(phone)
    await touchInboundActivity(phone)
    session = { ...session, last_inbound_at: new Date().toISOString(), reminder_count: 0 }
  } catch (err) {
    console.error('SodaMax session load failed:', err)
    await sendProcessError(phone)
    return
  }

  try {
    if (session.state !== 'idle') {
      await handleActiveSession(phone, session, input)
      return
    }

    await sendMainMenu(phone)
  } catch (err) {
    if (isWhatsAppAuthError(err)) {
      console.error('SodaMax WhatsApp auth error:', err.message)
      return
    }
    console.error('SodaMax flow error:', err)
    await sendProcessError(phone)
  }
}

async function sendMainMenu(phone: string): Promise<void> {
  await updateSession(phone, {
    state: 'awaiting_menu_selection',
    selected_item_id: null,
    quantity: null,
    city: null,
    address: null,
    customer_name: null,
    total: null,
    draft_order_id: null,
  })

  await sendWhatsAppButtons(
    phone,
    WELCOME_MENU_MESSAGE,
    MAIN_MENU_BUTTONS.map(opt => ({ id: opt.id, title: opt.title }))
  )
}

async function handleActiveSession(
  phone: string,
  session: SodamaxSession,
  input: MessageInput
): Promise<void> {
  switch (session.state) {
    case 'awaiting_menu_selection':
      await handleMenuSelection(phone, input)
      break
    case 'awaiting_product_selection':
      await handleProductSelection(phone, input)
      break
    case 'awaiting_color_selection':
      await handleColorSelection(phone, session, input)
      break
    case 'awaiting_order_decision':
      await handleOrderDecision(phone, session, input)
      break
    case 'awaiting_quantity':
      await handleQuantity(phone, session, input)
      break
    case 'awaiting_quantity_custom':
      await handleQuantityCustom(phone, session, input)
      break
    case 'awaiting_city':
      await handleCity(phone, session, input)
      break
    case 'awaiting_customer_name':
      await handleCustomerName(phone, session, input)
      break
    case 'awaiting_confirm':
      await handleConfirm(phone, session, input)
      break
    default:
      await resetSession(phone)
  }
}

async function handleMenuSelection(phone: string, input: MessageInput): Promise<void> {
  const selection = parseMenuSelection(input)

  if (selection === 'sm_show_menu' || !selection) {
    if (selection === null && input.type === 'text' && input.value) {
      await sendWhatsAppText(phone, 'Please tap one of the buttons below.')
    }
    await sendMainMenu(phone)
    return
  }

  if (selection === 'sm_new_machine') {
    await startNewMachineFlow(phone)
    return
  }

  if (selection === 'sm_order_product') {
    await Promise.all([
      updateSession(phone, { state: 'awaiting_product_selection' }),
      sendSodamaxProductList(phone),
    ])
    return
  }

  if (selection === 'sm_other_query') {
    await resetSession(phone)
    await sendWhatsAppCtaUrl(
      phone,
      OTHER_QUERY_MESSAGE,
      OTHER_QUERY_CTA_LABEL,
      SUPPORT_WHATSAPP_URL
    )
    return
  }

  await sendMainMenu(phone)
}

async function startNewMachineFlow(phone: string): Promise<void> {
  const product = await findNewMachineProduct()
  if (!product) {
    await sendWhatsAppText(
      phone,
      'Our new machine is not available right now. Please add a *Soda Max Machine* product in the dashboard, or try again later.'
    )
    await sendMainMenu(phone)
    return
  }

  await sendProductContent(phone, product, null)

  if (product.colors.length > 0) {
    await beginColorSelection(phone, product)
    return
  }

  await updateSession(phone, {
    state: 'awaiting_quantity',
    selected_item_id: product.id,
    quantity: null,
    city: null,
    address: null,
    customer_name: null,
    total: null,
    draft_order_id: null,
  })
  await askQuantity(phone, product.id)
}

function formatColorPrompt(color: { color_name: string; color_hex: string | null }): string {
  const name = color.color_name.trim()
  const hex = color.color_hex?.trim()
  if (hex) return `${name}\n${hex}\n\nIs this your color?`
  return `${name}\n\nIs this your color?`
}

async function sendColorPrompt(phone: string, product: SodamaxProduct, index: number): Promise<void> {
  const color = product.colors[index]
  if (!color) return

  await sendWhatsAppButtons(phone, formatColorPrompt(color), [
    { id: 'sm_color_yes', title: 'Yes' },
    { id: 'sm_color_no', title: 'No' },
  ])
}

async function beginColorSelection(phone: string, product: SodamaxProduct): Promise<void> {
  await updateSession(phone, {
    state: 'awaiting_color_selection',
    selected_item_id: product.id,
    quantity: 0,
    city: null,
    address: null,
    customer_name: null,
    total: null,
    draft_order_id: null,
  })
  await sendColorPrompt(phone, product, 0)
}

async function proceedToQuantityAfterColor(
  phone: string,
  product: SodamaxProduct,
  colorName: string
): Promise<void> {
  await updateSession(phone, {
    state: 'awaiting_quantity',
    selected_item_id: product.id,
    address: colorName,
    quantity: null,
    city: null,
    customer_name: null,
    total: null,
    draft_order_id: null,
  })
  await askQuantity(phone, product.id)
}

async function handleProductSelection(phone: string, input: MessageInput): Promise<void> {
  const listPage = parseProductListPage(input)
  if (listPage !== null) {
    await sendSodamaxProductList(phone, listPage)
    return
  }

  const productId = parseProductSelection(input)
  if (!productId) {
    await sendWhatsAppText(phone, 'Please select a product from the list below.')
    await sendSodamaxProductList(phone)
    return
  }

  const product = await findSodamaxProductById(productId)
  if (!product) {
    await sendWhatsAppText(phone, 'That product is no longer available. Please choose another.')
    await sendSodamaxProductList(phone)
    return
  }

  if (product.colors.length > 0) {
    await beginColorSelection(phone, product)
    return
  }

  await startProductOrder(phone, product, null)
}

async function handleColorSelection(
  phone: string,
  session: SodamaxSession,
  input: MessageInput
): Promise<void> {
  if (!session.selected_item_id) {
    await sendProcessError(phone)
    return
  }

  const product = await findSodamaxProductById(session.selected_item_id)
  if (!product || product.colors.length === 0) {
    await sendProcessError(phone)
    return
  }

  const colorIndex = session.quantity ?? 0
  const color = product.colors[colorIndex]

  if (!color) {
    await beginColorSelection(phone, product)
    return
  }

  if (isColorYesAnswer(input)) {
    if (await isNewMachineProductId(session.selected_item_id)) {
      await proceedToQuantityAfterColor(phone, product, color.color_name)
      return
    }
    await startProductOrder(phone, product, color.color_name)
    return
  }

  if (isColorNoAnswer(input)) {
    const nextIndex = colorIndex + 1
    if (nextIndex >= product.colors.length) {
      await sendWhatsAppText(phone, 'That was the last color. Please tap *Yes* on your preferred color.')
      await updateSession(phone, { quantity: 0 })
      await sendColorPrompt(phone, product, 0)
      return
    }
    await updateSession(phone, { quantity: nextIndex })
    await sendColorPrompt(phone, product, nextIndex)
    return
  }

  await sendWhatsAppText(phone, 'Please tap *Yes* or *No*.')
  await sendColorPrompt(phone, product, colorIndex)
}

async function startProductOrder(
  phone: string,
  product: SodamaxProduct,
  colorName: string | null
): Promise<void> {
  await sendProductContent(phone, product, colorName)

  await updateSession(phone, {
    state: 'awaiting_order_decision',
    selected_item_id: product.id,
    address: colorName,
    quantity: null,
    city: null,
    customer_name: null,
    total: null,
    draft_order_id: null,
  })

  await sendOrderDecisionButtons(phone)
}

async function sendProductContent(
  phone: string,
  product: SodamaxProduct,
  colorName: string | null
): Promise<void> {
  let imageSent = false

  if (product.image_base64) {
    try {
      let mediaId = getCachedMediaId(product.id)
      if (!mediaId) {
        const { buffer, mimeType } = base64ToBuffer(product.image_base64)
        mediaId = await uploadWhatsAppMedia(buffer, mimeType)
        setCachedMediaId(product.id, mediaId)
      }
      await sendWhatsAppImage(phone, mediaId)
      imageSent = true
    } catch (err) {
      if (isWhatsAppAuthError(err)) throw err
      console.error('SodaMax product image failed:', err)
    }
  }

  const description = product.description?.trim()
  if (description) {
    await sendWhatsAppText(phone, description)
  } else {
    const lines = [`*${getSodamaxProductLabel(product)}*`]
    if (colorName) lines.push(`Color: ${colorName}`)
    if (product.price > 0) lines.push(formatTotal(product.price))
    await sendWhatsAppText(phone, lines.join('\n'))
  }

  if (!imageSent && !description && !colorName && product.price <= 0) {
    await sendWhatsAppText(phone, 'Here is the product you requested.')
  }
}

async function sendOrderDecisionButtons(phone: string): Promise<void> {
  await sendWhatsAppButtons(phone, 'Do you want to order this product?', [
    { id: 'sm_order_yes', title: 'Yes' },
    { id: 'sm_order_see_more', title: 'See more products' },
  ])
}

async function handleOrderDecision(
  phone: string,
  session: SodamaxSession,
  input: MessageInput
): Promise<void> {
  if (isYesAnswer(input)) {
    await askQuantity(phone, session.selected_item_id)
    return
  }

  if (isSeeMoreAnswer(input)) {
    await Promise.all([
      updateSession(phone, { state: 'awaiting_product_selection' }),
      sendSodamaxProductList(phone),
    ])
    return
  }

  await sendWhatsAppText(phone, 'Please tap *Yes* to order, or *See more products* to browse.')
  await sendOrderDecisionButtons(phone)
}

async function askQuantity(phone: string, itemId: string | null): Promise<void> {
  if (!itemId) {
    await sendProcessError(phone)
    return
  }

  await Promise.all([
    updateSession(phone, { state: 'awaiting_quantity', selected_item_id: itemId }),
    sendWhatsAppList(
      phone,
      'How many would you like to order?',
      'Select quantity',
      QUANTITY_OPTIONS.map(opt => ({
        id: opt.id.replace('qty_', 'sm_qty_'),
        title: opt.label,
      }))
    ),
  ])
}

async function handleQuantity(phone: string, session: SodamaxSession, input: MessageInput): Promise<void> {
  const selection = parseQuantitySelection(input)

  if (selection === 'custom') {
    await Promise.all([
      updateSession(phone, { state: 'awaiting_quantity_custom' }),
      sendWhatsAppText(phone, 'Please type your custom quantity (e.g. 5, 10, 25).'),
    ])
    return
  }

  if (selection === null) {
    await sendWhatsAppText(phone, 'Please select a quantity from the list.')
    await askQuantity(phone, session.selected_item_id)
    return
  }

  await proceedAfterQuantity(phone, session, selection)
}

async function handleQuantityCustom(
  phone: string,
  session: SodamaxSession,
  input: MessageInput
): Promise<void> {
  if (input.type !== 'text') {
    await sendWhatsAppText(phone, 'Please type a number for your custom quantity.')
    return
  }

  const qty = parseQuantity(input)
  if (!qty) {
    await sendWhatsAppText(phone, 'Please enter a valid quantity (1–999).')
    return
  }

  await proceedAfterQuantity(phone, session, qty)
}

async function proceedAfterQuantity(phone: string, session: SodamaxSession, qty: number): Promise<void> {
  const product = session.selected_item_id
    ? await findSodamaxProductById(session.selected_item_id)
    : null
  if (!product) {
    await sendProcessError(phone)
    return
  }

  const total = computeOrderTotal(product.price, qty)
  if (total === null) {
    await sendProcessError(phone)
    return
  }

  await Promise.all([
    updateSession(phone, { state: 'awaiting_city', quantity: qty, total }),
    sendCityList(phone),
  ])
}

async function handleCity(phone: string, session: SodamaxSession, input: MessageInput): Promise<void> {
  const city = parseCitySelection(input)
  if (!city) {
    await sendWhatsAppText(phone, 'Please select your region from the list below.')
    await sendCityList(phone)
    return
  }

  const product = session.selected_item_id
    ? await findSodamaxProductById(session.selected_item_id)
    : null
  if (!product || !session.quantity || session.total === null) {
    await sendProcessError(phone)
    return
  }

  let productName = getSodamaxProductLabel(product)
  if (session.address) productName += ` (${session.address})`

  const draftResult = await createDraftOrder({
    company: 'sodamax',
    customer_phone_number: phone,
    product_name: productName,
    quantity: session.quantity,
    city,
    total: session.total,
  })

  if (!draftResult.success || !draftResult.orderId) {
    await sendProcessError(phone)
    return
  }

  await Promise.all([
    updateSession(phone, {
      state: 'awaiting_customer_name',
      city,
      draft_order_id: draftResult.orderId,
    }),
    sendWhatsAppText(phone, 'What is your full name?'),
  ])
}

async function handleCustomerName(phone: string, session: SodamaxSession, input: MessageInput): Promise<void> {
  const customerName = parseCustomerName(input)
  if (!customerName) {
    await sendWhatsAppText(phone, 'Please enter your full name (at least 2 characters).')
    return
  }

  const updated = { ...session, customer_name: customerName }
  await Promise.all([
    updateSession(phone, { state: 'awaiting_confirm', customer_name: customerName }),
    sendOrderSummary(phone, updated),
  ])
}

async function sendOrderSummary(phone: string, session: SodamaxSession): Promise<void> {
  const product = session.selected_item_id
    ? await findSodamaxProductById(session.selected_item_id)
    : null
  let productLabel = product ? getSodamaxProductLabel(product) : 'Selected product'
  if (session.address) productLabel += ` (${session.address})`

  const summary = [
    '*Order summary*',
    '',
    `Name: ${session.customer_name ?? '—'}`,
    `Product: ${productLabel}`,
    `Quantity: ${session.quantity ?? '—'}`,
    `Region: ${session.city ?? '—'}`,
    `*Total: ${session.total != null ? formatTotal(session.total) : '—'}*`,
  ].join('\n')

  await sendWhatsAppButtons(phone, summary, [{ id: 'sm_confirm_yes', title: 'Confirm order' }])
}

async function handleConfirm(phone: string, session: SodamaxSession, input: MessageInput): Promise<void> {
  if (!isYesAnswer(input)) {
    await sendWhatsAppText(phone, 'Please tap *Confirm order* to complete your order.')
    await sendOrderSummary(phone, session)
    return
  }

  if (
    !session.draft_order_id ||
    !session.customer_name ||
    !session.quantity ||
    !session.city ||
    session.total === null
  ) {
    await sendProcessError(phone)
    return
  }

  const result = await completeDraftOrder(
    session.draft_order_id,
    { customer_name: session.customer_name },
    'sodamax'
  )

  if (result.success) {
    await resetSession(phone)
    await sendWhatsAppText(
      phone,
      [
        'Thank you! Your order has been confirmed.',
        '',
        `*Order ref:* *${result.orderRef ?? '—'}*`,
        `*Total:* *${formatTotal(session.total)}*`,
        '',
        DELIVERY_CONFIRMATION_MESSAGE,
      ].join('\n')
    )
    return
  }

  await sendProcessError(phone)
}
