<script setup lang="ts">
import { useRouter } from 'vue-router'
import { clearAccessToken, currentUser, isAuthenticated } from '@/lib/auth/storage'
const router = useRouter()

async function logout() {
  clearAccessToken()
  await router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-stone-100 text-stone-900">
    <div class="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
      <aside
        class="w-full border-b border-stone-200 bg-white px-6 py-6 lg:w-72 lg:border-b-0 lg:border-r lg:px-7 lg:py-8"
      >
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
            Expense Tracker
          </p>
          <h1 class="mt-2 text-2xl font-semibold tracking-tight text-stone-900">Virelio</h1>
          <p class="mt-3 max-w-xs text-sm leading-6 text-stone-500">
            Track vendor invoices, receipts, and business spending in one place.
          </p>
        </div>

        <nav
          aria-label="Primary navigation"
          class="mt-8 flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap"
        >
          <RouterLink
            to="/"
            class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
          >
            Dashboard
          </RouterLink>

          <RouterLink
            to="/vendors"
            class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
          >
            Vendors
          </RouterLink>
          <RouterLink
            to="/vendors/archived"
            class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
          >
            Archived Vendors
          </RouterLink>
          <RouterLink
            to="/expense-categories"
            class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
          >
            Categories
          </RouterLink>
          <RouterLink
            to="/expense-categories/archived"
            class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
          >
            Archived Categories
          </RouterLink>
          <RouterLink
            to="/expenses"
            class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
          >
            Expenses
          </RouterLink>

          <RouterLink
            to="/expenses/archived"
            class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
          >
            Archived Expenses
          </RouterLink>
          <RouterLink
            to="/recurring-expenses"
            class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
          >
            Recurring Expenses
          </RouterLink>
          <RouterLink
            to="/recurring-expenses/archived"
            class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
          >
            Archived Recurring
          </RouterLink>
          <RouterLink
            to="/reports"
            class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
          >
            Reports
          </RouterLink>
          <div class="mt-8 border-t border-stone-200 pt-4">
            <template v-if="isAuthenticated">
              <p v-if="currentUser" class="px-4 text-sm font-medium text-stone-900">
                {{ currentUser.fullName }}
              </p>
              <p v-if="currentUser" class="px-4 pt-1 text-xs text-stone-500">
                {{ currentUser.email }}
              </p>

              <RouterLink
                to="/profile"
                class="mt-3 block rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
                active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
              >
                Profile settings
              </RouterLink>

              <button
                type="button"
                class="inline-flex w-full items-center rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
                @click="logout"
              >
                Logout
              </button>
            </template>

            <template v-else>
              <RouterLink
                to="/register"
                class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
                active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
              >
                Register
              </RouterLink>

              <RouterLink
                to="/login"
                class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
                active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
              >
                Login
              </RouterLink>
            </template>
          </div>
        </nav>
      </aside>

      <main class="flex-1 px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <RouterView />
      </main>
    </div>
  </div>
</template>
