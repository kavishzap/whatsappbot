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
import { getSession, updateSession, resetSession, touchInboundActivity } from './session'
import {
  findItemByLink,
  findItemById,
  getItemLabel,
} from './products'
import { createDraftOrder, completeDraftOrder } from './orders'
import {
  extractMessageInput,
  isYesAnswer,
  isSeeMoreAnswer,
  parseProductSelection,
  parseProductListPage,
  parseQuantitySelection,
  parseQuantity,
  parseCitySelection,
  parseCustomerName,
  parseMenuSelection,
} from './parse-input'
import { sendProductList } from './product-list'
import { sendCityList } from './regions'
import {
  QUANTITY_OPTIONS,
  MAIN_MENU_BUTTONS,
  WELCOME_MENU_MESSAGE,
  OTHER_QUERY_MESSAGE,
  OTHER_QUERY_CTA_LABEL,
  SUPPORT_WHATSAPP_URL,
  formatTotal,
  computeOrderTotal,
  PROCESS_ERROR_MESSAGE,
  DELIVERY_CONFIRMATION_MESSAGE,
} from './constants'
import { getCachedMediaId, setCachedMediaId } from './media-cache'
import type { BotItem, IncomingWhatsAppMessage, MessageInput, WhatsAppSession } from './types'

async function sendProcessError(phone: string, reset = true): Promise<void> {
  try {
    await sendWhatsAppText(phone, PROCESS_ERROR_MESSAGE)
  } catch (replyErr) {
    if (isWhatsAppAuthError(replyErr)) {
      console.error('WhatsApp auth error (could not send process error):', replyErr.message)
    } else {
      console.error('Failed to send process error message:', replyErr)
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

export async function handleChatbotMessage(message: IncomingWhatsAppMessage): Promise<void> {
  const phone = message.from
  const input = extractMessageInput(message)

  if (!input.value && input.type === 'text') {
    return
  }

  let session: WhatsAppSession

  try {
    session = await getSession(phone)
    await touchInboundActivity(phone)
    session = { ...session, last_inbound_at: new Date().toISOString(), reminder_count: 0 }
  } catch (err) {
    console.error('Session load failed:', err)
    await sendProcessError(phone)
    return
  }

  try {
    if (input.type === 'text' && input.value) {
      const item = await findItemByLink(input.value)
      if (item) {
        if (session.state !== 'idle') {
          await resetSession(phone)
        }
        await sendProductAndStartOrder(phone, item)
        return
      }
    }

    if (session.state !== 'idle') {
      await handleActiveSession(phone, session, input)
      return
    }

    await sendMainMenu(phone)
  } catch (err) {
    if (isWhatsAppAuthError(err)) {
      console.error('WhatsApp auth error:', err.message)
      return
    }

    console.error('Chatbot flow error:', err)
    await sendProcessError(phone)
  }
}

async function sendProductAndStartOrder(phone: string, item: BotItem): Promise<void> {
  await sendProductContent(phone, item)

  try {
    await updateSession(phone, {
      state: 'awaiting_order_decision',
      selected_item_id: item.id,
      quantity: null,
      city: null,
      address: null,
      customer_name: null,
      total: null,
      draft_order_id: null,
    })
  } catch (err) {
    console.error('Session update failed after sending product:', err)
  }

  await sendOrderDecisionButtons(phone)
}

async function sendProductContent(phone: string, item: BotItem): Promise<void> {
  const description = item.description?.trim() ?? ''
  const productName = item.product_name?.trim()
  let imageSent = false

  if (item.image_base64) {
    try {
      let mediaId = getCachedMediaId(item.id)
      if (!mediaId) {
        const { buffer, mimeType } = base64ToBuffer(item.image_base64)
        mediaId = await uploadWhatsAppMedia(buffer, mimeType)
        setCachedMediaId(item.id, mediaId)
      }
      await sendWhatsAppImage(phone, mediaId)
      imageSent = true
    } catch (err) {
      if (isWhatsAppAuthError(err)) throw err
      console.error('Failed to send product image:', err)
    }
  }

  if (description) {
    await sendWhatsAppText(phone, description)
  } else if (productName) {
    await sendWhatsAppText(phone, `*${productName}*`)
  } else if (!imageSent) {
    await sendWhatsAppText(phone, 'Here is the product you requested.')
  }
}

async function handleActiveSession(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  switch (session.state) {
    case 'awaiting_menu_selection':
      await handleMenuSelection(phone, session, input)
      break
    case 'awaiting_order_decision':
      await handleOrderDecision(phone, session, input)
      break
    case 'awaiting_product_selection':
      await handleProductSelection(phone, session, input)
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

async function handleMenuSelection(
  phone: string,
  _session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  const selection = parseMenuSelection(input)

  if (selection === 'menu_show' || !selection) {
    if (selection === null && input.type === 'text' && input.value) {
      await sendWhatsAppText(phone, 'Please tap one of the buttons below.')
    }
    await sendMainMenu(phone)
    return
  }

  if (selection === 'menu_order_product') {
    await Promise.all([
      updateSession(phone, { state: 'awaiting_product_selection' }),
      sendProductList(phone),
    ])
    return
  }

  if (selection === 'menu_other_query') {
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

async function handleOrderDecision(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  if (isYesAnswer(input)) {
    await askQuantity(phone, session.selected_item_id)
    return
  }

  if (isSeeMoreAnswer(input)) {
    await Promise.all([
      updateSession(phone, { state: 'awaiting_product_selection' }),
      sendProductList(phone),
    ])
    return
  }

  await sendWhatsAppText(
    phone,
    'Please tap *Yes* to order this product, or *See more products* to browse the catalog.'
  )
  await sendOrderDecisionButtons(phone)
}

async function sendOrderDecisionButtons(phone: string): Promise<void> {
  await sendWhatsAppButtons(phone, 'Do you want to order this product?', [
    { id: 'order_yes', title: 'Yes' },
    { id: 'order_see_more', title: 'See more products' },
  ])
}

async function sendQuantityList(phone: string): Promise<void> {
  await sendWhatsAppList(
    phone,
    'How many would you like to order?',
    'Select quantity',
    QUANTITY_OPTIONS.map(opt => ({
      id: opt.id,
      title: opt.label,
    }))
  )
}

async function proceedAfterQuantity(
  phone: string,
  session: WhatsAppSession,
  qty: number
): Promise<void> {
  const item = session.selected_item_id ? await findItemById(session.selected_item_id) : null
  if (!item) {
    await sendProcessError(phone)
    return
  }

  const total = computeOrderTotal(item.price, qty)
  if (total === null) {
    await sendProcessError(phone)
    return
  }

  await Promise.all([
    updateSession(phone, {
      state: 'awaiting_city',
      quantity: qty,
      total,
    }),
    sendCityList(phone),
  ])
}

async function handleProductSelection(
  phone: string,
  _session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  const listPage = parseProductListPage(input)
  if (listPage !== null) {
    await sendProductList(phone, listPage)
    return
  }

  const productId = parseProductSelection(input)

  if (!productId) {
    await sendWhatsAppText(phone, 'Please select a product from the list below.')
    await sendProductList(phone)
    return
  }

  const item = await findItemById(productId)
  if (!item) {
    await sendWhatsAppText(phone, 'That product is no longer available. Please choose another.')
    await sendProductList(phone)
    return
  }

  await sendProductAndStartOrder(phone, item)
}

async function proceedWithCity(
  phone: string,
  session: WhatsAppSession,
  city: string
): Promise<void> {
  const item = session.selected_item_id ? await findItemById(session.selected_item_id) : null
  if (!item || !session.quantity || session.total === null) {
    await sendProcessError(phone)
    return
  }

  const productName = item.product_name?.trim() || getItemLabel(item)

  const draftResult = await createDraftOrder({
    company: 'spark',
    customer_phone_number: phone,
    product_name: productName,
    quantity: session.quantity,
    city,
    total: session.total,
  })

  if (!draftResult.success || !draftResult.orderId) {
    console.error('Draft order failed:', draftResult.error)
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

async function askQuantity(phone: string, itemId: string | null): Promise<void> {
  if (!itemId) {
    await sendProcessError(phone)
    return
  }

  await Promise.all([
    updateSession(phone, { state: 'awaiting_quantity', selected_item_id: itemId }),
    sendQuantityList(phone),
  ])
}

async function handleQuantity(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  const selection = parseQuantitySelection(input)

  if (selection === 'custom') {
    await Promise.all([
      updateSession(phone, { state: 'awaiting_quantity_custom' }),
      sendWhatsAppText(phone, 'Please type your custom quantity (e.g. 5, 10, 25).'),
    ])
    return
  }

  if (selection === null) {
    await sendWhatsAppText(phone, 'Please select a quantity from the list, or choose *Custom amount*.')
    await sendQuantityList(phone)
    return
  }

  await proceedAfterQuantity(phone, session, selection)
}

async function handleQuantityCustom(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  if (input.type !== 'text') {
    await sendWhatsAppText(phone, 'Please type a number for your custom quantity.')
    return
  }

  const qty = parseQuantity(input)
  if (!qty) {
    await sendWhatsAppText(
      phone,
      'Please enter a valid quantity (a number from 1 to 999, e.g. 5 or 10).'
    )
    return
  }

  await proceedAfterQuantity(phone, session, qty)
}

async function handleCity(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  const city = parseCitySelection(input)
  if (!city) {
    await sendWhatsAppText(phone, 'Please select your region from the list below.')
    await sendCityList(phone)
    return
  }

  await proceedWithCity(phone, session, city)
}

async function handleCustomerName(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  const customerName = parseCustomerName(input)
  if (!customerName) {
    await sendWhatsAppText(phone, 'Please enter your full name (at least 2 characters).')
    return
  }

  const updatedSession = { ...session, customer_name: customerName }

  await Promise.all([
    updateSession(phone, { state: 'awaiting_confirm', customer_name: customerName }),
    sendOrderSummary(phone, updatedSession),
  ])
}

async function sendOrderSummary(phone: string, session: WhatsAppSession): Promise<void> {
  const item = session.selected_item_id ? await findItemById(session.selected_item_id) : null
  const productLabel = item ? getItemLabel(item) : 'Selected product'

  const summary = [
    '*Order summary*',
    '',
    `Name: ${session.customer_name ?? '—'}`,
    `Product: ${productLabel}`,
    `Quantity: ${session.quantity ?? '—'}`,
    `Region: ${session.city ?? '—'}`,
    `*Total: ${session.total != null ? formatTotal(session.total) : '—'}*`,
  ].join('\n')

  await sendWhatsAppButtons(phone, summary, [{ id: 'confirm_yes', title: 'Confirm order' }])
}

async function handleConfirm(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
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
    'spark'
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

  console.error('completeDraftOrder failed:', result.error)
  await sendProcessError(phone)
}
