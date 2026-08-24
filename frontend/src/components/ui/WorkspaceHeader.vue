<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    context?: string
  }>(),
  {
    description: '',
    context: '',
  },
)
</script>

<template>
  <header
    class="flex min-w-0 flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="min-w-0">
      <p v-if="context" class="text-xs font-semibold tracking-[0.08em] text-evidence">
        {{ context }}
      </p>
      <h1
        class="font-display mt-2 break-words text-[2rem] font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-[2.5rem]"
      >
        {{ title }}
      </h1>
      <p
        v-if="description"
        class="mt-2 max-w-2xl break-words text-sm leading-6 text-ink-muted sm:text-[15px]"
      >
        {{ description }}
      </p>
    </div>

    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
