import { createRouter, createWebHistory } from 'vue-router'
import DashboardPage from '@/pages/DashboardPage.vue'
import VendorsPage from '@/pages/VendorsPage.vue'
import ArchivedVendorsPage from '@/pages/ArchivedVendorsPage.vue'
import VendorDetailsPage from '@/pages/VendorDetailsPage.vue'
import ExpenseCategoriesPage from '@/pages/ExpenseCategoriesPage.vue'
import ArchivedExpenseCategoriesPage from '@/pages/ArchivedExpenseCategoriesPage.vue'
import ExpensesPage from '@/pages/ExpensesPage.vue'
import ArchivedExpensesPage from '@/pages/ArchivedExpensesPage.vue'
import ExpenseDetailsPage from '@/pages/ExpenseDetailsPage.vue'
import ReportsPage from '@/pages/ReportsPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import ProfileSettingsPage from '@/pages/ProfileSettingsPage.vue'
import RecurringExpensesPage from '@/pages/RecurringExpensesPage.vue'
import ArchivedRecurringExpensesPage from '@/pages/ArchivedRecurringExpensesPage.vue'
import { clearAccessToken, currentUser, isAuthenticated } from '@/lib/auth/storage'
import { fetchCurrentUser } from '@/lib/auth/api'
import { ApiError } from '@/lib/api'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/vendors',
      name: 'vendors',
      component: VendorsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/vendors/archived',
      name: 'vendorsArchived',
      component: ArchivedVendorsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/vendors/:id',
      name: 'vendorDetails',
      component: VendorDetailsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/expense-categories',
      name: 'expenseCategories',
      component: ExpenseCategoriesPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/expense-categories/archived',
      name: 'expenseCategoriesArchived',
      component: ArchivedExpenseCategoriesPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/expenses',
      name: 'expenses',
      component: ExpensesPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/expenses/archived',
      name: 'expensesArchived',
      component: ArchivedExpensesPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/expenses/:id',
      name: 'expenseDetails',
      component: ExpenseDetailsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/reports',
      name: 'reports',
      component: ReportsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/recurring-expenses',
      name: 'recurringExpenses',
      component: RecurringExpensesPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/recurring-expenses/archived',
      name: 'recurringExpensesArchived',
      component: ArchivedRecurringExpensesPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileSettingsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterPage,
      meta: { guestOnly: true },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      meta: { guestOnly: true },
    },
  ],
})
router.beforeEach(async (to) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const guestOnly = to.matched.some((record) => record.meta.guestOnly)
  const authenticated = isAuthenticated.value

  if (!requiresAuth && !guestOnly) {
    return true
  }

  if (!authenticated && requiresAuth) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (!authenticated) {
    return true
  }

  if (currentUser.value === null) {
    try {
      currentUser.value = await fetchCurrentUser()
    } catch (error) {
      clearAccessToken()

      if (error instanceof ApiError) {
        return { name: 'login', query: { redirect: to.fullPath } }
      }

      throw error
    }
  }

  if (guestOnly) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
