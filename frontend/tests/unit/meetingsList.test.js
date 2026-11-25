import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  showModal: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}))

vi.mock('frappe-ui', () => ({
  call: mocks.call,
  toast: { warning: mocks.warning, error: mocks.error },
}))
vi.mock('@/composables/doctypeModal', () => ({
  useDoctypeModal: () => ({ showModal: mocks.showModal }),
}))

const Button = defineComponent({
  props: ['label', 'loading'],
  setup: (props, { attrs }) => () =>
    h('button', { ...attrs, disabled: props.loading }, props.label),
})

describe('MeetingsList organization defaults', () => {
  let app
  let root

  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.__ = (text) => text
    mocks.call.mockResolvedValue([])
    root = document.createElement('div')
    document.body.appendChild(root)
  })

  afterEach(() => {
    app?.unmount()
    root.remove()
  })

  async function open(props) {
    const { default: MeetingsList } = await import('@/components/MeetingsList.vue')
    app = createApp(MeetingsList, props)
    app.config.globalProperties.__ = globalThis.__
    // Button is registered globally in the CRM application.
    // eslint-disable-next-line vue/no-reserved-component-names
    app.component('Button', Button)
    app.mount(root)
    await nextTick()
    root.querySelector('button').click()
    await vi.waitFor(() => expect(mocks.showModal).toHaveBeenCalled())
    return mocks.showModal.mock.calls[0][0].defaults
  }

  it('uses the linked deal organization without a lookup', async () => {
    const defaults = await open({
      referenceDoctype: 'CRM Deal',
      referenceName: 'DEAL-1',
      referenceOrganization: 'ORG-1',
    })
    expect(defaults).toEqual({ deal: 'DEAL-1', organization: 'ORG-1' })
    expect(mocks.call).toHaveBeenCalledTimes(1)
  })

  it('looks up the exact lead organization and uses its document name', async () => {
    mocks.call.mockImplementation(async (_method, params) =>
      params.doctype === 'CRM Organization' ? [{ name: 'ORG-1' }] : [],
    )
    const defaults = await open({
      referenceDoctype: 'CRM Lead',
      referenceName: 'LEAD-1',
      referenceOrganization: 'Company',
    })
    expect(defaults).toEqual({ lead: 'LEAD-1', organization: 'ORG-1' })
    expect(mocks.call).toHaveBeenCalledWith(
      'frappe.client.get_list',
      expect.objectContaining({
        doctype: 'CRM Organization',
        filters: { organization_name: 'Company' },
        limit_page_length: 2,
      }),
    )
  })

  it.each([[[]], [[{ name: 'ONE' }, { name: 'TWO' }]]])(
    'warns and leaves the organization blank for non-unique matches',
    async (matches) => {
      mocks.call.mockImplementation(async (_method, params) =>
        params.doctype === 'CRM Organization' ? matches : [],
      )
      const defaults = await open({
        referenceDoctype: 'CRM Lead',
        referenceName: 'LEAD-1',
        referenceOrganization: 'Company',
      })
      expect(defaults).toEqual({ lead: 'LEAD-1' })
      expect(mocks.warning).toHaveBeenCalledOnce()
    },
  )

  it('reports lookup errors and still permits manual selection', async () => {
    mocks.call.mockImplementation(async (_method, params) => {
      if (params.doctype === 'CRM Organization') throw new Error('unavailable')
      return []
    })
    const defaults = await open({
      referenceDoctype: 'CRM Lead',
      referenceName: 'LEAD-1',
      referenceOrganization: 'Company',
    })
    expect(defaults).toEqual({ lead: 'LEAD-1' })
    expect(mocks.error).toHaveBeenCalledOnce()
  })
})
