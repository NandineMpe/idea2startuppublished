type ConvaiWidgetElement = HTMLElement & {
  startConversation?: () => void
  endConversation?: () => void
}

let widgetEl: ConvaiWidgetElement | null = null

export function registerCareerConvaiWidget(el: ConvaiWidgetElement | null) {
  widgetEl = el
}

export function startCareerConvaiConversation() {
  widgetEl?.startConversation?.()
}

export function endCareerConvaiConversation() {
  widgetEl?.endConversation?.()
}
