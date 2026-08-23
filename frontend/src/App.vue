<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  X,
} from '@lucide/vue'
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import { clearAccessToken, currentUser, isAuthenticated } from '@/lib/auth/storage'
import { getInitials } from '@/lib/helpers'

const route = useRoute()
const router = useRouter()
const mobileMoreOpen = ref(false)
const archiveNavigationOpen = ref(route.path.endsWith('/archived'))
const accountInitials = computed(() => getInitials(currentUser.value?.fullName ?? ''))

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

const mobileNavigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/expenses', label: 'Expenses', icon: ReceiptText },
  { to: '/recurring-expenses', label: 'Recurring', icon: Repeat2 },
  { to: '/reports', label: 'Reports', icon: ChartNoAxesCombined },
]

const isMoreActive = computed(
  () =>
    route.path === '/profile' ||
    route.path.startsWith('/vendors') ||
    route.path.startsWith('/expense-categories') ||
    route.path.endsWith('/archived'),
)

function isSectionActive(path: string) {
  if (path === '/') return route.path === '/'
  if (route.path.endsWith('/archived')) return false
  return route.path === path || route.path.startsWith(`${path}/`)
}

async function logout() {
  mobileMoreOpen.value = false
  clearAccessToken()
  await router.push('/login')
}

watch(
  () => route.fullPath,
  () => {
    mobileMoreOpen.value = false
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
        class="hidden border-r border-white/10 bg-brand-strong text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[248px] lg:shrink-0 lg:flex-col"
      >
        <div class="flex items-center gap-3 border-b border-white/10 px-6 py-6">
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface shadow-card"
          >
            <img src="/logo-mark.svg" alt="" class="size-9" />
          </span>
          <div class="flex items-center gap-3">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
                Evidence ledger
              </p>
              <p class="font-display mt-0.5 text-xl font-semibold tracking-[-0.025em] text-white">
                Virelio
              </p>
            </div>
          </div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col">
          <div
            data-sidebar-scroll-region
            class="px-4 pb-2 pt-5 lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden"
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
                data-account-initials
                class="font-figure flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-semibold tracking-[0.08em] text-white shadow-card"
                aria-hidden="true"
              >
                {{ accountInitials }}
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

      <header
        class="fixed inset-x-0 top-0 z-30 flex min-h-14 items-center border-b border-white/10 bg-brand-strong px-4 text-white shadow-card lg:hidden"
      >
        <RouterLink to="/" class="flex items-center gap-2.5" aria-label="Virelio dashboard">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface">
            <img src="/logo-mark.svg" alt="" class="size-8" />
          </span>
          <span>
            <span
              class="block text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-white/45"
            >
              Evidence ledger
            </span>
            <span class="font-display mt-1 block text-base font-semibold leading-none text-white">
              Virelio
            </span>
          </span>
        </RouterLink>
      </header>

      <main
        id="main-content"
        tabindex="-1"
        class="min-w-0 flex-1 bg-canvas px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[4.75rem] sm:px-7 sm:pt-[5.5rem] lg:px-10 lg:py-10"
      >
        <div class="mx-auto w-full max-w-[1280px]">
          <RouterView />
        </div>
      </main>

      <DialogRoot v-model:open="mobileMoreOpen">
        <nav
          aria-label="Mobile navigation"
          class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 shadow-[0_-8px_24px_rgba(31,43,66,0.08)] backdrop-blur [padding-bottom:env(safe-area-inset-bottom)] lg:hidden"
        >
          <RouterLink
            v-for="item in mobileNavigation"
            :key="item.to"
            :to="item.to"
            class="relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors"
            :class="isSectionActive(item.to) ? 'text-brand-strong' : 'text-ink-muted'"
          >
            <span
              class="absolute inset-x-3 top-0 h-0.5 rounded-b-full"
              :class="isSectionActive(item.to) ? 'bg-accent' : 'bg-transparent'"
              aria-hidden="true"
            />
            <component :is="item.icon" :size="20" :stroke-width="1.8" aria-hidden="true" />
            <span class="max-w-full truncate">{{ item.label }}</span>
          </RouterLink>

          <DialogTrigger as-child>
            <button
              type="button"
              class="relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors"
              :class="isMoreActive || mobileMoreOpen ? 'text-brand-strong' : 'text-ink-muted'"
              aria-haspopup="dialog"
              :aria-expanded="mobileMoreOpen"
            >
              <span
                class="absolute inset-x-3 top-0 h-0.5 rounded-b-full"
                :class="isMoreActive || mobileMoreOpen ? 'bg-accent' : 'bg-transparent'"
                aria-hidden="true"
              />
              <MenuIcon :size="20" :stroke-width="1.8" aria-hidden="true" />
              <span>More</span>
            </button>
          </DialogTrigger>
        </nav>

        <DialogOverlay class="fixed inset-0 z-40 bg-brand-strong/55 backdrop-blur-[2px]" />
        <DialogContent
          class="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-surface px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_48px_rgba(31,43,66,0.2)] focus:outline-none sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-xl sm:-translate-x-1/2"
        >
          <div class="mx-auto h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />
          <div class="mt-4 flex items-start justify-between gap-4">
            <div>
              <DialogTitle class="font-display text-xl font-semibold tracking-tight text-ink">
                More
              </DialogTitle>
              <DialogDescription class="mt-1 text-sm text-ink-muted">
                Organization, archives, and account settings.
              </DialogDescription>
            </div>
            <DialogClose
              class="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-line-strong hover:text-ink"
              aria-label="Close more menu"
            >
              <X :size="19" aria-hidden="true" />
            </DialogClose>
          </div>

          <nav aria-label="More navigation" class="mt-5 grid grid-cols-2 gap-2">
            <RouterLink
              v-for="item in primaryNavigationGroups[1]?.items ?? []"
              :key="item.to"
              :to="item.to"
              class="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-canvas px-3 text-sm font-medium text-ink transition hover:border-line-strong"
            >
              <component :is="item.icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
              {{ item.label }}
            </RouterLink>
          </nav>

          <section class="mt-5 border-t border-line pt-4">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
              Archived records
            </p>
            <nav aria-label="Mobile archived records" class="mt-2 grid grid-cols-2 gap-x-3">
              <RouterLink
                v-for="item in archiveNavigation"
                :key="item.to"
                :to="item.to"
                class="flex min-h-11 items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink"
              >
                <component :is="item.icon" :size="16" :stroke-width="1.8" aria-hidden="true" />
                {{ item.label }}
              </RouterLink>
            </nav>
          </section>

          <div class="mt-4 border-t border-line pt-4">
            <RouterLink
              v-if="currentUser"
              to="/profile"
              data-mobile-account-link
              class="flex min-h-14 items-center gap-3 rounded-xl bg-brand-strong px-3 py-2 text-white"
            >
              <span
                class="font-figure flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-semibold tracking-[0.08em] text-white"
                aria-hidden="true"
              >
                {{ accountInitials }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold">{{ currentUser.fullName }}</span>
                <span class="mt-0.5 block truncate text-xs text-white/55">
                  {{ currentUser.email }}
                </span>
              </span>
              <span class="text-xs font-medium text-white/65">Profile</span>
            </RouterLink>

            <button
              type="button"
              class="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
              @click="logout"
            >
              <LogOut :size="17" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </DialogContent>
      </DialogRoot>
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
