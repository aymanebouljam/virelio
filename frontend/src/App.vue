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

        <nav class="mt-8 flex gap-2 lg:flex-col">
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
        </nav>
      </aside>

      <main class="flex-1 px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <RouterView />
      </main>
    </div>
  </div>
</template>
