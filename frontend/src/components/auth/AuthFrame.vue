<script setup lang="ts">
defineProps<{
  panelEyebrow: string
  panelTitle: string
  panelDescription: string
  benefits: string[]
  formEyebrow: string
  formTitle: string
  formDescription: string
}>()
</script>

<template>
  <section
    class="mx-auto grid w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-lifted lg:max-w-4xl lg:grid-cols-[0.72fr_1.28fr]"
  >
    <aside
      aria-label="Account benefits"
      class="relative hidden flex-col border-r border-line bg-surface-raised px-8 py-10 lg:flex lg:min-h-[560px] lg:px-10"
    >
      <div aria-label="Virelio brand" class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-lg bg-surface">
          <img src="/logo-mark.svg" alt="" class="size-9" />
        </span>
        <span>
          <span class="block text-[10px] font-semibold tracking-[0.12em] text-evidence">
            Evidence ledger
          </span>
          <span
            class="font-display mt-0.5 block text-xl font-semibold tracking-[-0.025em] text-ink"
          >
            Virelio
          </span>
        </span>
      </div>

      <div class="mt-14">
        <p class="text-[11px] font-semibold tracking-[0.08em] text-evidence">
          {{ panelEyebrow }}
        </p>
        <h1
          class="font-display mt-3 max-w-sm text-[2rem] font-semibold leading-[1.12] tracking-[-0.04em] text-ink"
        >
          {{ panelTitle }}
        </h1>
        <p class="mt-4 max-w-sm text-sm leading-6 text-ink-muted">
          {{ panelDescription }}
        </p>
      </div>

      <ul
        class="relative mt-10 space-y-4 border-l border-line-strong pl-5 text-sm text-ink-muted lg:mt-auto"
      >
        <li v-for="benefit in benefits" :key="benefit" class="relative leading-5">
          <span
            class="absolute -left-[23px] top-1.5 size-1 rounded-full bg-evidence"
            aria-hidden="true"
          />
          {{ benefit }}
        </li>
      </ul>
    </aside>

    <div class="flex flex-col justify-center px-6 py-8 sm:p-10 lg:px-12 lg:py-12">
      <div data-auth-compact-brand class="mb-7 flex items-center gap-3 lg:hidden">
        <span class="flex size-12 items-center justify-center rounded-lg">
          <img src="/logo-mark.svg" alt="" class="size-12" />
        </span>
        <span>
          <span class="block text-[10px] font-semibold tracking-[0.12em] text-evidence">
            Evidence ledger
          </span>
          <span
            class="font-display mt-0.5 block text-xl font-semibold tracking-[-0.025em] text-ink"
          >
            Virelio
          </span>
        </span>
      </div>

      <header>
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          {{ formEyebrow }}
        </p>
        <h2
          class="font-display mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.04em] text-ink"
        >
          {{ formTitle }}
        </h2>
        <p class="mt-2 max-w-md text-sm leading-6 text-ink-muted">
          {{ formDescription }}
        </p>
      </header>

      <slot />

      <div class="mt-7 border-t border-line pt-5 text-center text-sm text-ink-muted">
        <slot name="footer" />
      </div>
    </div>
  </section>
</template>
