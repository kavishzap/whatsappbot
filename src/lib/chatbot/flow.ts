import {
  sendWhatsAppText,
  sendWhatsAppButtons,
  sendWhatsAppList,
  sendWhatsAppImage,
  uploadWhatsAppMedia,
  base64ToBuffer,
  isWhatsAppAuthError,
} from '@/lib/whatsapp'
import { getSession, updateSession, resetSession } from './session'
import {
  findItemByLink,
  findItemById,
  listAllItems,
  getItemLabel,
} from './products'
import { saveOrder } from './orders'
import {
  extractMessageInput,
  isYesAnswer,
  isNoAnswer,
  isSeeMoreAnswer,
  parseProductSelection,
  parseQuantitySelection,
  parseQuantity,
  parseCitySelection,
  parseAddress,
  parseCustomerName,
  truncate,
} from './parse-input'
import { MAURITIUS_DISTRICTS, QUANTITY_OPTIONS, formatTotal, computeOrderTotal, PROCESS_ERROR_MESSAGE } from './constants'
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
      /* ignore reset failure */
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
  } catch (err) {
    console.error('Session load failed:', err)
    await sendProcessError(phone)
    return
  }

  try {
    // Ad link always starts (or restarts) the product flow — even mid-session.
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
  // 1. Image + description first — always delivered even if session save fails
  await sendProductContent(phone, item)

  // 2. Save session, then order prompt buttons
  try {
    await updateSession(phone, {
      state: 'awaiting_order_decision',
      selected_item_id: item.id,
      quantity: null,
      city: null,
      address: null,
      customer_name: null,
      total: null,
    })
  } catch (err) {
    console.error('Session update failed after sending product:', err)
  }

  await sendWhatsAppButtons(
    phone,
    'Do you want to order this item?',
    [
      { id: 'order_yes', title: 'Yes' },
      { id: 'order_no', title: 'No' },
      { id: 'order_see_more', title: 'See more products' },
    ]
  )
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
    case 'awaiting_address':
      await handleAddress(phone, session, input)
      break
    case 'awaiting_customer_name':
      await handleCustomerName(phone, session, input)
      break
    case 'awaiting_price_confirm':
      await handlePriceConfirm(phone, session, input)
      break
    case 'awaiting_confirm':
      await handleConfirm(phone, session, input)
      break
    default:
      await resetSession(phone)
  }
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

  if (isNoAnswer(input)) {
    await resetSession(phone)
    await sendWhatsAppText(
      phone,
      'No problem! Send a product link anytime if you change your mind.'
    )
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
    'Please tap one of the buttons above, or reply *Yes*, *No*, or *See more products*.'
  )
  await sendOrderDecisionButtons(phone)
}

async function sendOrderDecisionButtons(phone: string): Promise<void> {
  await sendWhatsAppButtons(phone, 'Do you want to order this item?', [
    { id: 'order_yes', title: 'Yes' },
    { id: 'order_no', title: 'No' },
    { id: 'order_see_more', title: 'See more products' },
  ])
}

async function sendProductList(phone: string): Promise<void> {
  const items = await listAllItems()

  if (items.length === 0) {
    await sendWhatsAppText(phone, 'No products are available right now.')
    return
  }

  const rows = items.map((item, index) => ({
    id: `product_${item.id}`,
    title: truncate(getItemLabel(item, index), 24),
  }))

  await sendWhatsAppList(
    phone,
    'Select a product to continue:',
    'View products',
    rows
  )
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

async function sendCityList(phone: string): Promise<void> {
  await sendWhatsAppList(
    phone,
    'Select your district:',
    'Select district',
    MAURITIUS_DISTRICTS.map(d => ({
      id: d.id,
      title: d.name,
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

  const productLabel = getItemLabel(item)
  const summary = [
    '*Price summary*',
    '',
    `Product: ${productLabel}`,
    `Unit price: ${formatTotal(item.price!)}`,
    `Quantity: ${qty}`,
    `*Total: ${formatTotal(total)}*`,
    '',
    'Continue with your order?',
  ].join('\n')

  await updateSession(phone, {
    state: 'awaiting_price_confirm',
    quantity: qty,
    total,
  })

  await sendWhatsAppButtons(phone, summary, [
    { id: 'price_continue', title: 'Continue' },
    { id: 'price_cancel', title: 'Cancel' },
  ])
}

async function handlePriceConfirm(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  if (isNoAnswer(input)) {
    await resetSession(phone)
    await sendWhatsAppText(phone, 'Order cancelled. Send a product link anytime to start again.')
    return
  }

  if (!isYesAnswer(input)) {
    await sendPriceSummary(phone, session)
    return
  }

  await Promise.all([
    updateSession(phone, { state: 'awaiting_city' }),
    sendCityList(phone),
  ])
}

async function sendPriceSummary(phone: string, session: WhatsAppSession): Promise<void> {
  const item = session.selected_item_id ? await findItemById(session.selected_item_id) : null
  if (!item || !session.quantity || session.total === null) {
    await sendProcessError(phone)
    return
  }

  const productLabel = getItemLabel(item)
  const summary = [
    '*Price summary*',
    '',
    `Product: ${productLabel}`,
    `Unit price: ${item.price != null ? formatTotal(item.price) : '—'}`,
    `Quantity: ${session.quantity}`,
    `*Total: ${formatTotal(session.total)}*`,
    '',
    'Continue with your order?',
  ].join('\n')

  await sendWhatsAppButtons(phone, summary, [
    { id: 'price_continue', title: 'Continue' },
    { id: 'price_cancel', title: 'Cancel' },
  ])
}

async function handleProductSelection(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  const productId = parseProductSelection(input)

  if (!productId) {
    if (input.type === 'text') {
      const items = await listAllItems()
      const num = parseInt(input.value.match(/\d+/)?.[0] ?? '', 10)
      if (num >= 1 && num <= items.length) {
        const item = items[num - 1]
        await sendProductAndStartOrder(phone, item)
        return
      }
    }

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
  if (isNoAnswer(input)) {
    await resetSession(phone)
    await sendWhatsAppText(phone, 'Order cancelled. Send a product link anytime to start again.')
    return
  }

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
  if (isNoAnswer(input)) {
    await resetSession(phone)
    await sendWhatsAppText(phone, 'Order cancelled. Send a product link anytime to start again.')
    return
  }

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
  if (isNoAnswer(input)) {
    await resetSession(phone)
    await sendWhatsAppText(phone, 'Order cancelled. Send a product link anytime to start again.')
    return
  }

  const city = parseCitySelection(input)
  if (!city) {
    await sendWhatsAppText(phone, 'Please select your district from the list below.')
    await sendCityList(phone)
    return
  }

  await Promise.all([
    updateSession(phone, { state: 'awaiting_address', city }),
    sendWhatsAppText(phone, 'Please enter your full delivery address.'),
  ])
}

async function handleAddress(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  if (isNoAnswer(input)) {
    await resetSession(phone)
    await sendWhatsAppText(phone, 'Order cancelled. Send a product link anytime to start again.')
    return
  }

  const address = parseAddress(input)
  if (!address) {
    await sendWhatsAppText(phone, 'Please enter a complete address (at least 5 characters).')
    return
  }

  await Promise.all([
    updateSession(phone, { state: 'awaiting_customer_name', address }),
    sendWhatsAppText(phone, 'What is your full name?'),
  ])
}

async function handleCustomerName(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  if (isNoAnswer(input)) {
    await resetSession(phone)
    await sendWhatsAppText(phone, 'Order cancelled. Send a product link anytime to start again.')
    return
  }

  const customerName = parseCustomerName(input)
  if (!customerName) {
    await sendWhatsAppText(phone, 'Please enter your full name (at least 2 characters).')
    return
  }

  await Promise.all([
    updateSession(phone, { state: 'awaiting_confirm', customer_name: customerName }),
    sendOrderSummary(phone, { ...session, customer_name: customerName }),
  ])
}

async function sendOrderSummary(
  phone: string,
  session: WhatsAppSession
): Promise<void> {
  const item = session.selected_item_id ? await findItemById(session.selected_item_id) : null
  const productLabel = item ? getItemLabel(item) : 'Selected product'
  const unitPrice =
    item?.price != null && session.quantity
      ? formatTotal(item.price)
      : null

  const summary = [
    '*Order summary*',
    '',
    `Name: ${session.customer_name ?? '—'}`,
    `Product: ${productLabel}`,
    ...(unitPrice ? [`Unit price: ${unitPrice}`] : []),
    `Quantity: ${session.quantity ?? '—'}`,
    `City: ${session.city ?? '—'}`,
    `Address: ${session.address ?? '—'}`,
    `Total: ${session.total != null ? formatTotal(session.total) : '—'}`,
    '',
    'Save this order?',
  ].join('\n')

  await sendWhatsAppButtons(phone, summary, [
    { id: 'confirm_yes', title: 'Yes, save order' },
    { id: 'confirm_no', title: 'No, cancel' },
  ])
}

async function handleConfirm(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  if (isNoAnswer(input)) {
    await resetSession(phone)
    await sendWhatsAppText(phone, 'Order cancelled. Send a product link anytime to start again.')
    return
  }

  if (!isYesAnswer(input)) {
    await sendWhatsAppText(phone, 'Please tap *Yes, save order* or *No, cancel*, or reply yes/no.')
    await sendOrderSummary(phone, session)
    return
  }

  if (
    !session.selected_item_id ||
    !session.quantity ||
    !session.city ||
    !session.address ||
    !session.customer_name ||
    session.total === null
  ) {
    await sendProcessError(phone)
    return
  }

  const item = await findItemById(session.selected_item_id)
  const productName = item?.product_name?.trim() || (item ? getItemLabel(item) : 'Product')

  const result = await saveOrder({
    customer_name: session.customer_name,
    customer_phone_number: phone,
    product_name: productName,
    quantity: session.quantity,
    city: session.city,
    address: session.address,
    total: session.total,
  })

  if (result.success) {
    await resetSession(phone)
    await sendWhatsAppText(
      phone,
      [
        'Thank you! Your order has been saved successfully.',
        '',
        `Order ref: ${result.orderRef ?? '—'}`,
        `Total: ${formatTotal(session.total)}`,
        '',
        'We will contact you soon.',
      ].join('\n')
    )
    return
  }

  console.error('saveOrder failed:', result.error)
  await sendProcessError(phone)
}
