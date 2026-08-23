import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import { ApiError } from '@/lib/api'
import type { ExpenseCategory } from '@/lib/expense-categories/schema'
import type { Expense, ExpenseDetail } from '@/lib/expenses/schema'
import { formatDateTime } from '@/lib/helpers'
import type { ProofDocument } from '@/lib/proofs/api'
import type { Vendor } from '@/lib/vendors/schema'
import ArchivedExpensesPage from '@/pages/ArchivedExpensesPage.vue'
import ExpenseDetailsPage from '@/pages/ExpenseDetailsPage.vue'
import { mountWithRouter } from './test-mount'
import { createTestRouter } from './test-router'

const expensesApi = vi.hoisted(() => ({
  fetchArchivedExpenses: vi.fn<() => Promise<Expense[]>>(),
  fetchExpense: vi.fn<(id: string) => Promise<ExpenseDetail>>(),
  removeExpense: vi.fn<(id: string) => Promise<null>>(),
  restoreExpense: vi.fn<(id: string) => Promise<Expense>>(),
}))

const proofsApi = vi.hoisted(() => ({
  downloadExpenseProof: vi.fn<(expenseId: string, proofId: string) => Promise<Blob>>(),
  removeExpenseProof: vi.fn<(expenseId: string, proofId: string) => Promise<null>>(),
  uploadExpenseProof: vi.fn<(expenseId: string, file: File) => Promise<ProofDocument>>(),
}))

const vendorsApi = vi.hoisted(() => ({
  fetchVendors: vi.fn<(filters?: { search?: string }) => Promise<Vendor[]>>(),
}))

const categoriesApi = vi.hoisted(() => ({
  fetchExpenseCategories: vi.fn<() => Promise<ExpenseCategory[]>>(),
}))

vi.mock('@/lib/expenses/api', () => expensesApi)
vi.mock('@/lib/proofs/api', () => proofsApi)
vi.mock('@/lib/vendors/api', () => vendorsApi)
vi.mock('@/lib/expense-categories/api', () => categoriesApi)

const atlas: Vendor = {
  id: 'vendor-1',
  name: 'Atlas Supplies',
  email: 'hello@atlas.example',
  phone: '+212600000001',
  website: 'https://atlas.example',
  notes: 'Office supplier',
  createdAt: '2026-08-05T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
  archivedAt: null,
}

const travel: ExpenseCategory = {
  id: 'category-1',
  name: 'Travel',
  color: '#2563eb',
  createdAt: '2026-08-05T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
  archivedAt: null,
}

const receipt: ProofDocument = {
  id: 'proof-1',
  expenseId: 'expense-1',
  originalName: 'receipt.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  createdAt: '2026-08-05T10:00:00.000Z',
}

const flight: Expense = {
  id: 'expense-1',
  vendorId: atlas.id,
  categoryId: travel.id,
  description: 'Client-site flight',
  amount: '125.50',
  expenseDate: '2026-08-05T00:00:00.000Z',
  notes: 'Quarterly visit',
  createdAt: '2026-08-05T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
  archivedAt: null,
}

const archivedAt = '2026-08-05T10:00:00.000Z'

const archivedFlight: Expense = {
  ...flight,
  archivedAt,
}

const flightDetails: ExpenseDetail = {
  ...flight,
  vendor: atlas,
  category: travel,
  proofs: [receipt],
}

const detailRoutes: RouteRecordRaw[] = [
  { path: '/expenses', name: 'expenses', component: { template: '<p>Expenses</p>' } },
  { path: '/expenses/:id', name: 'expenseDetails', component: ExpenseDetailsPage },
]

function getButton(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === text)
  if (!button) throw new Error(`${text} button not found`)
  return button
}

async function selectProofFile(wrapper: VueWrapper, file: File) {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
  await input.trigger('change')
}

async function mountDetails() {
  const result = await mountWithRouter(ExpenseDetailsPage, detailRoutes, '/expenses/expense-1')
  await flushPromises()
  return result
}

async function mountArchivedExpenses() {
  const wrapper = mount(ArchivedExpensesPage)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.resetAllMocks()
  expensesApi.fetchExpense.mockResolvedValue(flightDetails)
  expensesApi.fetchArchivedExpenses.mockResolvedValue([])
  vendorsApi.fetchVendors.mockResolvedValue([atlas])
  categoriesApi.fetchExpenseCategories.mockResolvedValue([travel])
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('expense details and proofs', () => {
  it('returns to the previous page', async () => {
    const router = await createTestRouter(detailRoutes, '/expenses')
    await router.push('/expenses/expense-1')
    const wrapper = mount(ExpenseDetailsPage, {
      global: {
        plugins: [router],
      },
    })
    await flushPromises()

    await getButton(wrapper, 'Back').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/expenses')
  })

  it('shows loading before rendering expense, vendor, category, and proof details', async () => {
    let resolveExpense!: (expense: ExpenseDetail) => void
    expensesApi.fetchExpense.mockReturnValue(
      new Promise<ExpenseDetail>((resolve) => {
        resolveExpense = resolve
      }),
    )

    const { wrapper } = await mountDetails()

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Loading expense details')

    resolveExpense(flightDetails)
    await flushPromises()

    expect(expensesApi.fetchExpense).toHaveBeenCalledExactlyOnceWith('expense-1')
    expect(wrapper.get('h1').text()).toBe('Client-site flight')
    expect(wrapper.find('[data-expense-record-summary]').exists()).toBe(true)
    expect(wrapper.findAll('[data-proof-record]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Client-site flight')
    expect(wrapper.text()).toContain('Atlas Supplies')
    expect(wrapper.text()).toContain('Travel')
    expect(wrapper.text()).toContain('Quarterly visit')
    expect(wrapper.text()).toContain('receipt.pdf')
  })

  it('shows expense loading failures', async () => {
    expensesApi.fetchExpense.mockRejectedValue(new ApiError('expense not found'))

    const { wrapper } = await mountDetails()

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load expense')
    expect(wrapper.get('[role="alert"]').text()).toContain('Expense not found')
  })

  it('renders empty category and proof states', async () => {
    expensesApi.fetchExpense.mockResolvedValue({
      ...flightDetails,
      categoryId: null,
      category: null,
      proofs: [],
    })

    const { wrapper } = await mountDetails()

    expect(wrapper.text()).toContain('No category assigned.')
    expect(wrapper.text()).toContain('No proof documents attached.')
  })

  it('uploads a selected proof', async () => {
    expensesApi.fetchExpense.mockResolvedValue({ ...flightDetails, proofs: [] })
    proofsApi.uploadExpenseProof.mockResolvedValue(receipt)
    const { wrapper } = await mountDetails()
    const file = new File(['receipt contents'], 'receipt.pdf', { type: 'application/pdf' })

    await selectProofFile(wrapper, file)
    await flushPromises()

    expect(proofsApi.uploadExpenseProof).toHaveBeenCalledExactlyOnceWith('expense-1', file)
    expect(wrapper.text()).toContain('receipt.pdf')
    expect(wrapper.text()).not.toContain('No proof documents attached.')
  })

  it('keeps the proof upload control available to keyboard users', async () => {
    const { wrapper } = await mountDetails()
    const input = wrapper.get('#expense-proof-upload')

    expect(wrapper.get('label[for="expense-proof-upload"]').text()).toBe('Upload proof')
    expect(input.classes()).toContain('sr-only')
    expect(input.classes()).not.toContain('hidden')
  })

  it('downloads a proof through the authenticated API', async () => {
    const proofBlob = new Blob(['receipt contents'], { type: 'application/pdf' })
    proofsApi.downloadExpenseProof.mockResolvedValue(proofBlob)
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-proof')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const { wrapper } = await mountDetails()

    await getButton(wrapper, 'receipt.pdf').trigger('click')
    await flushPromises()

    expect(proofsApi.downloadExpenseProof).toHaveBeenCalledExactlyOnceWith('expense-1', 'proof-1')
    expect(createObjectUrl).toHaveBeenCalledExactlyOnceWith(proofBlob)
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith('blob:test-proof')
  })

  it('shows missing proof files without removing their metadata', async () => {
    proofsApi.downloadExpenseProof.mockRejectedValue(new ApiError('proof file not found'))
    const { wrapper } = await mountDetails()

    await getButton(wrapper, 'receipt.pdf').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Proof file not found')
    expect(wrapper.text()).toContain('receipt.pdf')
  })

  it('removes a confirmed proof', async () => {
    proofsApi.removeExpenseProof.mockResolvedValue(null)
    const confirmMock = vi.fn<() => boolean>(() => true)
    vi.stubGlobal('confirm', confirmMock)
    const { wrapper } = await mountDetails()
    const removeButton = getButton(wrapper, 'Remove')

    expect(removeButton.attributes('aria-label')).toBe('Remove receipt.pdf')

    await removeButton.trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledExactlyOnceWith(
      'Are you sure you want to remove this proof document?',
    )
    expect(proofsApi.removeExpenseProof).toHaveBeenCalledExactlyOnceWith('expense-1', 'proof-1')
    expect(wrapper.text()).not.toContain('receipt.pdf')
    expect(wrapper.text()).toContain('No proof documents attached.')
  })

  it('shows proof upload failures', async () => {
    expensesApi.fetchExpense.mockResolvedValue({ ...flightDetails, proofs: [] })
    proofsApi.uploadExpenseProof.mockRejectedValue(new ApiError('unsupported proof type'))
    const { wrapper } = await mountDetails()
    const file = new File(['invalid'], 'receipt.txt', { type: 'text/plain' })

    await selectProofFile(wrapper, file)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Unsupported proof type')
    expect(wrapper.get('#expense-proof-upload').attributes()).toMatchObject({
      'aria-describedby': 'expense-proof-upload-error',
      'aria-invalid': 'true',
    })
    expect(wrapper.text()).toContain('No proof documents attached.')
  })
})

describe('archived expense management', () => {
  it('shows loading and empty states', async () => {
    let resolveExpenses!: (expenses: Expense[]) => void
    expensesApi.fetchArchivedExpenses.mockReturnValue(
      new Promise<Expense[]>((resolve) => {
        resolveExpenses = resolve
      }),
    )

    const wrapper = await mountArchivedExpenses()

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe(
      'Loading archived expenses',
    )

    resolveExpenses([])
    await flushPromises()

    expect(wrapper.text()).toContain('No archived expenses')
  })

  it('shows API loading failures', async () => {
    expensesApi.fetchArchivedExpenses.mockRejectedValue(new ApiError('service unavailable'))

    const wrapper = await mountArchivedExpenses()

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load archived expenses')
    expect(wrapper.get('[role="alert"]').text()).toContain('Service unavailable')
  })

  it('renders archived expenses with their relations', async () => {
    expensesApi.fetchArchivedExpenses.mockResolvedValue([archivedFlight])

    const wrapper = await mountArchivedExpenses()

    expect(wrapper.get('h1').text()).toBe('Records held outside the ledger.')
    expect(wrapper.findAll('[data-archived-expense-record]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Client-site flight')
    expect(wrapper.text()).toContain('Atlas Supplies')
    expect(wrapper.text()).toContain('Travel')
  })

  it('shows when an expense was archived', async () => {
    expensesApi.fetchArchivedExpenses.mockResolvedValue([archivedFlight])

    const wrapper = await mountArchivedExpenses()
    const archiveTime = wrapper.get('time')

    expect(archiveTime.attributes('datetime')).toBe(archivedAt)
    expect(archiveTime.text()).toBe(formatDateTime(archivedAt))
  })

  it('identifies which expense archive actions affect', async () => {
    expensesApi.fetchArchivedExpenses.mockResolvedValue([archivedFlight])

    const wrapper = await mountArchivedExpenses()

    expect(getButton(wrapper, 'Restore').attributes('aria-label')).toBe(
      'Restore Client-site flight',
    )
    expect(getButton(wrapper, 'Remove').attributes('aria-label')).toBe('Remove Client-site flight')
  })

  it('restores a confirmed expense', async () => {
    expensesApi.fetchArchivedExpenses.mockResolvedValue([archivedFlight])
    expensesApi.restoreExpense.mockResolvedValue(flight)
    const confirmMock = vi.fn<() => boolean>(() => true)
    vi.stubGlobal('confirm', confirmMock)
    const wrapper = await mountArchivedExpenses()

    await getButton(wrapper, 'Restore').trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledExactlyOnceWith(
      'Are you sure you want to restore this expense?',
    )
    expect(expensesApi.restoreExpense).toHaveBeenCalledExactlyOnceWith('expense-1')
    expect(wrapper.text()).not.toContain('Client-site flight')
    expect(wrapper.text()).toContain('No archived expenses')
  })

  it('permanently removes a confirmed expense', async () => {
    expensesApi.fetchArchivedExpenses.mockResolvedValue([archivedFlight])
    expensesApi.removeExpense.mockResolvedValue(null)
    vi.stubGlobal(
      'confirm',
      vi.fn<() => boolean>(() => true),
    )
    const wrapper = await mountArchivedExpenses()

    await getButton(wrapper, 'Remove').trigger('click')
    await flushPromises()

    expect(expensesApi.removeExpense).toHaveBeenCalledExactlyOnceWith('expense-1')
    expect(wrapper.text()).not.toContain('Client-site flight')
    expect(wrapper.text()).toContain('No archived expenses')
  })

  it('keeps an expense visible when permanent removal fails', async () => {
    expensesApi.fetchArchivedExpenses.mockResolvedValue([archivedFlight])
    expensesApi.removeExpense.mockRejectedValue(new ApiError('expense could not be removed'))
    vi.stubGlobal(
      'confirm',
      vi.fn<() => boolean>(() => true),
    )
    const wrapper = await mountArchivedExpenses()

    await getButton(wrapper, 'Remove').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Expense could not be removed')
    expect(wrapper.text()).toContain('Client-site flight')
  })
})
