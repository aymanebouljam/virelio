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
    class="mx-auto grid w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-surface shadow-lifted lg:max-w-5xl lg:grid-cols-[0.95fr_1.05fr]"
  >
    <aside
      aria-label="Account benefits"
      class="relative hidden flex-col bg-brand-strong px-6 py-8 text-white sm:px-8 lg:flex lg:min-h-[620px] lg:p-10"
    >
      <div aria-label="Virelio brand" class="flex items-center gap-3">
        <span class="flex size-9 items-center justify-center rounded-lg bg-surface shadow-card">
          <img src="/logo-mark.svg" alt="" class="size-9" />
        </span>
        <span>
          <span class="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            Evidence ledger
          </span>
          <span
            class="font-display mt-0.5 block text-xl font-semibold tracking-[-0.025em] text-white"
          >
            Virelio
          </span>
        </span>
      </div>

      <div class="mt-12 lg:mt-16">
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {{ panelEyebrow }}
        </p>
        <h1
          class="font-display mt-3 max-w-md text-[2rem] font-semibold leading-[1.12] tracking-[-0.035em] text-white sm:text-[2.5rem]"
        >
          {{ panelTitle }}
        </h1>
        <p class="mt-4 max-w-md text-sm leading-6 text-white/65 sm:text-[15px]">
          {{ panelDescription }}
        </p>
      </div>

      <ul
        class="relative mt-9 space-y-5 border-l border-white/15 pl-5 text-sm text-white/70 lg:mt-auto"
      >
        <li v-for="benefit in benefits" :key="benefit" class="relative leading-5">
          <span
            class="absolute -left-[23px] top-1.5 size-1 rounded-sm bg-accent"
            aria-hidden="true"
          />
          {{ benefit }}
        </li>
      </ul>
    </aside>

    <div class="flex flex-col justify-center px-6 py-8 sm:p-10 lg:px-12 lg:py-14">
      <div data-auth-compact-brand class="mb-7 flex items-center gap-3 lg:hidden">
        <span class="flex size-12 items-center justify-center rounded-lg">
          <img src="/logo-mark.svg" alt="" class="size-12" />
        </span>
        <span>
          <span class="block text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
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
          class="font-display mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-ink"
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
