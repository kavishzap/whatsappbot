import { sendWhatsAppButtons } from '@/lib/whatsapp'
import { WELCOME_MENU_MESSAGE, MAIN_MENU_BUTTONS } from '@/lib/spark/constants'
import {
  WELCOME_MENU_MESSAGE as SODAMAX_WELCOME_MENU_MESSAGE,
  MAIN_MENU_BUTTONS as SODAMAX_MAIN_MENU_BUTTONS,
} from '@/lib/sodamax/constants'
import type { WhatsAppLine } from '@/lib/whatsapp-line'

export async function sendWelcomeMenu(phone: string, line: WhatsAppLine): Promise<void> {
  if (line === 'sodamax') {
    await sendWhatsAppButtons(
      phone,
      SODAMAX_WELCOME_MENU_MESSAGE,
      SODAMAX_MAIN_MENU_BUTTONS.map(opt => ({ id: opt.id, title: opt.title }))
    )
    return
  }

  await sendWhatsAppButtons(
    phone,
    WELCOME_MENU_MESSAGE,
    MAIN_MENU_BUTTONS.map(opt => ({ id: opt.id, title: opt.title }))
  )
}
