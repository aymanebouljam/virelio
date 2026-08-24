<script setup lang="ts">
import { computed } from 'vue'

type LedgerSurfaceTone = 'paper' | 'quiet' | 'featured'

const props = withDefaults(
  defineProps<{
    tone?: LedgerSurfaceTone
  }>(),
  {
    tone: 'paper',
  },
)

const toneClass = computed(() => {
  if (props.tone === 'quiet') return 'border-line bg-surface-raised'
  if (props.tone === 'featured') return 'border-brand-strong bg-brand-strong text-white'
  return 'border-line bg-surface'
})
</script>

<template>
  <section class="min-w-0 rounded-xl border shadow-card" :class="toneClass">
    <slot />
  </section>
</template>
