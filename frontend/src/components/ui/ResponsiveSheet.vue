<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { X } from '@lucide/vue'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    closeLabel?: string
  }>(),
  {
    description: '',
    closeLabel: 'Close',
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

function updateOpen(value: boolean) {
  emit('update:open', value)
}
</script>

<template>
  <DialogRoot :open="open" @update:open="updateOpen">
    <DialogOverlay
      class="fixed inset-0 z-40 bg-brand-strong/55 backdrop-blur-[2px] data-[state=closed]:animate-none"
    />
    <DialogContent
      class="fixed inset-x-3 bottom-0 z-50 flex max-h-[min(90dvh,48rem)] flex-col overflow-hidden rounded-t-2xl border-t border-line bg-surface shadow-[0_-16px_48px_rgba(31,43,66,0.2)] focus:outline-none sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-xl sm:-translate-x-1/2"
    >
      <div class="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />

      <header
        class="flex min-w-0 shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-4 sm:px-6"
      >
        <div class="min-w-0">
          <DialogTitle
            class="font-display break-words text-xl font-semibold tracking-tight text-ink"
          >
            {{ title }}
          </DialogTitle>
          <DialogDescription
            v-if="description"
            class="mt-1 break-words text-sm leading-5 text-ink-muted"
          >
            {{ description }}
          </DialogDescription>
        </div>

        <DialogClose as-child>
          <button
            type="button"
            class="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            :aria-label="closeLabel"
          >
            <X :size="19" aria-hidden="true" />
          </button>
        </DialogClose>
      </header>

      <div
        class="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6"
      >
        <slot />
      </div>
    </DialogContent>
  </DialogRoot>
</template>
