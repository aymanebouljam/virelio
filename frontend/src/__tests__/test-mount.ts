import { mount } from '@vue/test-utils'
import type { Component } from 'vue'
import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router'
import { createTestRouter } from './test-router'

export async function mountWithRouter(
  component: Component,
  routes: RouteRecordRaw[],
  initialRoute: RouteLocationRaw = '/',
) {
  const router = await createTestRouter(routes, initialRoute)
  const wrapper = mount(component, {
    global: {
      plugins: [router],
    },
  })

  return { router, wrapper }
}
