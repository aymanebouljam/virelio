import {
  createMemoryHistory,
  createRouter,
  type RouteLocationRaw,
  type RouteRecordRaw,
} from 'vue-router'

export async function createTestRouter(
  routes: RouteRecordRaw[],
  initialRoute: RouteLocationRaw = '/',
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  })

  await router.push(initialRoute)
  await router.isReady()

  return router
}
