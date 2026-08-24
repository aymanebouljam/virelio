import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EvidenceLedgerRow from '@/components/ui/EvidenceLedgerRow.vue'
import LedgerSurface from '@/components/ui/LedgerSurface.vue'
import WorkspaceHeader from '@/components/ui/WorkspaceHeader.vue'

describe('ledger design system', () => {
  it('keeps page context optional and reserves actions for page-level controls', () => {
    const wrapper = mount(WorkspaceHeader, {
      props: {
        context: 'Ledger',
        title: 'Expenses',
        description: 'Every recorded cost in one place.',
      },
      slots: {
        actions: '<button type="button">Add expense</button>',
      },
    })

    expect(wrapper.text()).toContain('Ledger')
    expect(wrapper.get('h1').text()).toBe('Expenses')
    expect(wrapper.get('button').text()).toBe('Add expense')
    expect(wrapper.get('p').classes()).not.toContain('uppercase')
  })

  it('uses restrained surfaces and an evidence spine for record rows', () => {
    const surface = mount(LedgerSurface, {
      props: { tone: 'featured' },
      slots: { default: 'Total spend' },
    })
    const row = mount(EvidenceLedgerRow, {
      props: { tone: 'evidence' },
      slots: {
        title: '<p>Office supplies</p>',
        amount: '<p>$120.00</p>',
        metadata: '<p>Atlas · 12 Aug</p>',
      },
    })

    expect(surface.classes()).toContain('bg-brand-strong')
    expect(surface.classes()).toContain('rounded-xl')
    expect(row.get('[aria-hidden="true"] span').classes()).toContain('bg-evidence')
    expect(row.text()).toContain('Atlas · 12 Aug')
  })
})
