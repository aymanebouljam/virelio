<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Building2,
  ChartNoAxesCombined,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  ReceiptText,
  Repeat2,
  Tags,
  X,
} from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import { ApiError } from '@/lib/api'
import ConfirmationDialog from '@/components/ui/ConfirmationDialog.vue'
import { resendEmailVerification } from '@/lib/auth/api'
import { clearAccessToken, currentUser, isAuthenticated } from '@/lib/auth/storage'
import { getInitials } from '@/lib/helpers'

const route = useRoute()
const router = useRouter()
const mobileMoreOpen = ref(false)
const resendingVerification = ref(false)
const verificationEmailSent = ref(false)
const verificationResendError = ref('')
const accountInitials = computed(() => getInitials(currentUser.value?.fullName ?? ''))
const usesWorkspaceShell = computed(
  () =>
    isAuthenticated.value &&
    route.path !== '/verify-email' &&
    route.path !== '/resend-verification' &&
    route.path !== '/reset-password',
)

const primaryNavigationGroups = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Expense records',
    items: [
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

const organizationNavigation =
  primaryNavigationGroups.find((group) => group.label === 'Organization')?.items ?? []

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

async function handleUnauthorized() {
  await router.push({ path: '/login', query: { redirect: route.fullPath } })
}

async function resendVerificationEmail() {
  if (!currentUser.value) return

  verificationResendError.value = ''
  resendingVerification.value = true

  try {
    await resendEmailVerification({ email: currentUser.value.email })
    verificationEmailSent.value = true
  } catch (error) {
    verificationResendError.value =
      error instanceof ApiError ? error.message : 'Something went wrong while sending the email'
  } finally {
    resendingVerification.value = false
  }
}

watch(
  () => route.fullPath,
  () => {
    mobileMoreOpen.value = false
  },
)

onMounted(() => {
  window.addEventListener('auth:unauthorized', handleUnauthorized)
})

onBeforeUnmount(() => {
  window.removeEventListener('auth:unauthorized', handleUnauthorized)
})
</script>

<template>
  <div class="min-h-screen bg-canvas text-ink">
    <div v-if="usesWorkspaceShell" class="min-h-screen lg:flex">
      <aside
        data-workspace-index
        class="hidden border-r border-line bg-surface-raised lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-62 lg:shrink-0 lg:flex-col"
      >
        <div class="flex items-center gap-1 border-b border-line px-6 py-6">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg">
            <img src="/logo-mark.svg" alt="" class="size-10" />
          </span>
          <div>
            <p class="text-[10px] font-semibold leading-none tracking-[0.12em] text-evidence">
              Evidence ledger
            </p>
            <p class="font-display mt-0 text-xl font-semibold leading-none tracking-tight text-ink">
              Virelio
            </p>
          </div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col">
          <div
            data-sidebar-scroll-region
            class="px-4 pb-2 pt-5 lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:scrollbar-none lg:[&::-webkit-scrollbar]:hidden"
          >
            <nav aria-label="Primary navigation" class="space-y-6">
              <section v-for="group in primaryNavigationGroups" :key="group.label">
                <p class="px-3 text-[10px] font-medium tracking-widest text-ink-muted">
                  {{ group.label }}
                </p>
                <div class="mt-1.5 space-y-0.5">
                  <RouterLink
                    v-for="item in group.items"
                    :key="item.to"
                    :to="item.to"
                    :aria-current="isSectionActive(item.to) ? 'page' : undefined"
                    class="relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition"
                    :class="
                      isSectionActive(item.to)
                        ? 'bg-brand-soft text-brand-strong'
                        : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
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
          </div>

          <div class="border-t border-line px-4 py-4">
            <RouterLink
              v-if="currentUser"
              to="/profile"
              aria-label="Profile settings"
              data-account-link
              class="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-surface-muted"
              active-class="bg-brand-soft hover:bg-brand-soft"
            >
              <span
                data-account-initials
                class="font-figure flex size-9 shrink-0 items-center justify-center rounded-full bg-evidence text-sm font-semibold tracking-[0.04em] text-white"
                aria-hidden="true"
              >
                {{ accountInitials }}
              </span>
              <span class="min-w-0">
                <span class="block truncate text-sm font-semibold text-ink">
                  {{ currentUser.fullName }}
                </span>
                <span class="mt-0.5 block truncate text-xs text-ink-muted">
                  {{ currentUser.email }}
                </span>
              </span>
            </RouterLink>

            <button
              type="button"
              class="mt-2 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink"
              @click="logout"
            >
              <LogOut :size="17" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <header
        data-mobile-workspace-bar
        class="fixed inset-x-0 top-0 z-30 flex min-h-14 items-center border-b border-line bg-surface/95 px-5 text-ink backdrop-blur lg:hidden"
      >
        <RouterLink to="/" class="flex items-center gap-1" aria-label="Virelio dashboard">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg">
            <img src="/logo-mark.svg" alt="" class="size-9" />
          </span>
          <span>
            <span
              class="block text-[9px] font-semibold leading-none tracking-[0.12em] text-evidence"
            >
              Evidence ledger
            </span>
            <span class="font-display mt-px block text-base font-semibold leading-none text-ink">
              Virelio
            </span>
          </span>
        </RouterLink>
      </header>

      <main
        id="main-content"
        tabindex="-1"
        class="min-w-0 flex-1 bg-canvas px-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-18 sm:px-7 sm:pt-21 lg:px-10 lg:py-10"
      >
        <div class="mx-auto w-full max-w-7xl">
          <section
            v-if="currentUser?.emailVerifiedAt === null"
            data-email-verification-reminder
            role="status"
            class="mb-6 flex flex-col gap-3 rounded-xl border border-evidence/25 bg-evidence-soft px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between"
          >
            <p>
              Your new email address needs verification. Check your inbox to keep your workspace
              details up to date.
            </p>
            <div class="flex shrink-0 flex-col items-start gap-1 sm:items-end">
              <button
                type="button"
                :disabled="resendingVerification"
                class="shrink-0 font-semibold text-brand underline-offset-4 hover:text-brand-strong hover:underline"
                @click="resendVerificationEmail"
              >
                {{ resendingVerification ? 'Sending email...' : 'Resend email' }}
              </button>
              <p v-if="verificationEmailSent" role="status" class="text-success">Email sent</p>
              <p v-if="verificationResendError" role="alert" class="text-danger">
                {{ verificationResendError }}
              </p>
            </div>
          </section>

          <RouterView />
        </div>
      </main>

      <DialogRoot v-model:open="mobileMoreOpen">
        <nav
          aria-label="Mobile navigation"
          class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 shadow-[0_-8px_24px_rgba(31,43,66,0.08)] backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <RouterLink
            v-for="item in mobileNavigation"
            :key="item.to"
            :to="item.to"
            :aria-current="isSectionActive(item.to) ? 'page' : undefined"
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
              aria-label="More navigation"
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
          class="fixed inset-x-3 bottom-0 z-50 max-h-[85dvh] min-w-0 overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-surface px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_48px_rgba(31,43,66,0.2)] focus:outline-none sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-xl sm:-translate-x-1/2"
        >
          <div class="mx-auto h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />
          <div class="mt-4 flex min-w-0 items-start justify-between gap-4">
            <div class="min-w-0">
              <DialogTitle
                class="font-display wrap-break-word text-xl font-semibold tracking-tight text-ink"
              >
                More
              </DialogTitle>
              <DialogDescription class="mt-1 wrap-break-word text-sm text-ink-muted">
                Organization and account settings.
              </DialogDescription>
            </div>
            <DialogClose
              class="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-line-strong hover:text-ink"
              aria-label="Close more menu"
              title="Close more menu"
            >
              <X :size="19" aria-hidden="true" />
            </DialogClose>
          </div>

          <nav
            aria-label="More navigation"
            class="mt-5 grid grid-cols-1 gap-2 min-[375px]:grid-cols-2"
          >
            <RouterLink
              v-for="item in organizationNavigation"
              :key="item.to"
              :to="item.to"
              class="flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-line bg-canvas px-3 text-sm font-medium text-ink transition hover:border-line-strong"
            >
              <component :is="item.icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
              <span class="min-w-0 wrap-break-word">{{ item.label }}</span>
            </RouterLink>
          </nav>

          <div class="mt-4 border-t border-line pt-4">
            <RouterLink
              v-if="currentUser"
              to="/profile"
              data-mobile-account-link
              class="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface-raised px-3 py-2 text-ink"
            >
              <span
                class="font-figure flex size-9 shrink-0 items-center justify-center rounded-full bg-evidence text-sm font-semibold tracking-[0.04em] text-white"
                aria-hidden="true"
              >
                {{ accountInitials }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold">{{ currentUser.fullName }}</span>
                <span class="mt-0.5 block truncate text-xs text-ink-muted">
                  {{ currentUser.email }}
                </span>
              </span>
              <span class="text-xs font-medium text-ink-muted">Profile</span>
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
    <ConfirmationDialog />
  </div>
</template>
