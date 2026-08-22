<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArchiveRestore, Building2, Trash2 } from '@lucide/vue'
import { fetchArchivedVendors, removeVendor, restoreVendor } from '@/lib/vendors/api'
import { ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/helpers'
import { vendorSchema, type Vendor } from '@/lib/vendors/schema'

const vendors = ref<Vendor[]>([])
const loading = ref(true)
const error = ref('')
const actionError = ref('')
const restoringId = ref<string | null>(null)
const removingId = ref<string | null>(null)

async function loadArchivedVendors() {
  try {
    error.value = ''
    const validatedVendors = []
    for (const vendor of await fetchArchivedVendors()) {
      const result = vendorSchema.safeParse(vendor)
      if (!result.success) {
        continue
      }
      validatedVendors.push(result.data as Vendor)
    }

    vendors.value = validatedVendors
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

async function restore(vendor: Vendor) {
  actionError.value = ''
  restoringId.value = vendor.id

  try {
    if (confirm('Are you sure you want to restore this vendor?')) {
      const result = vendorSchema.safeParse(await restoreVendor(vendor.id))
      if (!result.success) {
        actionError.value = 'Failed to fetch restored vendor'
        return
      }

      const restoredVendor = result.data as Vendor
      vendors.value = vendors.value.filter((vendor) => vendor.id !== restoredVendor.id)
    }
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Restoring vendor failed'
  } finally {
    restoringId.value = null
  }
}

async function remove(vendor: Vendor) {
  actionError.value = ''
  removingId.value = vendor.id

  try {
    if (confirm('Are you sure you want to remove this vendor?')) {
      await removeVendor(vendor.id)
      vendors.value = vendors.value.filter((vendor) => vendor.id !== removingId.value)
    }
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Removing vendor failed'
  } finally {
    removingId.value = null
  }
}

onMounted(loadArchivedVendors)
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-4 border-b border-line pb-6">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
        Vendor archive
      </p>

      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            class="font-display text-[2rem] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[2.5rem]"
          >
            Vendors held outside active records.
          </h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-[15px]">
            Restore a vendor to active records, or permanently remove one that is no longer needed.
          </p>
        </div>
      </div>

      <div
        v-if="actionError"
        role="alert"
        class="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
      >
        {{ actionError }}
      </div>
    </header>

    <section class="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <header class="border-b border-line px-5 py-4 sm:px-6">
        <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Inactive vendors
        </p>
        <h2 class="font-display mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
          Archived vendor ledger
        </h2>
        <p class="mt-1 text-xs text-ink-muted">
          {{ vendors.length }} archived vendor{{ vendors.length === 1 ? '' : 's' }}
        </p>
      </header>

      <div
        v-if="loading"
        class="space-y-3 p-5 sm:p-6"
        role="status"
        aria-label="Loading archived vendors"
      >
        <div class="h-5 w-48 animate-pulse rounded bg-surface-muted"></div>
        <div class="space-y-2">
          <div class="h-20 animate-pulse rounded-lg bg-surface-muted/70"></div>
          <div class="h-20 animate-pulse rounded-lg bg-surface-muted/70"></div>
        </div>
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="m-5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-5 text-sm text-danger sm:m-6"
      >
        <p class="font-medium">Could not load archived vendors</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div v-else-if="vendors.length === 0" class="px-5 py-14 text-center sm:px-6">
        <span
          class="mx-auto flex size-11 items-center justify-center rounded-lg bg-surface-muted text-ink-muted"
        >
          <ArchiveRestore :size="20" aria-hidden="true" />
        </span>
        <p class="mt-3 text-sm font-semibold text-ink">No archived vendors</p>
        <p class="mt-1 text-sm text-ink-muted">
          Archived vendors will appear here when removed from the active list.
        </p>
      </div>

      <div v-else class="divide-y divide-line">
        <article
          v-for="vendor in vendors"
          :key="vendor.id"
          data-archived-vendor-record
          class="relative px-5 py-5 transition hover:bg-surface-muted/45 sm:px-6"
        >
          <span class="absolute inset-y-0 left-0 w-0.5 bg-line-strong" aria-hidden="true" />
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex min-w-0 items-start gap-3.5">
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted"
              >
                <Building2 :size="17" aria-hidden="true" />
              </span>
              <div class="min-w-0">
                <h3 class="text-base font-semibold tracking-[-0.015em] text-ink">
                  {{ vendor.name }}
                </h3>

                <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
                  <span v-if="vendor.email">{{ vendor.email }}</span>
                  <span v-if="vendor.phone">{{ vendor.phone }}</span>
                  <a
                    v-if="vendor.website"
                    :href="vendor.website"
                    target="_blank"
                    rel="noopener"
                    class="font-medium text-brand underline decoration-line-strong underline-offset-4 hover:text-brand-strong"
                  >
                    Website
                  </a>
                </div>

                <p v-if="vendor.notes" class="mt-2 text-sm leading-6 text-ink-muted">
                  {{ vendor.notes }}
                </p>

                <p v-if="vendor.archivedAt" class="mt-2 text-xs text-ink-muted">
                  Archived
                  <time :datetime="vendor.archivedAt" class="font-figure">
                    {{ formatDateTime(vendor.archivedAt) }}
                  </time>
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 sm:flex-nowrap lg:justify-end">
              <button
                type="button"
                :aria-label="`Restore ${vendor.name}`"
                :disabled="restoringId === vendor.id"
                class="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-soft px-3 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                @click="restore(vendor)"
              >
                <ArchiveRestore :size="14" aria-hidden="true" />
                {{ restoringId === vendor.id ? 'Restoring...' : 'Restore' }}
              </button>
              <button
                type="button"
                :aria-label="`Remove ${vendor.name}`"
                :disabled="removingId === vendor.id"
                class="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-muted transition hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
                @click="remove(vendor)"
              >
                <Trash2 :size="14" aria-hidden="true" />
                {{ removingId === vendor.id ? 'Removing...' : 'Remove' }}
              </button>

              <span class="border-l-2 border-line-strong pl-2 text-xs font-semibold text-ink-muted">
                Archived
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>
