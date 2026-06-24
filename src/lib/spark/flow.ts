import {
  sendWhatsAppText,
  sendWhatsAppButtons,
  sendWhatsAppImage,
  sendWhatsAppCtaUrl,
  uploadWhatsAppMedia,
  base64ToBuffer,
  isWhatsAppAuthError,
} from '@/lib/whatsapp'
import { loadSession, updateSession, resetSession } from './session'
import {
  findItemByLink,
  findItemByReferral,
  findItemById,
  resolveItemWithImage,
  listAllItems,
} from './products'
import { createDraftOrder, completeDraftOrder, updateDraftOrder, patchDraftOrder } from './orders'
import {
  buildOrderLinePayload,
  buildOrderLinesFromCart,
  computeLinesTotal,
  sessionCartRow,
} from './cart'
import { sendOrderSummary } from './order-summary'
import { sendOrderThankYouWithOtherQuery } from '@/lib/order-thank-you'
import {
  extractMessageInput,
  isYesAnswer,
  isSeeMoreAnswer,
  isAddMoreProductAnswer,
  isBackToSummaryAnswer,
  isRemoveLastItemAnswer,
  isAddNotesAnswer,
  parseProductSelection,
  parseProductListPage,
  parseQuantitySelection,
  parseAddress,
  parseProfileName,
  parseCustomerName,
  parseMenuSelection,
} from './parse-input'
import { sendProductList } from './product-list'
import { sendQuantityList } from './quantity-list'
import { sendDeliveryAddressPrompt } from './regions'
import {
  MAIN_MENU_BUTTONS,
  WELCOME_MENU_MESSAGE,
  OTHER_QUERY_MESSAGE,
  OTHER_QUERY_CTA_LABEL,
  OTHER_QUERY_BUTTON_TITLE,
  SUPPORT_WHATSAPP_URL,
  computeOrderTotal,
  PROCESS_ERROR_MESSAGE,
} from './constants'
import { getCachedMediaId, setCachedMediaId } from './media-cache'
import { sendProcessErrorWithSupport } from './process-error'
import { buildCityIdPatch } from './match-city'
import { parseOrderNotesText, saveDraftOrderNotes, sendOrderNotesPrompt, SPARK_SKIP_NOTES_BUTTON, isSkipNotesAnswer } from './order-notes'
import type { BotItem, IncomingWhatsAppMessage, MessageInput, WhatsAppSession } from './types'
import { isAddMoreCheckoutReady } from './types'

function mergeLocalSession(
  session: WhatsAppSession,
  updates: Partial<Omit<WhatsAppSession, 'phone' | 'updated_at'>>
): WhatsAppSession {
  return { ...session, ...updates, updated_at: new Date().toISOString() }
}

/** Persist session without blocking the WhatsApp reply on the DB round-trip. */
function persistSession(
  phone: string,
  session: WhatsAppSession,
  updates: Partial<Omit<WhatsAppSession, 'phone' | 'updated_at'>>,
  options?: { includeCart?: boolean }
): WhatsAppSession {
  const merged = mergeLocalSession(session, updates)
  void updateSession(phone, updates, {
    previous: session,
    includeCart: options?.includeCart,
  }).catch(err => console.error('Session persist failed:', err))
  return merged
}

async function applyCityMatchToDraft(
  orderId: string,
  deliveryAddress: string,
  region?: string | null
): Promise<void> {
  try {
    const cityIdPatch = await buildCityIdPatch('spark', deliveryAddress, region)
    if (cityIdPatch.city_id) {
      await patchDraftOrder(orderId, { company: 'spark', ...cityIdPatch })
    }
  } catch (err) {
    console.error('Deferred city match failed:', err)
  }
}

async function sendProcessError(phone: string, reset = true): Promise<void> {
  await sendProcessErrorWithSupport(phone, {
    message: PROCESS_ERROR_MESSAGE,
    ctaLabel: OTHER_QUERY_CTA_LABEL,
    supportUrl: SUPPORT_WHATSAPP_URL,
    reset: reset ? () => resetSession(phone) : undefined,
    logLabel: 'Spark',
  })
}

export async function handleChatbotMessage(message: IncomingWhatsAppMessage): Promise<void> {
  const phone = message.from
  const input = extractMessageInput(message)
  const hasReferral = Boolean(message.referral?.source_id || message.referral?.source_url)

  if (!input.value && input.type === 'text' && !hasReferral) {
    return
  }

  let session: WhatsAppSession

  try {
    session = await loadSession(phone)
  } catch (err) {
    console.error('Session load failed:', err)
    await sendProcessError(phone)
    return
  }

  try {
    if (message.referral) {
      const item = await findItemByReferral(message.referral, 'spark')
      if (item) {
        if (session.state !== 'idle') {
          void resetSession(phone).catch(err => console.error('resetSession failed:', err))
        }
        await sendProductAndStartOrder(phone, item)
        return
      }
    }

    if (input.type === 'text' && input.value) {
      const item = await findItemByLink(input.value, 'spark')
      if (item) {
        if (session.state !== 'idle') {
          void resetSession(phone).catch(err => console.error('resetSession failed:', err))
        }
        await sendProductAndStartOrder(phone, item)
        return
      }
    }

    if (session.state !== 'idle') {
      await handleActiveSession(phone, session, input, message.profile_name)
      return
    }

    const menuSelection = parseMenuSelection(input)
    if (menuSelection === 'menu_other_query') {
      await sendWhatsAppCtaUrl(
        phone,
        OTHER_QUERY_MESSAGE,
        OTHER_QUERY_CTA_LABEL,
        SUPPORT_WHATSAPP_URL
      )
      return
    }
    if (menuSelection === 'menu_order_product') {
      await sendProductList(phone)
      void updateSession(phone, { state: 'awaiting_product_selection' }).catch(err =>
        console.error('Session persist failed:', err)
      )
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
  await sendOrderDecisionButtons(phone)
  void updateSession(phone, {
    state: 'awaiting_order_decision',
    selected_item_id: item.id,
    quantity: null,
    region: null,
    city: null,
    address: null,
    customer_name: null,
    total: null,
    draft_order_id: null,
    cart_items: [],
  }).catch(err => console.error('Session update failed after sending product:', err))
}

async function sendProductContent(phone: string, item: BotItem): Promise<void> {
  const displayItem = await resolveItemWithImage(item)
  const description = displayItem.description?.trim() ?? ''
  const productName = displayItem.product_name?.trim()
  let imageSent = false

  if (displayItem.image_base64) {
    try {
      let mediaId = getCachedMediaId(displayItem.id)
      if (!mediaId) {
        const { buffer, mimeType } = base64ToBuffer(displayItem.image_base64)
        mediaId = await uploadWhatsAppMedia(buffer, mimeType)
        setCachedMediaId(displayItem.id, mediaId)
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
  input: MessageInput,
  profileName?: string
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
    case 'awaiting_add_more_product':
      await handleAddMoreProductSelection(phone, session, input)
      break
    case 'awaiting_quantity':
      await handleQuantity(phone, session, input, profileName)
      break
    case 'awaiting_quantity_custom':
      await handleQuantityCustom(phone, session, input, profileName)
      break
    case 'awaiting_region':
      if (session.selected_item_id && session.quantity) {
        const item = await findItemById(session.selected_item_id)
        await proceedAfterQuantityWithDraft(
          phone,
          session,
          session.quantity,
          profileName,
          item
        )
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
    default:
      await resetSession(phone)
  }
}

async function sendMainMenu(phone: string): Promise<void> {
  void listAllItems().catch(() => {})
  await sendWhatsAppButtons(
    phone,
    WELCOME_MENU_MESSAGE,
    MAIN_MENU_BUTTONS.map(opt => ({ id: opt.id, title: opt.title }))
  )
  void updateSession(phone, {
    state: 'awaiting_menu_selection',
    selected_item_id: null,
    quantity: null,
    region: null,
    city: null,
    address: null,
    customer_name: null,
    total: null,
    draft_order_id: null,
    cart_items: [],
  }).catch(err => console.error('Session persist failed:', err))
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
    await sendProductList(phone)
    void updateSession(phone, { state: 'awaiting_product_selection' }).catch(err =>
      console.error('Session persist failed:', err)
    )
    return
  }

  if (selection === 'menu_other_query') {
    void resetSession(phone).catch(err => console.error('resetSession failed:', err))
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
    await sendProductList(phone)
    void updateSession(phone, { state: 'awaiting_product_selection' }).catch(err =>
      console.error('Session persist failed:', err)
    )
    return
  }

  await sendOrderDecisionButtons(
    phone,
    'Please tap *Yes* to order this product, or *See more products* to browse the catalog.'
  )
}

async function sendOrderDecisionButtons(phone: string, body?: string): Promise<void> {
  await sendWhatsAppButtons(phone, body ?? 'Do you want to order this product?', [
    { id: 'order_yes', title: 'Yes' },
    { id: 'order_see_more', title: 'See more products' },
  ])
}

async function sendQuantityListForSession(phone: string, session: WhatsAppSession): Promise<void> {
  await sendQuantityList(phone, { showBackToSummary: isAddMoreCheckoutReady(session) })
}

async function proceedAfterQuantity(
  phone: string,
  session: WhatsAppSession,
  qty: number,
  profileName?: string
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

  // Draft already exists → add-more loop (append to same order, not a new draft).
  if (session.draft_order_id) {
    await appendCartItemAndUpdateDraft(phone, session, qty, item)
    return
  }

  await proceedAfterQuantityWithDraft(phone, session, qty, profileName, item)
}

function resolveCustomerName(
  profileName?: string,
  session?: Pick<WhatsAppSession, 'customer_name'>
): string | null {
  return parseProfileName(profileName) ?? parseProfileName(session?.customer_name ?? null)
}

async function proceedAfterQuantityWithDraft(
  phone: string,
  session: WhatsAppSession,
  qty: number,
  profileName?: string,
  item?: BotItem | null
): Promise<void> {
  if (!session.selected_item_id) {
    await sendProcessError(phone)
    return
  }

  const resolvedItem =
    item ?? (await findItemById(session.selected_item_id))
  const line = await buildOrderLinePayload(
    session.selected_item_id,
    qty,
    undefined,
    resolvedItem
  )
  if (!line) {
    await sendProcessError(phone)
    return
  }

  const cartItems = [
    sessionCartRow(session.selected_item_id, qty, resolvedItem),
  ]
  const total = line.line_total ?? 0

  if (total <= 0) {
    await sendProcessError(phone)
    return
  }

  const customerName = resolveCustomerName(profileName, session)

  const draftResult = await createDraftOrder({
    company: 'spark',
    customer_phone_number: phone,
    ...(customerName ? { customer_name: customerName } : {}),
    city: '—',
    address: '—',
    total,
    items: [line],
  })

  if (!draftResult.success || !draftResult.orderId) {
    console.error('Draft order failed:', draftResult.error)
    await sendProcessError(phone)
    return
  }

  await sendDeliveryAddressPrompt(phone)
  await updateSession(
    phone,
    {
      state: 'awaiting_delivery_address',
      quantity: qty,
      total,
      cart_items: cartItems,
      draft_order_id: draftResult.orderId,
      city: null,
      ...(customerName ? { customer_name: customerName } : {}),
    },
    { previous: session, includeCart: true }
  )
}

async function appendCartItemAndUpdateDraft(
  phone: string,
  session: WhatsAppSession,
  qty: number,
  item?: BotItem | null
): Promise<void> {
  if (!session.selected_item_id || !session.draft_order_id) {
    await sendProcessError(phone)
    return
  }

  const resolvedItem =
    item ?? (await findItemById(session.selected_item_id))
  const newLine = await buildOrderLinePayload(
    session.selected_item_id,
    qty,
    session.cart_items.length,
    resolvedItem
  )
  if (!newLine) {
    await sendProcessError(phone)
    return
  }

  const existingLines = await buildOrderLinesFromCart(session.cart_items)
  const allLines = [...existingLines, newLine]
  const total = computeLinesTotal(allLines)
  const cartItems = [
    ...session.cart_items,
    sessionCartRow(session.selected_item_id, qty, resolvedItem),
  ]

  const updateResult = await updateDraftOrder(session.draft_order_id, {
    company: 'spark',
    total,
    items: allLines,
  })

  if (!updateResult.success) {
    console.error('updateDraftOrder failed:', updateResult.error)
    await sendProcessError(phone)
    return
  }

  const mergedSession = mergeLocalSession(session, {
    state: 'awaiting_confirm',
    cart_items: cartItems,
    total,
    selected_item_id: null,
    quantity: null,
  })

  await sendOrderSummary(phone, mergedSession)
  await updateSession(
    phone,
    {
      state: 'awaiting_confirm',
      cart_items: cartItems,
      total,
      selected_item_id: null,
      quantity: null,
    },
    { previous: session, includeCart: true }
  )
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

async function handleAddMoreProductSelection(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  if (isBackToSummaryAnswer(input)) {
    await returnToOrderSummary(phone, session)
    return
  }

  const listPage = parseProductListPage(input)
  if (listPage !== null) {
    await sendProductList(phone, listPage, { showBackToSummary: true })
    return
  }

  const productId = parseProductSelection(input)

  if (!productId) {
    await sendProductList(phone, 0, { showBackToSummary: true })
    return
  }

  const item = await findItemById(productId)
  if (!item) {
    await sendWhatsAppText(phone, 'That product is no longer available. Please choose another.')
    await sendProductList(phone, 0, { showBackToSummary: true })
    return
  }

  await sendProductContent(phone, item)

  await sendQuantityListForSession(phone, session)
  await updateSession(
    phone,
    {
      state: 'awaiting_quantity',
      selected_item_id: item.id,
    },
    { previous: session, includeCart: true }
  )
}

async function returnToOrderSummary(phone: string, session: WhatsAppSession): Promise<void> {
  const merged = await updateSession(
    phone,
    {
      state: 'awaiting_confirm',
      selected_item_id: null,
      quantity: null,
    },
    { previous: session, includeCart: true }
  )
  await sendOrderSummary(phone, merged)
}

async function startAddMoreProduct(phone: string, session: WhatsAppSession): Promise<void> {
  await sendProductList(phone, 0, { showBackToSummary: true })
  void updateSession(
    phone,
    {
      state: 'awaiting_add_more_product',
      selected_item_id: null,
      quantity: null,
    },
    { previous: session, includeCart: true }
  ).catch(err => console.error('Session persist failed:', err))
}

async function askQuantity(phone: string, itemId: string | null): Promise<void> {
  if (!itemId) {
    await sendProcessError(phone)
    return
  }

  await sendQuantityList(phone)
  void updateSession(phone, { state: 'awaiting_quantity', selected_item_id: itemId }).catch(err =>
    console.error('Session persist failed:', err)
  )
}

async function handleQuantity(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput,
  profileName?: string
): Promise<void> {
  if (isBackToSummaryAnswer(input) && isAddMoreCheckoutReady(session)) {
    await returnToOrderSummary(phone, session)
    return
  }

  const selection = parseQuantitySelection(input)

  if (selection === null) {
    await sendQuantityListForSession(phone, session)
    return
  }

  await proceedAfterQuantity(phone, session, selection, profileName)
}

async function handleQuantityCustom(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput,
  profileName?: string
): Promise<void> {
  if (isBackToSummaryAnswer(input) && isAddMoreCheckoutReady(session)) {
    await returnToOrderSummary(phone, session)
    return
  }

  persistSession(phone, session, { state: 'awaiting_quantity' })
  await handleQuantity(phone, session, input, profileName)
}

async function handleDeliveryAddress(
  phone: string,
  session: WhatsAppSession,
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

async function proceedToConfirmWithProfileName(
  phone: string,
  session: WhatsAppSession,
  deliveryAddress: string,
  profileName?: string,
  fallbackInput?: MessageInput
): Promise<void> {
  const customerName =
    resolveCustomerName(profileName, session) ??
    (fallbackInput ? parseCustomerName(fallbackInput) : null)

  if (!customerName) {
    await sendWhatsAppText(phone, 'What is your full name?')
    persistSession(phone, session, {
      state: 'awaiting_customer_name',
      city: deliveryAddress,
    })
    return
  }

  if (!session.draft_order_id) {
    await sendProcessError(phone)
    return
  }

  const patchResult = await patchDraftOrder(session.draft_order_id, {
    company: 'spark',
    city: deliveryAddress,
    customer_name: customerName,
  })

  if (!patchResult.success) {
    console.error('patchDraftOrder failed:', patchResult.error)
    await sendProcessError(phone)
    return
  }

  const updatedSession = mergeLocalSession(session, {
    state: 'awaiting_confirm',
    city: deliveryAddress,
    customer_name: customerName,
  })

  await sendOrderSummary(phone, updatedSession)
  await updateSession(
    phone,
    {
      state: 'awaiting_confirm',
      city: deliveryAddress,
      customer_name: customerName,
    },
    { previous: session, includeCart: true }
  )

  void applyCityMatchToDraft(session.draft_order_id, deliveryAddress, session.region)
}

async function handleRemoveLastItem(phone: string, session: WhatsAppSession): Promise<void> {
  const cartItems = session.cart_items ?? []

  if (cartItems.length <= 1) {
    await sendWhatsAppText(phone, 'Your order must include at least one product.')
    await sendOrderSummary(phone, session)
    return
  }

  if (!session.draft_order_id) {
    await sendProcessError(phone)
    return
  }

  const nextCart = cartItems.slice(0, -1)
  const lines = await buildOrderLinesFromCart(nextCart)
  if (lines.length === 0) {
    await sendProcessError(phone)
    return
  }

  const total = computeLinesTotal(lines)
  const updateResult = await updateDraftOrder(session.draft_order_id, {
    company: 'spark',
    total,
    items: lines,
  })

  if (!updateResult.success) {
    console.error('updateDraftOrder failed:', updateResult.error)
    await sendProcessError(phone)
    return
  }

  const mergedSession = mergeLocalSession(session, {
    cart_items: nextCart,
    total,
    selected_item_id: null,
    quantity: null,
  })

  await sendOrderSummary(phone, mergedSession)
  await updateSession(
    phone,
    {
      cart_items: nextCart,
      total,
      selected_item_id: null,
      quantity: null,
    },
    { previous: session, includeCart: true }
  )
}

async function handleNotesInput(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  if (!session.draft_order_id) {
    await sendProcessError(phone)
    return
  }

  if (isSkipNotesAnswer(input, SPARK_SKIP_NOTES_BUTTON.id)) {
    await finishOrderNotes(phone, session, null)
    return
  }

  const notes = parseOrderNotesText(input)
  if (!notes) {
    await sendOrderNotesPrompt(phone, SPARK_SKIP_NOTES_BUTTON)
    return
  }

  await finishOrderNotes(phone, session, notes)
}

async function finishOrderNotes(
  phone: string,
  session: WhatsAppSession,
  notes: string | null
): Promise<void> {
  if (!session.draft_order_id) {
    await sendProcessError(phone)
    return
  }

  const saveResult = await saveDraftOrderNotes(session.draft_order_id, notes, 'spark')

  if (!saveResult.success) {
    console.error('saveDraftOrderNotes failed:', saveResult.error)
    await sendProcessError(phone)
    return
  }

  const updatedSession = mergeLocalSession(session, { state: 'awaiting_confirm' })
  await sendOrderSummary(
    phone,
    updatedSession,
    notes ? 'Notes saved.' : 'No notes added.'
  )
  await updateSession(phone, { state: 'awaiting_confirm' }, { previous: session, includeCart: true })
}

async function promptForOrderNotes(phone: string, session: WhatsAppSession): Promise<void> {
  await sendOrderNotesPrompt(phone, SPARK_SKIP_NOTES_BUTTON)
  await updateSession(phone, { state: 'awaiting_notes' }, { previous: session, includeCart: true })
}

async function handleConfirm(
  phone: string,
  session: WhatsAppSession,
  input: MessageInput
): Promise<void> {
  if (isAddMoreProductAnswer(input)) {
    await startAddMoreProduct(phone, session)
    return
  }

  if (isAddNotesAnswer(input)) {
    await promptForOrderNotes(phone, session)
    return
  }

  if (isRemoveLastItemAnswer(input)) {
    await handleRemoveLastItem(phone, session)
    return
  }

  if (!isYesAnswer(input)) {
    await sendOrderSummary(
      phone,
      session,
      'Please tap *Confirm order*, *Add notes*, *Add more product*, or *Remove last item*.'
    )
    return
  }

  const hasCart = (session.cart_items?.length ?? 0) > 0

  if (
    !session.draft_order_id ||
    !session.customer_name ||
    !session.city ||
    session.total === null ||
    (!hasCart && (!session.quantity || !session.selected_item_id))
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
    await sendOrderThankYouWithOtherQuery(
      phone,
      result.orderRef ?? '—',
      session.total,
      { id: 'menu_other_query', title: OTHER_QUERY_BUTTON_TITLE }
    )
    await resetSession(phone)
    return
  }

  console.error('completeDraftOrder failed:', result.error)
  await sendProcessError(phone)
}
