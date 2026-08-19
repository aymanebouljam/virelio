<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Archive,
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  ReceiptText,
  Repeat2,
  Tags,
  UserRound,
  X,
} from '@lucide/vue'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { clearAccessToken, currentUser, isAuthenticated } from '@/lib/auth/storage'

const route = useRoute()
const router = useRouter()
const mobileNavigationOpen = ref(false)
const archiveNavigationOpen = ref(route.path.endsWith('/archived'))

const primaryNavigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/expenses', label: 'Expenses', icon: ReceiptText },
  { to: '/recurring-expenses', label: 'Recurring expenses', icon: Repeat2 },
  { to: '/vendors', label: 'Vendors', icon: Building2 },
  { to: '/expense-categories', label: 'Categories', icon: Tags },
  { to: '/reports', label: 'Reports', icon: ChartNoAxesCombined },
]

const archiveNavigation = [
  { to: '/expenses/archived', label: 'Expenses', icon: ReceiptText },
  { to: '/recurring-expenses/archived', label: 'Recurring expenses', icon: Repeat2 },
  { to: '/vendors/archived', label: 'Vendors', icon: Building2 },
  { to: '/expense-categories/archived', label: 'Categories', icon: Tags },
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
    if (route.path.endsWith('/archived')) {
      archiveNavigationOpen.value = true
    }
  },
)
</script>

<template>
  <div class="min-h-screen bg-canvas text-ink">
    <a
      href="#main-content"
      class="sr-only fixed left-4 top-4 z-50 rounded-xl bg-brand-strong px-4 py-3 text-sm font-semibold text-surface focus:not-sr-only"
    >
      Skip to main content
    </a>

    <div v-if="isAuthenticated" class="mx-auto min-h-screen max-w-[1600px] lg:flex">
      <aside
        class="border-b border-white/10 bg-brand-strong text-white shadow-lifted lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col lg:border-b-0"
      >
        <div
          class="flex items-center justify-between gap-4 px-5 py-4 lg:block lg:px-7 lg:pb-7 lg:pt-8"
        >
          <div class="flex items-center gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface shadow-lg shadow-black/15"
            >
              <img src="/logo-mark.svg" alt="" class="size-10" />
            </span>
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
                Expense tracker
              </p>
              <p class="mt-0.5 text-xl font-semibold tracking-tight text-white">Virelio</p>
            </div>
          </div>

          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3.5 text-sm font-medium text-white transition hover:bg-white/14 lg:hidden"
            aria-controls="app-navigation"
            :aria-expanded="mobileNavigationOpen"
            @click="mobileNavigationOpen = !mobileNavigationOpen"
          >
            <X v-if="mobileNavigationOpen" :size="18" aria-hidden="true" />
            <MenuIcon v-else :size="18" aria-hidden="true" />
            {{ mobileNavigationOpen ? 'Close' : 'Menu' }}
          </button>
        </div>

        <div
          id="app-navigation"
          class="flex-1 flex-col px-4 pb-5 lg:min-h-0 lg:overflow-y-auto lg:px-5 lg:pb-6"
          :class="mobileNavigationOpen ? 'flex' : 'hidden lg:flex'"
        >
          <nav aria-label="Primary navigation" class="space-y-1">
            <RouterLink
              v-for="item in primaryNavigation"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
              :class="
                isSectionActive(item.to)
                  ? 'bg-white text-brand-strong shadow-card'
                  : 'text-white/65 hover:bg-white/8 hover:text-white'
              "
            >
              <component :is="item.icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </nav>

          <CollapsibleRoot
            v-model:open="archiveNavigationOpen"
            class="mt-5 border-t border-white/10 pt-4"
          >
            <CollapsibleTrigger
              aria-label="Archived records"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/60 transition hover:bg-white/8 hover:text-white"
            >
              <Archive :size="18" :stroke-width="1.8" aria-hidden="true" />
              <span class="flex-1">Archived records</span>
              <ChevronDown
                :size="16"
                aria-hidden="true"
                class="transition-transform duration-200"
                :class="archiveNavigationOpen ? 'rotate-180' : ''"
              />
            </CollapsibleTrigger>

            <CollapsibleContent>
              <nav aria-label="Archived records" class="mt-1 space-y-1 pl-3">
                <RouterLink
                  v-for="item in archiveNavigation"
                  :key="item.to"
                  :to="item.to"
                  class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition"
                  :class="
                    route.path === item.to
                      ? 'bg-accent-soft font-semibold text-brand-strong'
                      : 'text-white/50 hover:bg-white/8 hover:text-white'
                  "
                >
                  <component :is="item.icon" :size="16" :stroke-width="1.8" aria-hidden="true" />
                  <span>{{ item.label }}</span>
                </RouterLink>
              </nav>
            </CollapsibleContent>
          </CollapsibleRoot>

          <div class="mt-6 border-t border-white/10 pt-5 lg:mt-auto">
            <div v-if="currentUser" class="flex items-center gap-3 px-3">
              <div
                class="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70"
              >
                <UserRound :size="17" aria-hidden="true" />
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-white">
                  {{ currentUser.fullName }}
                </p>
                <p class="mt-0.5 truncate text-xs text-white/45">
                  {{ currentUser.email }}
                </p>
              </div>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
              <RouterLink
                to="/profile"
                class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/8 hover:text-white"
                active-class="bg-white text-brand-strong hover:bg-white hover:text-brand-strong"
              >
                <UserRound :size="17" aria-hidden="true" />
                Profile
              </RouterLink>
              <button
                type="button"
                class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/60 transition hover:bg-white/8 hover:text-white"
                @click="logout"
              >
                <LogOut :size="17" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main
        id="main-content"
        tabindex="-1"
        class="min-w-0 flex-1 bg-canvas px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10"
      >
        <RouterView />
      </main>
    </div>

    <div
      v-else
      class="relative mx-auto flex min-h-screen max-w-6xl flex-col overflow-hidden px-5 py-6 sm:px-8 sm:py-8"
    >
      <div
        class="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-brand-soft/70 blur-3xl"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute -bottom-40 -left-40 size-96 rounded-full bg-accent-soft/60 blur-3xl"
        aria-hidden="true"
      />

      <main id="main-content" tabindex="-1" class="relative flex flex-1 items-center py-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
