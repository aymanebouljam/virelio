<script setup lang="ts">
import type { Component } from 'vue'
import ResponsiveSheet from './ResponsiveSheet.vue'

export type RecordActionTone = 'default' | 'danger'

export interface RecordActionItem {
  id: string
  label: string
  icon?: Component
  tone?: RecordActionTone
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    open: boolean
    recordLabel: string
    actions: readonly RecordActionItem[]
  }>(),
  {},
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [id: string]
}>()

function selectAction(action: RecordActionItem) {
  if (action.disabled) return

  emit('update:open', false)
  emit('select', action.id)
}
</script>

<template>
  <ResponsiveSheet
    :open="props.open"
    :title="`Actions for ${props.recordLabel}`"
    :description="'Choose an action for this record.'"
    close-label="Close record actions"
    @update:open="emit('update:open', $event)"
  >
    <div class="-mx-1 divide-y divide-line rounded-lg border border-line">
      <button
        v-for="action in props.actions"
        :key="action.id"
        type="button"
        class="flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm font-semibold transition first:rounded-t-lg last:rounded-b-lg disabled:cursor-not-allowed disabled:opacity-55"
        :class="
          action.tone === 'danger'
            ? 'text-danger hover:bg-danger-soft'
            : 'text-ink hover:bg-surface-muted'
        "
        :disabled="action.disabled"
        @click="selectAction(action)"
      >
        <component
          :is="action.icon"
          v-if="action.icon"
          :size="18"
          :stroke-width="1.8"
          aria-hidden="true"
        />
        <span class="min-w-0 break-words">{{ action.label }}</span>
      </button>
    </div>
  </ResponsiveSheet>
</template>
