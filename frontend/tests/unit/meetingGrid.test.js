import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

vi.mock('@/stores/meta', () => ({
  getMeta: () => ({
    getGridViewSettings: () => [],
    getFields: () => [{ fieldname: 'action_item', fieldtype: 'Data', label: 'Action', in_list_view: 1 }],
    getGridSettings: () => ({ editable_grid: true }),
  }),
}))
vi.mock('@/stores/users', () => ({
  usersStore: () => ({ users: { data: { crmUsers: [] } }, getUser: () => null }),
}))
vi.mock('vuedraggable', () => ({
  default: defineComponent({
    props: ['modelValue'],
    setup: (props, { slots }) => () =>
      h('div', props.modelValue.map((element, index) => slots.item({ element, index }))),
  }),
}))

describe('meeting grid rows', () => {
  let app
  let root

  afterEach(() => {
    app?.unmount()
    root?.remove()
  })

  it.each([[undefined], [[{ name: 'existing', action_item: 'Existing', idx: 1 }]]])(
    'immediately displays added rows and updates the parent model',
    async (initial) => {
      globalThis.__ = (text) => text
      const { default: Grid } = await import('@/components/Controls/Grid.vue')
      const rows = ref(initial)
      const onRowAdd = vi.fn()
      root = document.createElement('div')
      document.body.appendChild(root)
      app = createApp({
        setup() {
          return () => h(Grid, {
            doctype: 'CRM Meeting Action Item',
            parentDoctype: 'CRM Meeting Minutes',
            parentFieldname: 'action_items',
            modelValue: rows.value,
            'onUpdate:modelValue': (value) => { rows.value = value },
          })
        },
      })
      app.config.globalProperties.__ = globalThis.__
      app.provide('triggerOnRowAdd', onRowAdd)
      // Button is registered globally in the CRM application.
      // eslint-disable-next-line vue/no-reserved-component-names
      app.component('Button', defineComponent({
        props: ['label'],
        setup: (props, { attrs }) => () => h('button', attrs, props.label),
      }))
      app.mount(root)
      await nextTick()
      const count = initial?.length || 0
      Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Add Row').click()
      await nextTick()
      expect(rows.value).toHaveLength(count + 1)
      expect(root.querySelectorAll('.grid-row')).toHaveLength(count + 1)
      expect(rows.value[count]).toMatchObject({
        idx: count + 1,
        doctype: 'CRM Meeting Action Item',
        parentfield: 'action_items',
      })
      expect(onRowAdd).toHaveBeenCalledWith(rows.value[count])
    },
    30000,
  )
})
