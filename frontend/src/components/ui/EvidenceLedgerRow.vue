<script setup lang="ts">
type EvidenceTone = 'evidence' | 'neutral' | 'settled'

withDefaults(
  defineProps<{
    tone?: EvidenceTone
    continues?: boolean
  }>(),
  {
    tone: 'neutral',
    continues: false,
  },
)
</script>

<template>
  <article class="grid min-w-0 grid-cols-[0.75rem_minmax(0,1fr)] gap-3 py-4 first:pt-0">
    <div class="relative flex justify-center" aria-hidden="true">
      <span
        class="mt-1.5 size-2 shrink-0 rounded-full ring-4 ring-surface"
        :class="{
          'bg-evidence': tone === 'evidence',
          'bg-line-strong': tone === 'neutral',
          'bg-success': tone === 'settled',
        }"
      />
      <span v-if="continues" class="ledger-rule absolute bottom-[-1rem] top-4 w-px border-l" />
    </div>

    <div class="min-w-0">
      <div
        class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
      >
        <div class="min-w-0">
          <slot name="title" />
        </div>
        <div v-if="$slots.amount" class="self-end shrink-0 text-right sm:self-auto">
          <slot name="amount" />
        </div>
      </div>

      <div v-if="$slots.metadata" class="mt-1.5 min-w-0 text-xs leading-5 text-ink-muted">
        <slot name="metadata" />
      </div>
      <div v-if="$slots.annotation" class="mt-2 min-w-0 text-sm leading-6 text-ink-muted">
        <slot name="annotation" />
      </div>
      <div v-if="$slots.actions" class="mt-3 flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </article>
</template>
