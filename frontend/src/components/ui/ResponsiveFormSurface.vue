<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import ResponsiveSheet from './ResponsiveSheet.vue'
import { useMediaQuery } from '@/lib/use-media-query'

const props = withDefaults(
  defineProps<{
    open: boolean
    eyebrow: string
    title: string
    description: string
    closeLabel?: string
  }>(),
  {
    closeLabel: 'Close form',
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isPhone = useMediaQuery('(max-width: 767px)')
const isDesktopSurface = computed(() => props.open && !isPhone.value)

function updateOpen(value: boolean) {
  emit('update:open', value)
}
</script>

<template>
  <ResponsiveSheet
    v-if="isPhone"
    :open="open"
    :title="title"
    :description="description"
    :close-label="closeLabel"
    @update:open="updateOpen"
  >
    <slot />
  </ResponsiveSheet>

  <section
    v-else-if="isDesktopSurface"
    class="relative min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-card"
  >
    <span class="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />

    <header
      class="flex min-w-0 items-start gap-3 border-b border-line bg-surface-raised px-5 py-4 sm:px-6"
    >
      <span
        class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"
      >
        <slot name="icon" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          {{ eyebrow }}
        </p>
        <h2
          class="font-display mt-0.5 break-words text-lg font-semibold tracking-[-0.02em] text-ink"
        >
          {{ title }}
        </h2>
        <p class="break-words text-xs text-ink-muted">{{ description }}</p>
      </div>
      <button
        type="button"
        class="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        :aria-label="closeLabel"
        :title="closeLabel"
        @click="updateOpen(false)"
      >
        <X :size="18" aria-hidden="true" />
      </button>
    </header>

    <div class="p-5 sm:p-6">
      <slot />
    </div>
  </section>
</template>
