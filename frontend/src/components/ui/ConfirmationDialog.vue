<script setup lang="ts">
import { computed } from 'vue'
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { AlertTriangle } from '@lucide/vue'
import { confirmationMessage, resolveConfirm } from '@/lib/confirmation'

const open = computed(() => confirmationMessage.value !== null)

function handleOpenChange(nextOpen: boolean) {
  if (!nextOpen) {
    resolveConfirm(false)
  }
}
</script>

<template>
  <AlertDialogRoot :open="open" @update:open="handleOpenChange">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-60 bg-brand-strong/55 backdrop-blur-[2px]" />
      <AlertDialogContent
        data-confirmation-dialog
        class="fixed left-1/2 top-1/2 z-70 w-[calc(100%-2.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6 shadow-[0_24px_64px_rgba(31,43,66,0.24)] focus:outline-none"
      >
        <div class="flex gap-4">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning"
            aria-hidden="true"
          >
            <AlertTriangle :size="20" :stroke-width="1.8" />
          </span>
          <div class="min-w-0">
            <AlertDialogTitle class="font-display text-lg font-semibold tracking-tight text-ink">
              Confirm action
            </AlertDialogTitle>
            <AlertDialogDescription class="mt-1 text-sm leading-6 text-ink-muted">
              {{ confirmationMessage }}
            </AlertDialogDescription>
          </div>
        </div>

        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AlertDialogCancel as-child>
            <button
              type="button"
              class="min-h-10 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-line-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Cancel
            </button>
          </AlertDialogCancel>
          <button
            type="button"
            class="min-h-10 rounded-lg bg-danger px-4 text-sm font-semibold text-white transition hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2"
            @click="resolveConfirm(true)"
          >
            Confirm
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
