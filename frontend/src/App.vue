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

const primaryNavigationGroups = [
  {
    label: 'Daily ledger',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/expenses', label: 'Expenses', icon: ReceiptText },
      { to: '/recurring-expenses', label: 'Recurring expenses', icon: Repeat2 },
    ],
  },
  {
    label: 'Organization',
    items: [
      { to: '/vendors', label: 'Vendors', icon: Building2 },
      { to: '/expense-categories', label: 'Categories', icon: Tags },
    ],
  },
  {
    label: 'Analysis',
    items: [{ to: '/reports', label: 'Reports', icon: ChartNoAxesCombined }],
  },
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
    <div v-if="isAuthenticated" class="min-h-screen lg:flex">
      <aside
        class="border-b border-white/10 bg-brand-strong text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[248px] lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r"
      >
        <div
          class="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 lg:px-6 lg:py-6"
        >
          <div class="flex items-center gap-3">
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface shadow-card"
            >
              <img src="/logo-mark.svg" alt="" class="size-9" />
            </span>
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
                Evidence ledger
              </p>
              <p class="font-display mt-0.5 text-xl font-semibold tracking-[-0.025em] text-white">
                Virelio
              </p>
            </div>
          </div>

          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/8 px-3.5 text-sm font-medium text-white transition hover:bg-white/14 lg:hidden"
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
          class="flex-1 flex-col lg:min-h-0"
          :class="mobileNavigationOpen ? 'flex' : 'hidden lg:flex'"
        >
          <div
            data-sidebar-scroll-region
            class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-2 pt-5 overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <nav aria-label="Primary navigation" class="space-y-5">
              <section v-for="group in primaryNavigationGroups" :key="group.label">
                <p class="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  {{ group.label }}
                </p>
                <div class="mt-1.5 space-y-0.5">
                  <RouterLink
                    v-for="item in group.items"
                    :key="item.to"
                    :to="item.to"
                    class="relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition"
                    :class="
                      isSectionActive(item.to)
                        ? 'bg-white/10 text-white'
                        : 'text-white/60 hover:bg-white/8 hover:text-white'
                    "
                  >
                    <span
                      class="absolute inset-y-2 left-0 w-0.5 rounded-full transition-colors"
                      :class="isSectionActive(item.to) ? 'bg-accent' : 'bg-transparent'"
                      aria-hidden="true"
                    />
                    <component :is="item.icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
                    <span>{{ item.label }}</span>
                  </RouterLink>
                </div>
              </section>
            </nav>

            <CollapsibleRoot
              v-model:open="archiveNavigationOpen"
              class="mt-4 border-t border-white/10 pt-3"
            >
              <CollapsibleTrigger
                aria-label="Archived records"
                class="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-white/55 transition hover:bg-white/8 hover:text-white"
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
                <nav aria-label="Archived records" class="mt-1 space-y-0.5 pb-2 pl-3">
                  <RouterLink
                    v-for="item in archiveNavigation"
                    :key="item.to"
                    :to="item.to"
                    class="relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition"
                    :class="
                      route.path === item.to
                        ? 'bg-white/10 font-semibold text-white'
                        : 'text-white/50 hover:bg-white/8 hover:text-white'
                    "
                  >
                    <span
                      class="absolute inset-y-2 left-0 w-0.5 rounded-full"
                      :class="route.path === item.to ? 'bg-accent' : 'bg-transparent'"
                      aria-hidden="true"
                    />
                    <component :is="item.icon" :size="16" :stroke-width="1.8" aria-hidden="true" />
                    <span>{{ item.label }}</span>
                  </RouterLink>
                </nav>
              </CollapsibleContent>
            </CollapsibleRoot>
          </div>

          <div class="border-t border-white/10 px-4 py-4">
            <RouterLink
              v-if="currentUser"
              to="/profile"
              aria-label="Profile settings"
              data-account-link
              class="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-white/8"
              active-class="bg-white/10 hover:bg-white/10"
            >
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/70"
              >
                <UserRound :size="17" aria-hidden="true" />
              </span>
              <span class="min-w-0">
                <span class="block truncate text-sm font-semibold text-white">
                  {{ currentUser.fullName }}
                </span>
                <span class="mt-0.5 block truncate text-xs text-white/45">
                  {{ currentUser.email }}
                </span>
              </span>
            </RouterLink>

            <button
              type="button"
              class="mt-2 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-white/60 transition hover:bg-white/8 hover:text-white"
              @click="logout"
            >
              <LogOut :size="17" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main
        id="main-content"
        tabindex="-1"
        class="min-w-0 flex-1 bg-canvas px-5 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10"
      >
        <div class="mx-auto w-full max-w-[1280px]">
          <RouterView />
        </div>
      </main>
    </div>

    <div
      v-else
      class="relative mx-auto flex min-h-screen max-w-6xl flex-col overflow-hidden px-5 py-6 sm:px-8 sm:py-8"
    >
      <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-line" aria-hidden="true" />
      <div
        class="pointer-events-none absolute bottom-0 left-1/2 h-32 w-px bg-line"
        aria-hidden="true"
      />

      <main id="main-content" tabindex="-1" class="relative flex flex-1 items-center py-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
