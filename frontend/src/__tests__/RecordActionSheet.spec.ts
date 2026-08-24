import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Archive, Pencil } from '@lucide/vue'
import RecordActionSheet from '@/components/ui/RecordActionSheet.vue'

describe('RecordActionSheet', () => {
  it('labels its close control and forwards the close event', async () => {
    const wrapper = mount(RecordActionSheet, {
      props: {
        open: true,
        recordLabel: 'A very long record label that should wrap in the sheet header',
        actions: [{ id: 'edit', label: 'Edit record', icon: Pencil }],
      },
      attachTo: document.body,
    })

    const closeButton = wrapper.get('button[aria-label="Close record actions"]')
    expect(closeButton.attributes('title')).toBe('Close record actions')

    await closeButton.trigger('click')

    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
  })

  it('closes before emitting the selected enabled action', async () => {
    const wrapper = mount(RecordActionSheet, {
      props: {
        open: true,
        recordLabel: 'Record',
        actions: [
          { id: 'edit', label: 'Edit record', icon: Pencil },
          { id: 'archive', label: 'Archive record', icon: Archive, disabled: true },
        ],
      },
      attachTo: document.body,
    })

    const editButton = wrapper.findAll('button').find((button) => button.text() === 'Edit record')
    if (!editButton) throw new Error('Edit record action not found')

    await editButton.trigger('click')

    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('select')).toEqual([['edit']])
    expect(wrapper.get('button[disabled]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
