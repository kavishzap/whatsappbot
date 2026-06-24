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
import { getCachedMediaId, setCachedMediaId } from '@/lib/spark/media-cache'
import { sendDeliveryAddressPrompt } from '@/lib/spark/regions'
import { createDraftOrder, completeDraftOrder, patchDraftOrder, getDraftOrderByRef, getDraftOrderById } from '@/lib/spark/orders'
import { findItemByLink, findItemByReferral } from '@/lib/spark/products'
import {
  fetchDraftOrderNotes,
  formatNotesSummaryLines,
  parseOrderNotesText,
  saveDraftOrderNotes,
  sendOrderNotesPrompt,
  SODAMAX_SKIP_NOTES_BUTTON,
  isSkipNotesAnswer,
} from '@/lib/spark/order-notes'
import {
  buildSimpleOrderSummaryLines,
  buildWebOrderSummaryLines,
} from '@/lib/order-summary-format'
import {
  displayOrderCustomerName,
  formatOrderTotal,
} from '@/lib/whatsapp-bot-orders'
import { extractMessageInput, parseProfileName, parseCustomerName } from '@/lib/spark/parse-input'
import { loadSession, updateSession, resetSession } from './session'
import { findSodamaxProductById, getSodamaxProductLabel, findNewMachineProduct, isNewMachineProductId, resolveSodamaxProductWithImage } from './products'
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
  parseAddress,
  parseNewMachineColorSelection,
  parseOrderRef,
  isAddNotesAnswer,
} from './parse-input'
import {
  MAIN_MENU_BUTTONS,
  WELCOME_MENU_MESSAGE,
  OTHER_QUERY_MESSAGE,
  OTHER_QUERY_CTA_LABEL,
  OTHER_QUERY_BUTTON_TITLE,
  SUPPORT_WHATSAPP_URL,
  WEB_CHECKOUT_MESSAGE,
  WEB_CHECKOUT_CTA_LABEL,
  buildOrderPlatformUrl,
  QUANTITY_OPTIONS,
  NEW_MACHINE_COLOR_OPTIONS,
  NEW_MACHINE_COLOR_PROMPT,
  formatTotal,
  computeOrderTotal,
  PROCESS_ERROR_MESSAGE,
} from './constants'
import { scheduleSodamaxFlavourPromo } from './promo-schedule'
import { QUANTITY_LIST_HEADER } from '@/lib/spark/quantity-list'
import { sendProcessErrorWithSupport } from '@/lib/spark/process-error'
import { buildCityIdPatch } from '@/lib/spark/match-city'
import { sendOrderThankYouWithOtherQuery } from '@/lib/order-thank-you'
import {
  formatBotItemLineWithPrice,
  formatOrderItemLineWithPrice,
} from '@/lib/order-summary-lines'
import type { IncomingWhatsAppMessage, MessageInput, SodamaxProduct, SodamaxSession } from './types'
import type { WhatsAppBotOrder } from '@/lib/whatsapp-bot-orders'

async function sendProcessError(phone: string, reset = true): Promise<void> {
  await sendProcessErrorWithSupport(phone, {
    message: PROCESS_ERROR_MESSAGE,
    ctaLabel: OTHER_QUERY_CTA_LABEL,
    supportUrl: SUPPORT_WHATSAPP_URL,
    reset: reset ? () => resetSession(phone) : undefined,
    logLabel: 'SodaMax',
  })
}

export async function handleSodamaxMessage(message: IncomingWhatsAppMessage): Promise<void> {
  const phone = message.from
  const input = extractMessageInput(message)
  const hasReferral = Boolean(message.referral?.source_id || message.referral?.source_url)

  if (!input.value && input.type === 'text' && !hasReferral) return

  let session: SodamaxSession

  try {
    session = await loadSession(phone)
  } catch (err) {
    console.error('SodaMax session load failed:', err)
    await sendProcessError(phone)
    return
  }

  try {
    const orderRef = parseOrderRef(input)
    if (orderRef) {
      await resumeFromWebDraftOrder(phone, orderRef)
      return
    }

    if (message.referral) {
      const item = await findItemByReferral(message.referral, 'sodamax')
      if (item) {
        if (session.state !== 'idle') {
          await resetSession(phone)
        }
        await startFromAdLink(phone, item.id)
        return
      }
    }

    if (input.type === 'text' && input.value) {
      const item = await findItemByLink(input.value, 'sodamax')
      if (item) {
        if (session.state !== 'idle') {
          await resetSession(phone)
        }
        await startFromAdLink(phone, item.id)
        return
      }
    }

    if (session.state !== 'idle') {
      await handleActiveSession(phone, session, input, message.profile_name)
      return
    }

    const menuSelection = parseMenuSelection(input)
    if (menuSelection && menuSelection !== 'sm_show_menu') {
      await updateSession(phone, { state: 'awaiting_menu_selection' })
      await handleMenuSelection(phone, input, message.profile_name)
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
  await Promise.all([
    updateSession(phone, {
      state: 'awaiting_menu_selection',
      selected_item_id: null,
      quantity: null,
      city: null,
      address: null,
      customer_name: null,
      total: null,
      draft_order_id: null,
    }),
    sendWhatsAppButtons(
      phone,
      WELCOME_MENU_MESSAGE,
      MAIN_MENU_BUTTONS.map(opt => ({ id: opt.id, title: opt.title }))
    ),
  ])
}

async function handleActiveSession(
  phone: string,
  session: SodamaxSession,
  input: MessageInput,
  profileName?: string
): Promise<void> {
  switch (session.state) {
    case 'awaiting_menu_selection':
      await handleMenuSelection(phone, input, profileName)
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
      await handleQuantity(phone, session, input, profileName)
      break
    case 'awaiting_quantity_custom':
      await handleQuantityCustom(phone, session, input, profileName)
      break
    case 'awaiting_region':
      if (session.quantity && session.selected_item_id) {
        if (session.total !== null) {
          await proceedAfterQuantityWithDraft(
            phone,
            session,
            session.quantity,
            session.total,
            profileName
          )
        } else {
          await proceedAfterQuantity(phone, session, session.quantity, profileName)
        }
      } else {
        await sendProcessError(phone)
      }
      break
    case 'awaiting_delivery_address':
      await handleDeliveryAddress(phone, session, input, profileName)
      break
    case 'awaiting_customer_name':
      await proceedToConfirmWithProfileName(phone, session, session.city ?? '', profileName, input)
      break
    case 'awaiting_notes':
      await handleNotesInput(phone, session, input)
      break
    case 'awaiting_confirm':
      await handleConfirm(phone, session, input)
      break
    case 'awaiting_web_checkout':
      await handleWebCheckout(phone, input, profileName)
      break
    default:
      await resetSession(phone)
  }
}

async function handleMenuSelection(
  phone: string,
  input: MessageInput,
  profileName?: string
): Promise<void> {
  const selection = parseMenuSelection(input)
  const customerName = parseProfileName(profileName)

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
    const storeUrl = buildOrderPlatformUrl(phone, customerName)
    await Promise.all([
      updateSession(phone, {
        state: 'awaiting_web_checkout',
        selected_item_id: null,
        quantity: null,
        region: null,
        city: null,
        address: null,
        customer_name: customerName,
        total: null,
        draft_order_id: null,
      }),
      sendWhatsAppCtaUrl(phone, WEB_CHECKOUT_MESSAGE, WEB_CHECKOUT_CTA_LABEL, storeUrl),
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
  await beginNewMachineColorSelection(phone, product)
}

async function sendNewMachineColorList(phone: string): Promise<void> {
  await sendWhatsAppList(
    phone,
    NEW_MACHINE_COLOR_PROMPT,
    'Select color',
    NEW_MACHINE_COLOR_OPTIONS.map(option => ({
      id: option.id,
      title: option.title,
    })),
    'Colors'
  )
}

async function beginNewMachineColorSelection(phone: string, product: SodamaxProduct): Promise<void> {
  await Promise.all([
    updateSession(phone, {
      state: 'awaiting_color_selection',
      selected_item_id: product.id,
      quantity: null,
      city: null,
      address: null,
      customer_name: null,
      total: null,
      draft_order_id: null,
    }),
    sendNewMachineColorList(phone),
  ])
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
  await Promise.all([
    updateSession(phone, {
      state: 'awaiting_color_selection',
      selected_item_id: product.id,
      quantity: 0,
      city: null,
      address: null,
      customer_name: null,
      total: null,
      draft_order_id: null,
    }),
    sendColorPrompt(phone, product, 0),
  ])
}

async function proceedToQuantityAfterColor(
  phone: string,
  product: SodamaxProduct,
  colorName: string
): Promise<void> {
  await Promise.all([
    updateSession(phone, {
      state: 'awaiting_quantity',
      selected_item_id: product.id,
      address: colorName,
      quantity: null,
      city: null,
      customer_name: null,
      total: null,
      draft_order_id: null,
    }),
    askQuantity(phone, product.id),
  ])
}

async function handleProductSelection(phone: string, input: MessageInput): Promise<void> {
  const listPage = parseProductListPage(input)
  if (listPage !== null) {
    await sendSodamaxProductList(phone, listPage)
    return
  }

  const productId = parseProductSelection(input)
  if (!productId) {
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
  if (!product) {
    await sendProcessError(phone)
    return
  }

  if (await isNewMachineProductId(session.selected_item_id)) {
    const colorName = parseNewMachineColorSelection(input)
    if (!colorName) {
      await sendWhatsAppText(phone, 'Please select a color from the list below.')
      await sendNewMachineColorList(phone)
      return
    }
    await proceedToQuantityAfterColor(phone, product, colorName)
    return
  }

  if (product.colors.length === 0) {
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
    await startProductOrder(phone, product, color.color_name)
    return
  }

  if (isColorNoAnswer(input)) {
    const nextIndex = colorIndex + 1
    if (nextIndex >= product.colors.length) {
      await Promise.all([
        sendWhatsAppText(phone, 'That was the last color. Please tap *Yes* on your preferred color.'),
        updateSession(phone, { quantity: 0 }, { previous: session }),
        sendColorPrompt(phone, product, 0),
      ])
      return
    }
    await Promise.all([
      updateSession(phone, { quantity: nextIndex }, { previous: session }),
      sendColorPrompt(phone, product, nextIndex),
    ])
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

  await Promise.all([
    updateSession(phone, {
      state: 'awaiting_order_decision',
      selected_item_id: product.id,
      address: colorName,
      quantity: null,
      city: null,
      customer_name: null,
      total: null,
      draft_order_id: null,
    }),
    sendOrderDecisionButtons(phone),
  ])
}

async function sendProductContent(
  phone: string,
  product: SodamaxProduct,
  colorName: string | null
): Promise<void> {
  const displayProduct = await resolveSodamaxProductWithImage(product)
  let imageSent = false

  if (displayProduct.image_base64) {
    try {
      let mediaId = getCachedMediaId(displayProduct.id)
      if (!mediaId) {
        const { buffer, mimeType } = base64ToBuffer(displayProduct.image_base64)
        mediaId = await uploadWhatsAppMedia(buffer, mimeType)
        setCachedMediaId(displayProduct.id, mediaId)
      }
      await sendWhatsAppImage(phone, mediaId)
      imageSent = true
    } catch (err) {
      if (isWhatsAppAuthError(err)) throw err
      console.error('SodaMax product image failed:', err)
    }
  }

  const description = displayProduct.description?.trim()
  if (description) {
    await sendWhatsAppText(phone, description)
  } else {
    const lines = [`*${getSodamaxProductLabel(displayProduct)}*`]
    if (colorName) lines.push(`Color: ${colorName}`)
    if (displayProduct.price > 0) lines.push(formatTotal(displayProduct.price))
    await sendWhatsAppText(phone, lines.join('\n'))
  }

  if (!imageSent && !description && !colorName && displayProduct.price <= 0) {
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
      QUANTITY_LIST_HEADER,
      'Select quantity',
      QUANTITY_OPTIONS.map(opt => ({
        id: opt.id.replace('qty_', 'sm_qty_'),
        title: opt.label,
      }))
    ),
  ])
}

async function handleQuantity(
  phone: string,
  session: SodamaxSession,
  input: MessageInput,
  profileName?: string
): Promise<void> {
  const selection = parseQuantitySelection(input)

  if (selection === null) {
    await sendWhatsAppText(phone, 'Please select a quantity from the list (1, 2, or 3).')
    await askQuantity(phone, session.selected_item_id)
    return
  }

  await proceedAfterQuantity(phone, session, selection, profileName)
}

async function handleQuantityCustom(
  phone: string,
  session: SodamaxSession,
  input: MessageInput,
  profileName?: string
): Promise<void> {
  await updateSession(phone, { state: 'awaiting_quantity' })
  await handleQuantity(phone, session, input, profileName)
}

function resolveCustomerName(
  profileName?: string,
  session?: Pick<SodamaxSession, 'customer_name'>
): string | null {
  return parseProfileName(profileName) ?? parseProfileName(session?.customer_name ?? null)
}

async function proceedAfterQuantity(
  phone: string,
  session: SodamaxSession,
  qty: number,
  profileName?: string
): Promise<void> {
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

  await proceedAfterQuantityWithDraft(phone, session, qty, total, profileName)
}

async function proceedAfterQuantityWithDraft(
  phone: string,
  session: SodamaxSession,
  qty: number,
  total: number,
  profileName?: string
): Promise<void> {
  const product = session.selected_item_id
    ? await findSodamaxProductById(session.selected_item_id)
    : null

  if (!product) {
    await sendProcessError(phone)
    return
  }

  let productName = getSodamaxProductLabel(product)
  if (session.address) productName += ` (${session.address})`

  const customerName = resolveCustomerName(profileName, session)

  const draftResult = await createDraftOrder({
    company: 'sodamax',
    customer_phone_number: phone,
    ...(customerName ? { customer_name: customerName } : {}),
    city: '—',
    address: '—',
    total,
    items: [
      {
        item_id: session.selected_item_id,
        product_name: productName,
        color_name: session.address,
        quantity: qty,
        unit_price: product.price,
        line_total: total,
      },
    ],
  })

  if (!draftResult.success || !draftResult.orderId) {
    await sendProcessError(phone)
    return
  }

  await Promise.all([
    updateSession(phone, {
      state: 'awaiting_delivery_address',
      quantity: qty,
      total,
      draft_order_id: draftResult.orderId,
      city: null,
      ...(customerName ? { customer_name: customerName } : {}),
    }),
    sendDeliveryAddressPrompt(phone),
  ])
}

async function handleDeliveryAddress(
  phone: string,
  session: SodamaxSession,
  input: MessageInput,
  profileName?: string
): Promise<void> {
  if (input.type !== 'text') {
    await sendDeliveryAddressPrompt(phone)
    return
  }

  const deliveryAddress = parseAddress(input)
  if (!deliveryAddress) {
    await sendWhatsAppText(
      phone,
      'Please enter a valid delivery address (at least 5 characters).'
    )
    return
  }

  if (!session.draft_order_id) {
    await sendProcessError(phone)
    return
  }

  await proceedToConfirmWithProfileName(phone, session, deliveryAddress, profileName)
}

async function handleWebCheckout(phone: string, input: MessageInput, profileName?: string): Promise<void> {
  const orderRef = parseOrderRef(input)
  if (orderRef) {
    await resumeFromWebDraftOrder(phone, orderRef)
    return
  }

  const menuSelection = parseMenuSelection(input)
  if (menuSelection === 'sm_show_menu') {
    await sendMainMenu(phone)
    return
  }

  if (menuSelection && menuSelection !== 'sm_order_product') {
    await handleMenuSelection(phone, input, profileName)
    return
  }

  const customerName = parseProfileName(profileName)

  await sendWhatsAppCtaUrl(
    phone,
    WEB_CHECKOUT_MESSAGE,
    WEB_CHECKOUT_CTA_LABEL,
    buildOrderPlatformUrl(phone, customerName)
  )
}

function countWebOrderItems(order: WhatsAppBotOrder): number {
  return order.items
    .filter(
      item =>
        item.quantity > 0 &&
        !item.product_name.includes('Delivery fee') &&
        !item.product_name.includes('Gift card discount')
    )
    .reduce((sum, item) => sum + item.quantity, 0)
}

function formatWebOrderItemLines(order: WhatsAppBotOrder): string[] {
  return order.items
    .filter(
      item =>
        item.quantity > 0 &&
        !item.product_name.includes('Delivery fee') &&
        !item.product_name.includes('Gift card discount')
    )
    .map(item => formatOrderItemLineWithPrice(item))
}

async function resumeFromWebDraftOrder(phone: string, orderRef: string): Promise<void> {
  const order = await getDraftOrderByRef(orderRef, phone, 'sodamax')
  if (!order) {
    await sendWhatsAppText(
      phone,
      'We could not find that order. Please check the reference and try again, or tap *Open store* to start a new order.'
    )
    await sendWhatsAppCtaUrl(
      phone,
      WEB_CHECKOUT_MESSAGE,
      WEB_CHECKOUT_CTA_LABEL,
      buildOrderPlatformUrl(phone)
    )
    return
  }

  const customerName = order.customer_name?.trim()
  if (!customerName || customerName === '—') {
    await Promise.all([
      updateSession(phone, {
        state: 'awaiting_customer_name',
        draft_order_id: order.id,
        selected_item_id: null,
        quantity: countWebOrderItems(order) || 1,
        city: order.city,
        address: order.address,
        total: order.total,
      }),
      sendWhatsAppText(phone, 'What is your full name?'),
    ])
    return
  }

  const cityIdPatch = await buildCityIdPatch('sodamax', order.city, null)

  const patchResult = await patchDraftOrder(order.id, {
    company: 'sodamax',
    customer_name: customerName,
    ...cityIdPatch,
  })

  if (!patchResult.success) {
    console.error('patchDraftOrder failed:', patchResult.error)
    await sendProcessError(phone)
    return
  }

  const itemQty = countWebOrderItems(order) || 1

  await Promise.all([
    updateSession(phone, {
      state: 'awaiting_confirm',
      draft_order_id: order.id,
      selected_item_id: null,
      quantity: itemQty,
      city: order.city,
      address: order.address,
      customer_name: customerName,
      total: order.total,
    }),
    sendWebOrderSummary(phone, order),
  ])
}

async function startFromAdLink(phone: string, itemId: string): Promise<void> {
  const product = await findSodamaxProductById(itemId)
  if (!product) {
    await sendMainMenu(phone)
    return
  }

  if (product.colors.length > 0) {
    await beginColorSelection(phone, product)
    return
  }

  await startProductOrder(phone, product, null)
}

async function handleNotesInput(
  phone: string,
  session: SodamaxSession,
  input: MessageInput
): Promise<void> {
  if (!session.draft_order_id) {
    await sendProcessError(phone)
    return
  }

  if (isSkipNotesAnswer(input, SODAMAX_SKIP_NOTES_BUTTON.id)) {
    await finishOrderNotes(phone, session, null)
    return
  }

  const notes = parseOrderNotesText(input)
  if (!notes) {
    await sendOrderNotesPrompt(phone, SODAMAX_SKIP_NOTES_BUTTON)
    return
  }

  await finishOrderNotes(phone, session, notes)
}

async function finishOrderNotes(
  phone: string,
  session: SodamaxSession,
  notes: string | null
): Promise<void> {
  if (!session.draft_order_id) {
    await sendProcessError(phone)
    return
  }

  const saveResult = await saveDraftOrderNotes(session.draft_order_id, notes, 'sodamax')

  if (!saveResult.success) {
    console.error('saveDraftOrderNotes failed:', saveResult.error)
    await sendProcessError(phone)
    return
  }

  const updated = { ...session, state: 'awaiting_confirm' as const }
  await Promise.all([
    updateSession(phone, { state: 'awaiting_confirm' }),
    sendOrderSummary(phone, updated, notes ? 'Notes saved.' : 'No notes added.'),
  ])
}

async function promptForOrderNotes(phone: string): Promise<void> {
  await Promise.all([
    updateSession(phone, { state: 'awaiting_notes' }),
    sendOrderNotesPrompt(phone, SODAMAX_SKIP_NOTES_BUTTON),
  ])
}

function buildSodamaxSummaryButtons(): { id: string; title: string }[] {
  return [
    { id: 'sm_confirm_yes', title: 'Confirm order' },
    { id: 'sm_add_notes', title: 'Add notes' },
  ]
}

async function sendWebOrderSummary(phone: string, order: WhatsAppBotOrder): Promise<void> {
  const itemLines = formatWebOrderItemLines(order)
  const summary = buildWebOrderSummaryLines({
    orderRef: order.order_ref,
    customerName: displayOrderCustomerName(order),
    address: order.address,
    city: order.city,
    itemLines,
    notesLines: formatNotesSummaryLines(order.notes),
    totalFormatted: formatOrderTotal(order.total),
  }).join('\n')

  await sendWhatsAppButtons(phone, summary, buildSodamaxSummaryButtons())
}

async function proceedToConfirmWithProfileName(
  phone: string,
  session: SodamaxSession,
  deliveryAddress: string,
  profileName?: string,
  fallbackInput?: MessageInput
): Promise<void> {
  const customerName =
    resolveCustomerName(profileName, session) ??
    (fallbackInput ? parseCustomerName(fallbackInput) : null)

  if (!customerName) {
    await Promise.all([
      updateSession(phone, {
        state: 'awaiting_customer_name',
        city: deliveryAddress,
      }),
      sendWhatsAppText(phone, 'What is your full name?'),
    ])
    return
  }

  if (!session.draft_order_id) {
    await sendProcessError(phone)
    return
  }

  const cityIdPatch = await buildCityIdPatch('sodamax', deliveryAddress, session.region)

  const patchResult = await patchDraftOrder(session.draft_order_id, {
    company: 'sodamax',
    city: deliveryAddress,
    customer_name: customerName,
    ...cityIdPatch,
  })

  if (!patchResult.success) {
    console.error('patchDraftOrder failed:', patchResult.error)
    await sendProcessError(phone)
    return
  }

  const updated = { ...session, city: deliveryAddress, customer_name: customerName }
  await Promise.all([
    updateSession(phone, {
      state: 'awaiting_confirm',
      city: deliveryAddress,
      customer_name: customerName,
    }),
    sendOrderSummary(phone, updated),
  ])
}

async function sendOrderSummary(
  phone: string,
  session: SodamaxSession,
  preamble?: string
): Promise<void> {
  if (!session.selected_item_id && session.draft_order_id) {
    const order = await getDraftOrderById(session.draft_order_id, 'sodamax')
    if (order) {
      const itemLines = formatWebOrderItemLines(order)
      const summary = [
        preamble,
        ...buildWebOrderSummaryLines({
          orderRef: order.order_ref,
          customerName: displayOrderCustomerName(order),
          address: order.address,
          city: order.city,
          itemLines,
          notesLines: formatNotesSummaryLines(order.notes),
          totalFormatted: formatOrderTotal(order.total),
        }),
      ]
        .filter(Boolean)
        .join('\n')
      await sendWhatsAppButtons(phone, summary, buildSodamaxSummaryButtons())
      return
    }
  }

  const product = session.selected_item_id
    ? await findSodamaxProductById(session.selected_item_id)
    : null
  const labelSuffix = session.address ? ` (${session.address})` : undefined
  const productLine =
    session.selected_item_id && session.quantity
      ? await formatBotItemLineWithPrice(
          session.selected_item_id,
          session.quantity,
          product ? { product_name: product.name, price: product.price } : null,
          labelSuffix
        )
      : '• —'

  const notes = await fetchDraftOrderNotes(session.draft_order_id, 'sodamax')
  const summary = [
    preamble,
    ...buildSimpleOrderSummaryLines({
      customerName: session.customer_name ?? '—',
      productLines: [productLine],
      deliveryAddress: session.city ?? '—',
      notesLines: formatNotesSummaryLines(notes),
      totalFormatted: session.total != null ? formatTotal(session.total) : '—',
    }),
  ]
    .filter(Boolean)
    .join('\n')

  await sendWhatsAppButtons(phone, summary, buildSodamaxSummaryButtons())
}

async function handleConfirm(phone: string, session: SodamaxSession, input: MessageInput): Promise<void> {
  if (isAddNotesAnswer(input)) {
    await promptForOrderNotes(phone)
    return
  }

  if (!isYesAnswer(input)) {
    await sendWhatsAppText(phone, 'Please tap *Confirm order* or *Add notes*.')
    await sendOrderSummary(phone, session)
    return
  }

  const isWebCheckout = !session.selected_item_id

  if (
    !session.draft_order_id ||
    !session.customer_name ||
    !session.city ||
    session.total === null ||
    (!isWebCheckout && (!session.quantity || !session.selected_item_id))
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
    const confirmedOrderId = session.draft_order_id
    await sendOrderThankYouWithOtherQuery(
      phone,
      result.orderRef ?? '—',
      session.total,
      { id: 'sm_other_query', title: OTHER_QUERY_BUTTON_TITLE }
    )
    await resetSession(phone)
    void scheduleSodamaxFlavourPromo(phone, confirmedOrderId).catch(err =>
      console.error('scheduleSodamaxFlavourPromo failed:', err)
    )
    return
  }

  await sendProcessError(phone)
}
