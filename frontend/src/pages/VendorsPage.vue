<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Archive,
  Building2,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Eye,
  ExternalLink,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
} from '@lucide/vue'
import { archiveVendor, createVendor, fetchVendorsPage, updateVendor } from '@/lib/vendors/api'

import { ApiError } from '@/lib/api'
import {
  vendorFormSchema,
  vendorSchema,
  type Vendor,
  type VendorFormValues,
} from '@/lib/vendors/schema'
import { ZodError } from 'zod'
import { mapZodErrors } from '@/lib/zod'
import RecordActionSheet, { type RecordActionItem } from '@/components/ui/RecordActionSheet.vue'
import ResponsiveFormSurface from '@/components/ui/ResponsiveFormSurface.vue'

const vendors = ref<Vendor[]>([])
const PAGE_SIZE = 6
const route = useRoute()
const router = useRouter()
const search = ref(readSearchQuery() ?? '')
const hasSearch = computed(() => readSearchQuery() !== undefined)
const pagination = ref({
  page: 1,
  pageSize: PAGE_SIZE,
  totalItems: 0,
  totalPages: 0,
})
const vendor = ref<VendorFormValues>({
  name: '',
  email: '',
  phone: '',
  website: '',
  notes: '',
})

const loading = ref(true)
const error = ref('')

const showVendorForm = ref(false)
const editingVendorId = ref<string | null>(null)
const submitting = ref(false)
const submitError = ref('')
const actionError = ref('')
const mobileActionsOpen = ref(false)
const activeActionVendor = ref<Vendor | null>(null)

const form = ref<VendorFormValues>({
  name: '',
  email: '',
  phone: '',
  website: '',
  notes: '',
})

const formErrors = ref<Record<string, string>>({})

const mobileVendorActions = [
  { id: 'edit', label: 'Edit vendor', icon: Pencil },
  { id: 'archive', label: 'Archive vendor', icon: Archive, tone: 'danger' },
] as const satisfies readonly RecordActionItem[]

function readSearchQuery() {
  const value = route.query.search
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readPageQuery() {
  const value = route.query.page
  if (typeof value !== 'string') return 1

  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

async function applySearch() {
  const normalizedSearch = search.value.trim()
  const query = { ...route.query }

  if (normalizedSearch) {
    query.search = normalizedSearch
  } else {
    delete query.search
  }
  delete query.page

  await router.replace({ query })
}

async function clearSearch() {
  search.value = ''
  await applySearch()
}

async function changePage(page: number) {
  if (page < 1) return

  const query = { ...route.query }
  if (page === 1) {
    delete query.page
  } else {
    query.page = String(page)
  }

  await router.replace({ query })
}

function resetForm() {
  form.value = {
    name: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
  }
  vendor.value = {
    name: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
  }
  submitError.value = ''
  formErrors.value = {}
  editingVendorId.value = null
  actionError.value = ''
}

function openCreateForm() {
  resetForm()
  showVendorForm.value = true
}

function openEditForm(vendorData: Vendor) {
  const normalized = {
    name: vendorData.name,
    email: vendorData.email ?? '',
    phone: vendorData.phone ?? '',
    website: vendorData.website ?? '',
    notes: vendorData.notes ?? '',
  }
  vendor.value = { ...normalized }
  form.value = { ...normalized }
  submitError.value = ''
  formErrors.value = {}
  editingVendorId.value = vendorData.id
  showVendorForm.value = true
}

async function loadVendors() {
  try {
    error.value = ''
    const requestedPage = readPageQuery()
    const response = await fetchVendorsPage({
      search: readSearchQuery(),
      page: requestedPage,
      pageSize: PAGE_SIZE,
    })
    const lastPage = Math.max(response.pagination.totalPages, 1)
    if (requestedPage > lastPage) {
      await changePage(lastPage)
      return
    }

    const validatedVendors = []
    for (const vendor of response.items) {
      const result = vendorSchema.safeParse(vendor)
      if (!result.success) {
        continue
      }
      validatedVendors.push(result.data as Vendor)
    }
    vendors.value = validatedVendors
    pagination.value = response.pagination
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

async function loadFirstPage(clearActiveSearch: boolean) {
  const query = { ...route.query }
  const shouldNavigate =
    query.page !== undefined || (clearActiveSearch && query.search !== undefined)

  delete query.page
  if (clearActiveSearch) {
    delete query.search
    search.value = ''
  }

  if (shouldNavigate) {
    await router.replace({ query })
  } else {
    loading.value = true
    await loadVendors()
  }
}

function closeVendorForm() {
  showVendorForm.value = false
  resetForm()
}

function updateVendorFormOpen(open: boolean) {
  if (!open) {
    closeVendorForm()
  }
}

function openMobileActions(vendorData: Vendor) {
  activeActionVendor.value = vendorData
  mobileActionsOpen.value = true
}

function handleMobileAction(actionId: string) {
  const vendorData = activeActionVendor.value
  if (!vendorData) return

  mobileActionsOpen.value = false
  activeActionVendor.value = null

  if (actionId === 'edit') {
    openEditForm(vendorData)
  } else if (actionId === 'archive') {
    void archive(vendorData)
  }
}

function normalizePayload(input: VendorFormValues): VendorFormValues {
  return {
    name: input.name,
    email: input.email || undefined,
    phone: input.phone || undefined,
    website: input.website || undefined,
    notes: input.notes || undefined,
  }
}

function normalizeError(err: unknown) {
  if (err instanceof ApiError) {
    if (err.content) {
      formErrors.value = err.content
      return
    }
    submitError.value = err.message
    return
  }
  if (err instanceof ZodError) {
    formErrors.value = mapZodErrors(err.issues)
    return
  }
  submitError.value = 'Something went wrong'
}

function isSameVendorForm(form: VendorFormValues, vendor: VendorFormValues) {
  return (
    form.name === vendor.name &&
    (form.email ?? '') === (vendor.email ?? '') &&
    (form.phone ?? '') === (vendor.phone ?? '') &&
    (form.website ?? '') === (vendor.website ?? '') &&
    (form.notes ?? '') === (vendor.notes ?? '')
  )
}

async function submitVendorForm() {
  submitError.value = ''
  submitting.value = true
  formErrors.value = {}
  actionError.value = ''

  try {
    const validation = vendorFormSchema.parse(form.value)
    const payload = normalizePayload(validation)
    if (!editingVendorId.value) {
      const result = vendorSchema.safeParse(await createVendor(payload))
      if (!result.success) {
        closeVendorForm()
        actionError.value = 'Failed to fetch created vendor'
        return
      }
      await loadFirstPage(true)
    } else if (!isSameVendorForm(payload, vendor.value)) {
      const result = vendorSchema.safeParse(await updateVendor(editingVendorId.value, payload))
      if (!result.success) {
        closeVendorForm()
        actionError.value = 'Failed to fetch updated vendor'
        return
      }

      const updatedVendor = result.data as Vendor
      if (hasSearch.value) {
        await loadFirstPage(true)
      } else {
        vendors.value = vendors.value.map((vendor) =>
          vendor.id === updatedVendor.id ? updatedVendor : vendor,
        )
      }
    }

    closeVendorForm()
  } catch (err) {
    normalizeError(err)
  } finally {
    submitting.value = false
  }
}

async function archive({ id }: Vendor) {
  actionError.value = ''
  try {
    if (confirm('Are you sure you want to archive this vendor?')) {
      vendorSchema.parse(await archiveVendor(id))
      loading.value = true
      await loadVendors()
    }
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Archiving vendor failed'
  }
}

watch([() => route.query.search, () => route.query.page], () => {
  search.value = readSearchQuery() ?? ''
  loading.value = true
  void loadVendors()
})

onMounted(loadVendors)
</script>

<template>
  <section class="min-w-0 space-y-7">
    <header class="space-y-4">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Directory</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Vendor directory
          </h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
            Keep supplier details organized and ready for every expense.
          </p>
        </div>

        <button
          v-if="!showVendorForm"
          type="button"
          class="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-card transition hover:bg-brand-strong max-[375px]:w-full"
          @click="openCreateForm"
        >
          <Plus :size="17" aria-hidden="true" />
          Add vendor
        </button>
      </div>
      <div
        v-if="actionError"
        role="alert"
        class="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
      >
        {{ actionError }}
      </div>
    </header>

    <form
      class="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-end"
      role="search"
      @submit.prevent="applySearch"
    >
      <label class="flex-1">
        <span class="mb-1.5 block text-xs font-medium text-ink-muted">Search vendors</span>
        <span class="relative block">
          <Search
            :size="16"
            aria-hidden="true"
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            v-model="search"
            name="vendor-search"
            type="search"
            maxlength="120"
            placeholder="Search vendors"
            class="min-h-10 w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand"
          />
        </span>
      </label>

      <button
        type="submit"
        class="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
      >
        <Search :size="16" aria-hidden="true" />
        Search
      </button>

      <button
        v-if="hasSearch"
        type="button"
        class="min-h-10 rounded-xl px-3 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink"
        @click="clearSearch"
      >
        Clear
      </button>
    </form>

    <div v-if="showVendorForm" data-vendor-form-panel>
      <ResponsiveFormSurface
        :open="showVendorForm"
        :eyebrow="editingVendorId ? 'Revise supplier' : 'New supplier'"
        :title="editingVendorId ? 'Edit vendor' : 'Create vendor'"
        :description="
          editingVendorId
            ? 'Update this supplier and their contact details.'
            : 'Add a supplier before linking expenses and proofs.'
        "
        @update:open="updateVendorFormOpen"
      >
        <template #icon>
          <Pencil v-if="editingVendorId" :size="18" aria-hidden="true" />
          <Plus v-else :size="18" aria-hidden="true" />
        </template>
        <form aria-label="Vendor form" class="space-y-5" @submit.prevent="submitVendorForm">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-ink">Name</span>
              <input
                id="vendor-name"
                v-model="form.name"
                type="text"
                maxlength="120"
                :aria-describedby="formErrors.name ? 'vendor-name-error' : undefined"
                :aria-invalid="Boolean(formErrors.name)"
                :class="[
                  'min-h-11 w-full rounded-xl border bg-surface px-3 py-2 text-sm text-ink outline-none transition',
                  formErrors.name
                    ? 'border-danger focus:border-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                ]"
              />

              <p
                v-if="formErrors.name"
                id="vendor-name-error"
                class="ml-3 mt-2 text-sm text-danger"
              >
                {{ formErrors.name }}
              </p>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-ink">Email</span>
              <input
                id="vendor-email"
                v-model="form.email"
                type="email"
                maxlength="120"
                :aria-describedby="formErrors.email ? 'vendor-email-error' : undefined"
                :aria-invalid="Boolean(formErrors.email)"
                :class="[
                  'min-h-11 w-full rounded-xl border bg-surface px-3 py-2 text-sm text-ink outline-none transition',
                  formErrors.email
                    ? 'border-danger focus:border-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                ]"
              />

              <p
                v-if="formErrors.email"
                id="vendor-email-error"
                class="ml-3 mt-2 text-sm text-danger"
              >
                {{ formErrors.email }}
              </p>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-ink">Phone</span>
              <input
                id="vendor-phone"
                v-model="form.phone"
                type="tel"
                maxlength="40"
                :aria-describedby="formErrors.phone ? 'vendor-phone-error' : undefined"
                :aria-invalid="Boolean(formErrors.phone)"
                :class="[
                  'min-h-11 w-full rounded-xl border bg-surface px-3 py-2 text-sm text-ink outline-none transition',
                  formErrors.phone
                    ? 'border-danger focus:border-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                ]"
              />

              <p
                v-if="formErrors.phone"
                id="vendor-phone-error"
                class="ml-3 mt-2 text-sm text-danger"
              >
                {{ formErrors.phone }}
              </p>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-ink">Website</span>
              <input
                id="vendor-website"
                v-model="form.website"
                type="url"
                maxlength="120"
                :aria-describedby="formErrors.website ? 'vendor-website-error' : undefined"
                :aria-invalid="Boolean(formErrors.website)"
                :class="[
                  'min-h-11 w-full rounded-xl border bg-surface px-3 py-2 text-sm text-ink outline-none transition',
                  formErrors.website
                    ? 'border-danger focus:border-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                ]"
              />

              <p
                v-if="formErrors.website"
                id="vendor-website-error"
                class="ml-3 mt-2 text-sm text-danger"
              >
                {{ formErrors.website }}
              </p>
            </label>
          </div>

          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-ink">Notes</span>
            <textarea
              id="vendor-notes"
              v-model="form.notes"
              rows="4"
              maxlength="1000"
              :aria-describedby="formErrors.notes ? 'vendor-notes-error' : undefined"
              :aria-invalid="Boolean(formErrors.notes)"
              :class="[
                'w-full rounded-xl border bg-surface px-3 py-2 text-sm text-ink outline-none transition',
                formErrors.notes
                  ? 'border-danger focus:border-danger'
                  : 'border-line hover:border-line-strong focus:border-brand',
              ]"
            />

            <p
              v-if="formErrors.notes"
              id="vendor-notes-error"
              class="ml-3 mt-2 text-sm text-danger"
            >
              {{ formErrors.notes }}
            </p>
          </label>

          <div
            v-if="submitError"
            role="alert"
            class="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            {{ submitError }}
          </div>

          <div
            class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3"
          >
            <button
              type="button"
              class="min-h-11 w-full rounded-xl px-4 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink sm:w-auto"
              @click="closeVendorForm"
            >
              Cancel
            </button>

            <button
              type="submit"
              :disabled="submitting"
              class="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-line-strong sm:w-auto"
            >
              {{ submitting ? 'Saving...' : 'Save vendor' }}
            </button>
          </div>
        </form>
      </ResponsiveFormSurface>
    </div>

    <section class="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <header
        class="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6"
      >
        <div>
          <h3 class="text-base font-semibold text-ink">Active vendors</h3>
          <p class="mt-0.5 text-xs text-ink-muted">
            {{ pagination.totalItems }} vendor{{ pagination.totalItems === 1 ? '' : 's' }} in your
            directory
          </p>
        </div>
        <span
          v-if="hasSearch"
          class="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
        >
          Search active
        </span>
      </header>

      <div v-if="loading" class="space-y-3 p-5 sm:p-6" role="status" aria-label="Loading vendors">
        <div class="h-4 w-36 animate-pulse rounded bg-surface-muted"></div>
        <div class="space-y-3">
          <div class="h-24 animate-pulse rounded-2xl bg-surface-muted"></div>
          <div class="h-24 animate-pulse rounded-2xl bg-surface-muted"></div>
        </div>
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="m-5 rounded-2xl border border-danger/25 bg-danger-soft px-4 py-5 text-sm text-danger sm:m-6"
      >
        <p class="font-medium">Could not load vendors</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div v-else-if="vendors.length === 0" class="px-5 py-14 text-center sm:px-6">
        <span
          class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"
        >
          <Building2 :size="22" :stroke-width="1.7" aria-hidden="true" />
        </span>
        <p class="mt-4 text-base font-semibold text-ink">
          {{ hasSearch ? 'No matching vendors' : 'No vendors yet' }}
        </p>
        <p class="mx-auto mt-1 max-w-sm text-sm leading-6 text-ink-muted">
          {{
            hasSearch
              ? 'Try a different search term or clear the current search.'
              : 'Add your first vendor to start organizing expense records.'
          }}
        </p>
        <button
          v-if="hasSearch"
          type="button"
          class="mt-5 min-h-10 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:bg-surface-muted"
          @click="clearSearch"
        >
          Clear search
        </button>
        <button
          v-else
          type="button"
          class="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
          @click="openCreateForm"
        >
          <Plus :size="16" aria-hidden="true" />
          Create first vendor
        </button>
      </div>

      <div v-else>
        <div class="divide-y divide-line">
          <article
            v-for="vendor in vendors"
            :key="vendor.id"
            data-vendor-record
            class="group min-w-0 px-4 py-5 transition hover:bg-surface-muted/45 sm:px-6"
          >
            <div
              class="relative flex min-w-0 flex-col gap-2 md:static md:gap-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div class="min-w-0 pr-12 sm:pr-0">
                <div class="flex min-w-0 items-center gap-3.5">
                  <span
                    class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"
                  >
                    <Building2 :size="18" :stroke-width="1.8" aria-hidden="true" />
                  </span>
                  <h4 class="truncate text-sm font-semibold text-ink sm:text-base">
                    {{ vendor.name }}
                  </h4>
                </div>

                <div
                  class="mt-2.5 grid min-w-0 grid-cols-1 gap-y-1.5 text-xs text-ink-muted sm:flex sm:flex-wrap sm:gap-x-3"
                >
                  <span v-if="vendor.email" class="inline-flex min-w-0 items-center gap-1.5">
                    <Mail :size="13" aria-hidden="true" />
                    <span data-vendor-email :title="vendor.email" class="truncate">{{
                      vendor.email
                    }}</span>
                  </span>
                  <span v-if="vendor.phone" class="inline-flex min-w-0 items-center gap-1.5">
                    <Phone :size="13" aria-hidden="true" />
                    <span class="truncate">{{ vendor.phone }}</span>
                  </span>
                  <a
                    v-if="vendor.website"
                    :href="vendor.website"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex items-center gap-1 font-semibold text-brand hover:text-brand-strong"
                  >
                    Website
                    <ExternalLink :size="12" aria-hidden="true" />
                  </a>
                </div>

                <p v-if="vendor.notes" class="mt-2 line-clamp-2 text-sm leading-6 text-ink-muted">
                  {{ vendor.notes }}
                </p>
              </div>

              <div class="flex min-w-0 flex-wrap items-center justify-end gap-2 lg:justify-end">
                <RouterLink
                  :to="{ name: 'vendorDetails', params: { id: vendor.id } }"
                  class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-brand-soft px-2.5 text-brand transition hover:bg-brand hover:text-white"
                  :aria-label="`View ${vendor.name}`"
                  title="View vendor"
                >
                  <Eye :size="17" :stroke-width="1.8" aria-hidden="true" />
                </RouterLink>

                <button
                  type="button"
                  class="hidden min-h-11 min-w-11 items-center justify-center rounded-xl bg-surface-muted px-2.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink sm:inline-flex"
                  :aria-label="`Edit ${vendor.name}`"
                  title="Edit vendor"
                  @click="openEditForm(vendor)"
                >
                  <Pencil :size="17" :stroke-width="1.8" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="hidden min-h-11 min-w-11 items-center justify-center rounded-xl bg-danger-soft px-2.5 text-danger transition hover:bg-danger hover:text-white sm:inline-flex"
                  :aria-label="`Archive ${vendor.name}`"
                  title="Archive vendor"
                  @click="archive(vendor)"
                >
                  <Archive :size="17" :stroke-width="1.8" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-mobile-vendor-actions
                  class="absolute right-0 top-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-surface px-2.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink sm:hidden"
                  :aria-label="`Actions for ${vendor.name}`"
                  @click="openMobileActions(vendor)"
                >
                  <EllipsisVertical :size="18" aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>
        </div>

        <nav
          v-if="pagination.totalPages > 1"
          aria-label="Vendor pagination"
          class="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <p class="text-sm text-ink-muted">
            Page {{ pagination.page }} of {{ pagination.totalPages }} ·
            {{ pagination.totalItems }} vendors
          </p>

          <div class="flex items-center gap-2">
            <button
              type="button"
              :disabled="pagination.page === 1"
              class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:text-line-strong"
              @click="changePage(pagination.page - 1)"
            >
              <ChevronLeft :size="15" aria-hidden="true" />
              Previous
            </button>
            <button
              type="button"
              :disabled="pagination.page === pagination.totalPages"
              class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:text-line-strong"
              @click="changePage(pagination.page + 1)"
            >
              Next
              <ChevronRight :size="15" aria-hidden="true" />
            </button>
          </div>
        </nav>
      </div>
    </section>

    <RecordActionSheet
      :open="mobileActionsOpen"
      :record-label="activeActionVendor?.name ?? 'vendor'"
      :actions="mobileVendorActions"
      @update:open="mobileActionsOpen = $event"
      @select="handleMobileAction"
    />
  </section>
</template>
