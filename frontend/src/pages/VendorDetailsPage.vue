<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Archive, ArrowLeft, Building2, ExternalLink, Mail, Phone } from '@lucide/vue'
import { fetchVendor, archiveVendor } from '@/lib/vendors/api'
import { ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/helpers'
import { vendorSchema, type Vendor } from '@/lib/vendors/schema'

const route = useRoute()
const router = useRouter()

const vendorId = computed(() => String(route.params.id))
const vendor = ref<Vendor | null>(null)
const loading = ref(true)
const error = ref('')
const actionError = ref('')
const archiving = ref(false)

async function loadVendor() {
  try {
    error.value = ''
    const result = vendorSchema.safeParse(await fetchVendor(vendorId.value))
    if (!result.success) {
      error.value = 'Failed to fetch vendor details'
      return
    }
    vendor.value = result.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

async function archiveCurrentVendor() {
  if (!vendor.value) {
    return
  }

  actionError.value = ''
  archiving.value = true

  try {
    if (!confirm('Are you sure you want to archive this vendor?')) {
      return
    }

    await archiveVendor(vendor.value.id)
    vendor.value = null
    await router.push({ name: 'vendorsArchived' })
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Archiving vendor failed'
  } finally {
    archiving.value = false
  }
}

function goBack() {
  router.back()
}

onMounted(loadVendor)
watch(vendorId, () => {
  vendor.value = null
  error.value = ''
  loading.value = true
  void loadVendor()
})
</script>

<template>
  <section class="min-w-0 space-y-6">
    <header class="space-y-5 border-b border-line pb-6">
      <button
        type="button"
        class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-muted transition hover:border-line-strong hover:text-ink"
        @click="goBack"
      >
        <ArrowLeft :size="15" aria-hidden="true" />
        Back
      </button>

      <div class="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Vendor dossier
          </p>
          <h1
            class="font-display mt-2 break-words text-[2rem] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[2.5rem]"
          >
            {{ vendor?.name ?? 'Vendor record' }}
          </h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-[15px]">
            Contact coordinates, working notes, and lifecycle evidence for this vendor.
          </p>
        </div>

        <button
          v-if="vendor"
          type="button"
          :disabled="archiving"
          class="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-danger-soft px-3 text-sm font-medium text-danger transition hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10 sm:w-auto sm:bg-transparent sm:text-ink-muted sm:hover:bg-danger-soft sm:hover:text-danger"
          @click="archiveCurrentVendor"
        >
          <Archive :size="15" aria-hidden="true" />
          {{ archiving ? 'Archiving...' : 'Archive vendor' }}
        </button>
      </div>
    </header>

    <div
      v-if="actionError"
      role="alert"
      class="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      {{ actionError }}
    </div>

    <section v-if="loading" class="space-y-3" role="status" aria-label="Loading vendor details">
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <div class="h-64 animate-pulse rounded-xl bg-surface-muted/70"></div>
        <div class="h-64 animate-pulse rounded-xl bg-surface-muted/70"></div>
      </div>
    </section>

    <div
      v-else-if="error"
      role="alert"
      class="rounded-xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm text-danger"
    >
      <p class="font-medium">Could not load vendor</p>
      <p class="mt-1">{{ error }}</p>
    </div>

    <div
      v-else-if="!vendor"
      class="rounded-xl border border-line bg-surface px-5 py-14 text-center shadow-card"
    >
      <span
        class="mx-auto flex size-11 items-center justify-center rounded-lg bg-surface-muted text-ink-muted"
      >
        <Building2 :size="20" aria-hidden="true" />
      </span>
      <p class="mt-3 text-sm font-semibold text-ink">Vendor not available</p>
      <p class="mt-1 text-sm text-ink-muted">
        This vendor may have been archived or is no longer available from the active list.
      </p>
    </div>

    <section v-else class="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
      <article
        data-vendor-record
        class="relative min-w-0 overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
      >
        <span class="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />
        <header class="flex min-w-0 items-start justify-between gap-3 border-b border-line pb-5">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Contact coordinates
            </p>
            <h2
              class="font-display mt-1 break-words text-lg font-semibold tracking-[-0.02em] text-ink"
            >
              Vendor directory record
            </h2>
          </div>
          <span class="shrink-0 border-l-2 border-accent pl-2 text-xs font-semibold text-accent">
            Active
          </span>
        </header>

        <dl class="mt-1 divide-y divide-line">
          <div class="grid gap-2 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
            <dt class="flex items-center gap-2 text-xs font-medium text-ink-muted">
              <Mail :size="14" aria-hidden="true" />
              Email
            </dt>
            <dd class="min-w-0 break-words text-sm text-ink">
              {{ vendor.email || 'Not provided' }}
            </dd>
          </div>

          <div class="grid gap-2 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
            <dt class="flex items-center gap-2 text-xs font-medium text-ink-muted">
              <Phone :size="14" aria-hidden="true" />
              Phone
            </dt>
            <dd class="text-sm text-ink">
              {{ vendor.phone || 'Not provided' }}
            </dd>
          </div>

          <div class="grid gap-2 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
            <dt class="flex items-center gap-2 text-xs font-medium text-ink-muted">
              <ExternalLink :size="14" aria-hidden="true" />
              Website
            </dt>
            <dd class="min-w-0 break-words text-sm text-ink">
              <a
                v-if="vendor.website"
                :href="vendor.website"
                target="_blank"
                rel="noopener"
                class="font-medium text-brand underline decoration-line-strong underline-offset-4 hover:text-brand-strong"
              >
                {{ vendor.website }}
              </a>
              <span v-else>Not provided</span>
            </dd>
          </div>
        </dl>
      </article>

      <aside class="min-w-0 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <header class="border-b border-line pb-5">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            Record context
          </p>
          <h2 class="font-display mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
            Notes and history
          </h2>
        </header>

        <div class="py-5">
          <p class="text-xs font-medium text-ink-muted">Working notes</p>
          <p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
            {{ vendor.notes || 'No notes added for this vendor.' }}
          </p>
        </div>

        <dl class="grid border-t border-line sm:grid-cols-2">
          <div class="border-b border-line py-4 sm:border-b-0 sm:border-r sm:pr-4">
            <dt class="text-xs font-medium text-ink-muted">Created</dt>
            <dd class="font-figure mt-1.5 text-sm text-ink">
              <time :datetime="vendor.createdAt">{{ formatDateTime(vendor.createdAt) }}</time>
            </dd>
          </div>

          <div class="py-4 sm:pl-4">
            <dt class="text-xs font-medium text-ink-muted">Last updated</dt>
            <dd class="font-figure mt-1.5 text-sm text-ink">
              <time :datetime="vendor.updatedAt">{{ formatDateTime(vendor.updatedAt) }}</time>
            </dd>
          </div>
        </dl>
      </aside>
    </section>
  </section>
</template>
