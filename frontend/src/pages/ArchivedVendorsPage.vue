<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
  <section class="space-y-8">
    <header class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Vendors</p>

      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Archived vendors
          </h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-stone-500 sm:text-base">
            Review archived vendors and restore them when they should be active again.
          </p>
        </div>
      </div>

      <div
        v-if="actionError"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ actionError }}
      </div>
    </header>

    <section class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div v-if="loading" class="space-y-3" role="status" aria-label="Loading archived vendors">
        <div class="h-5 w-48 animate-pulse rounded bg-stone-200"></div>
        <div class="space-y-2">
          <div class="h-16 animate-pulse rounded-2xl bg-stone-100"></div>
          <div class="h-16 animate-pulse rounded-2xl bg-stone-100"></div>
          <div class="h-16 animate-pulse rounded-2xl bg-stone-100"></div>
        </div>
      </div>

      <div
        v-else-if="error"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700"
      >
        <p class="font-medium">Could not load archived vendors</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div
        v-else-if="vendors.length === 0"
        class="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-12 text-center"
      >
        <p class="text-base font-medium text-stone-700">No archived vendors</p>
        <p class="mt-2 text-sm text-stone-500">
          Archived vendors will appear here when removed from the active list.
        </p>
      </div>

      <div v-else class="space-y-3">
        <article
          v-for="vendor in vendors"
          :key="vendor.id"
          class="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4 transition hover:border-stone-300 hover:bg-stone-100"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <h3 class="text-base font-semibold tracking-tight text-stone-900">
                {{ vendor.name }}
              </h3>

              <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
                <span v-if="vendor.email">{{ vendor.email }}</span>
                <span v-if="vendor.phone">{{ vendor.phone }}</span>
                <a
                  v-if="vendor.website"
                  :href="vendor.website"
                  target="_blank"
                  rel="noopener"
                  class="font-medium text-stone-700 underline decoration-stone-300 underline-offset-4 hover:text-stone-900"
                >
                  Website
                </a>
              </div>

              <p v-if="vendor.notes" class="mt-3 text-sm leading-6 text-stone-600">
                {{ vendor.notes }}
              </p>

              <p v-if="vendor.archivedAt" class="mt-3 text-xs text-stone-500">
                Archived
                <time :datetime="vendor.archivedAt">{{ formatDateTime(vendor.archivedAt) }}</time>
              </p>
            </div>

            <div class="flex shrink-0 items-center gap-3">
              <button
                type="button"
                :disabled="restoringId === vendor.id"
                class="inline-flex items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                @click="restore(vendor)"
              >
                {{ restoringId === vendor.id ? 'Restoring...' : 'Restore' }}
              </button>
              <button
                type="button"
                :disabled="removingId === vendor.id"
                class="inline-flex items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                @click="remove(vendor)"
              >
                {{ removingId === vendor.id ? 'Removing...' : 'Remove' }}
              </button>

              <span
                class="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-500 ring-1 ring-stone-200"
              >
                Archived
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>
