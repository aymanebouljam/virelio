import { onMounted, onUnmounted, ref } from 'vue'

export function useMediaQuery(query: string) {
  const matches = ref(false)
  let mediaQuery: MediaQueryList | null = null

  const update = () => {
    matches.value = mediaQuery?.matches ?? false
  }

  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return
    }

    mediaQuery = window.matchMedia(query)
    update()
    mediaQuery.addEventListener('change', update)
  })

  onUnmounted(() => {
    if (!mediaQuery) return

    mediaQuery.removeEventListener('change', update)
  })

  return matches
}
