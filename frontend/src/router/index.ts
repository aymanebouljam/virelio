import { createRouter, createWebHistory } from 'vue-router'
import DashboardPage from '@/pages/DashboardPage.vue'
import VendorsPage from '@/pages/VendorsPage.vue'
import ArchivedVendorsPage from '@/pages/ArchivedVendorsPage.vue'
import VendorDetailsPage from '@/pages/VendorDetailsPage.vue'
import ExpenseCategoriesPage from '@/pages/ExpenseCategoriesPage.vue'
import ArchivedExpenseCategoriesPage from '@/pages/ArchivedExpenseCategoriesPage.vue'
import ExpensesPage from '@/pages/ExpensesPage.vue'
import ArchivedExpensesPage from '@/pages/ArchivedExpensesPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardPage,
    },
    {
      path: '/vendors',
      name: 'vendors',
      component: VendorsPage,
    },
    {
      path: '/vendors/archived',
      name: 'vendorsArchived',
      component: ArchivedVendorsPage,
    },
    {
      path: '/vendors/:id',
      name: 'vendorDetails',
      component: VendorDetailsPage,
    },
    {
      path: '/expense-categories',
      name: 'expenseCategories',
      component: ExpenseCategoriesPage,
    },
    {
      path: '/expense-categories/archived',
      name: 'expenseCategoriesArchived',
      component: ArchivedExpenseCategoriesPage,
    },
    {
      path: '/expenses',
      name: 'expenses',
      component: ExpensesPage,
    },
    {
      path: '/expenses/archived',
      name: 'expensesArchived',
      component: ArchivedExpensesPage,
    },
  ],
})

export default router
