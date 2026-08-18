<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { clearAccessToken, currentUser, isAuthenticated } from '@/lib/auth/storage'

const route = useRoute()
const router = useRouter()
const mobileNavigationOpen = ref(false)

const primaryNavigation = [
  { to: '/', label: 'Dashboard' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/recurring-expenses', label: 'Recurring expenses' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/expense-categories', label: 'Categories' },
  { to: '/reports', label: 'Reports' },
]

const archiveNavigation = [
  { to: '/expenses/archived', label: 'Expenses' },
  { to: '/recurring-expenses/archived', label: 'Recurring expenses' },
  { to: '/vendors/archived', label: 'Vendors' },
  { to: '/expense-categories/archived', label: 'Categories' },
]

function isSectionActive(path: string) {
  if (path === '/') return route.path === '/'
  if (route.path.endsWith('/archived')) return false
  return route.path === path || route.path.startsWith(`${path}/`)
}

async function logout() {
  mobileNavigationOpen.value = false
  clearAccessToken()
  await router.push('/login')
}

watch(
  () => route.fullPath,
  () => {
    mobileNavigationOpen.value = false
  },
)
</script>

<template>
  <div class="min-h-screen bg-stone-100 text-stone-900">
    <a
      href="#main-content"
      class="sr-only fixed left-4 top-4 z-50 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white focus:not-sr-only"
    >
      Skip to main content
    </a>

    <div v-if="isAuthenticated" class="mx-auto min-h-screen max-w-[1600px] lg:flex">
      <aside
        class="border-b border-stone-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r"
      >
        <div
          class="flex items-center justify-between gap-4 px-5 py-4 lg:block lg:px-7 lg:pb-6 lg:pt-8"
        >
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
              Expense tracker
            </p>
            <p class="mt-1 text-xl font-semibold tracking-tight text-stone-900 lg:mt-2 lg:text-2xl">
              Virelio
            </p>
          </div>

          <button
            type="button"
            class="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-100 lg:hidden"
            aria-controls="app-navigation"
            :aria-expanded="mobileNavigationOpen"
            @click="mobileNavigationOpen = !mobileNavigationOpen"
          >
            {{ mobileNavigationOpen ? 'Close' : 'Menu' }}
          </button>
        </div>

        <div
          id="app-navigation"
          class="flex-1 flex-col px-4 pb-5 lg:flex lg:min-h-0 lg:px-5 lg:pb-6"
          :class="mobileNavigationOpen ? 'flex' : 'hidden'"
        >
          <nav aria-label="Primary navigation" class="space-y-1">
            <RouterLink
              v-for="item in primaryNavigation"
              :key="item.to"
              :to="item.to"
              class="block rounded-xl px-3 py-2.5 text-sm font-medium transition"
              :class="
                isSectionActive(item.to)
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              "
            >
              {{ item.label }}
            </RouterLink>
          </nav>

          <nav aria-label="Archived records" class="mt-6 border-t border-stone-200 pt-5">
            <p class="px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
              Archived records
            </p>
            <div class="mt-2 space-y-1">
              <RouterLink
                v-for="item in archiveNavigation"
                :key="item.to"
                :to="item.to"
                class="block rounded-xl px-3 py-2 text-sm transition"
                :class="
                  route.path === item.to
                    ? 'bg-stone-200 font-medium text-stone-900'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
                "
              >
                {{ item.label }}
              </RouterLink>
            </div>
          </nav>

          <div class="mt-6 border-t border-stone-200 pt-5 lg:mt-auto">
            <div v-if="currentUser" class="px-3">
              <p class="truncate text-sm font-semibold text-stone-900">
                {{ currentUser.fullName }}
              </p>
              <p class="mt-1 truncate text-xs text-stone-500">
                {{ currentUser.email }}
              </p>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
              <RouterLink
                to="/profile"
                class="rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
                active-class="bg-stone-900 text-white hover:bg-stone-900 hover:text-white"
              >
                Profile
              </RouterLink>
              <button
                type="button"
                class="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
                @click="logout"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main
        id="main-content"
        tabindex="-1"
        class="min-w-0 flex-1 px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10"
      >
        <RouterView />
      </main>
    </div>

    <div v-else class="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
      <header class="flex items-center justify-between">
        <RouterLink to="/login" class="group">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
            Expense tracker
          </p>
          <p
            class="mt-1 text-xl font-semibold tracking-tight text-stone-900 transition group-hover:text-stone-600"
          >
            Virelio
          </p>
        </RouterLink>
      </header>

      <main id="main-content" tabindex="-1" class="flex flex-1 items-center py-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
