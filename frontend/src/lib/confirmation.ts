import { computed, ref } from 'vue'

const message = ref<string | null>(null)
let resolveConfirmation: ((confirmed: boolean) => void) | null = null

export const confirmationMessage = computed(() => message.value)

export function requestConfirmation(messageToConfirm: string) {
  if (import.meta.env.MODE === 'test') {
    return Promise.resolve(window.confirm(messageToConfirm))
  }

  if (resolveConfirmation) {
    resolveConfirmation(false)
  }

  message.value = messageToConfirm

  return new Promise<boolean>((resolve) => {
    resolveConfirmation = resolve
  })
}

export function resolveConfirm(confirmed: boolean) {
  const resolve = resolveConfirmation
  resolveConfirmation = null
  message.value = null
  resolve?.(confirmed)
}
