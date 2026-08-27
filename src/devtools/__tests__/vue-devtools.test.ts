/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createApp, defineComponent } from 'vue'
import { createFintI18n } from '../../core'
import { installI18n } from '../../vue'
import { connectVueDevtools, createDevtools } from '../index'

const hoisted = vi.hoisted(() => ({
  captured: {
    descriptor: null as any,
    inspectors: [] as any[],
    layers: [] as any[],
    events: [] as any[],
    treeSent: 0,
    on: {} as Record<string, (payload: any) => void>,
  },
}))

vi.mock('@vue/devtools-api', () => ({
  setupDevtoolsPlugin(descriptor: any, setup: (api: any) => void) {
    hoisted.captured.descriptor = descriptor

    setup({
      addInspector: (options: any) => hoisted.captured.inspectors.push(options),
      addTimelineLayer: (options: any) => hoisted.captured.layers.push(options),
      addTimelineEvent: (options: any) => hoisted.captured.events.push(options),
      sendInspectorTree: () => { hoisted.captured.treeSent++ },
      sendInspectorState: () => {},
      on: {
        getInspectorTree: (fn: any) => { hoisted.captured.on.tree = fn },
        getInspectorState: (fn: any) => { hoisted.captured.on.state = fn },
        editInspectorState: (fn: any) => { hoisted.captured.on.edit = fn },
        inspectComponent: (fn: any) => { hoisted.captured.on.component = fn },
      },
    })
  },
}))

function reset() {
  hoisted.captured.descriptor = null
  hoisted.captured.inspectors = []
  hoisted.captured.layers = []
  hoisted.captured.events = []
  hoisted.captured.treeSent = 0
  hoisted.captured.on = {}
}

async function setup() {
  reset()

  const devtools = createDevtools(undefined, { bridge: false })
  const i18n = createFintI18n({
    locale: 'en',
    plugins: [devtools],
    loaders: { en: { common: async () => ({ hello: 'Hello' }) }, ru: {} },
  })
  const app = createApp(defineComponent({ render: () => null }))

  const connected = await connectVueDevtools(app, devtools)

  return { devtools, i18n, connected }
}

describe('мост к Vue Devtools', () => {
  it('регистрирует плагин, инспектор и слой ленты', async () => {
    const { connected } = await setup()

    expect(connected).toBe(true)
    expect(hoisted.captured.descriptor).toMatchObject({
      id: 'org.feugene.fint-i18n',
      packageName: '@feugene/fint-i18n',
      componentStateTypes: ['fint-i18n'],
      // Флаг v6-API: в v8 не используется, но диапазон peer-зависимости шире.
      enableEarlyProxy: true,
    })
    expect(hoisted.captured.inspectors[0]).toMatchObject({ id: 'fint-i18n' })
    expect(hoisted.captured.layers[0]).toMatchObject({ id: 'fint-i18n' })
  })

  it('строит дерево из локалей, блоков и промахов', async () => {
    const { i18n } = await setup()

    await i18n.loadBlock('common')
    i18n.t('common.nope')

    const payload = { inspectorId: 'fint-i18n', filter: '', rootNodes: [] as any[] }
    hoisted.captured.on.tree(payload)

    const sections = payload.rootNodes.map(node => node.id)
    expect(sections).toEqual(['instance', 'locales', 'blocks', 'misses'])

    const blocks = payload.rootNodes.find(node => node.id === 'blocks')
    expect(blocks.children[0]).toMatchObject({ id: 'block:en:common', label: 'common · en' })
    expect(blocks.children[0].tags[0].label).toBe('loaded')

    const misses = payload.rootNodes.find(node => node.id === 'misses')
    expect(misses.children[0]).toMatchObject({ id: 'miss:en:common.nope' })
  })

  it('вешает ключи блока детьми — дерево доходит до сообщений', async () => {
    const { i18n } = await setup()
    await i18n.loadBlock('common')

    const payload = { inspectorId: 'fint-i18n', filter: '', rootNodes: [] as any[] }
    hoisted.captured.on.tree(payload)

    const block = payload.rootNodes.find(node => node.id === 'blocks').children[0]
    expect(block.children).toEqual([{ id: 'key:en:common.hello', label: 'hello' }])
  })

  it('правит перевод прямо из расширения', async () => {
    const { i18n } = await setup()
    await i18n.loadBlock('common')

    hoisted.captured.on.edit({
      inspectorId: 'fint-i18n',
      nodeId: 'key:en:common.hello',
      path: ['en'],
      state: { value: 'Edited' },
    })

    expect(i18n.t('common.hello')).toBe('Edited')
  })

  it('состояние ключа даёт значения по локалям и признак редактируемости', async () => {
    const { i18n } = await setup()
    await i18n.loadBlock('common')
    i18n.mergeMessages('en', 'cart', { items: { one: '{n} item', other: '{n} items' } })
    i18n.t('cart.items', { n: 1 })

    const text = { inspectorId: 'fint-i18n', nodeId: 'key:en:common.hello', state: {} as any }
    hoisted.captured.on.state(text)
    expect(text.state.message).toEqual([{ key: 'en', value: 'Hello', editable: true }])

    // Набор форм строкой не заменить — поле только на чтение.
    const plural = { inspectorId: 'fint-i18n', nodeId: 'key:en:cart.items', state: {} as any }
    hoisted.captured.on.state(plural)
    expect(plural.state.message[0].editable).toBe(false)
  })

  it('фильтр дерева отсеивает узлы', async () => {
    const { i18n } = await setup()
    await i18n.loadBlock('common')

    const payload = { inspectorId: 'fint-i18n', filter: 'nothing', rootNodes: [] as any[] }
    hoisted.captured.on.tree(payload)

    expect(payload.rootNodes.find(node => node.id === 'blocks').children).toEqual([])
  })

  it('отдаёт состояние выбранного узла', async () => {
    const { i18n } = await setup()
    await i18n.loadBlock('common')

    const block = { inspectorId: 'fint-i18n', nodeId: 'block:en:common', state: {} as any }
    hoisted.captured.on.state(block)
    expect(block.state.block.map((field: any) => field.key)).toEqual(
      ['block', 'locale', 'status', 'loadedAs', 'duration', 'uses', 'error'],
    )

    const instance = { inspectorId: 'fint-i18n', nodeId: 'instance', state: {} as any }
    hoisted.captured.on.state(instance)
    expect(instance.state.instance.find((field: any) => field.key === 'locale').value).toBe('en')

    const unknown = { inspectorId: 'fint-i18n', nodeId: 'block:en:ghost', state: {} as any }
    hoisted.captured.on.state(unknown)
    expect(unknown.state).toEqual({})
  })

  it('не трогает чужие инспекторы', async () => {
    await setup()

    const payload = { inspectorId: 'somebody-else', filter: '', rootNodes: ['untouched'] as any[] }
    hoisted.captured.on.tree(payload)

    expect(payload.rootNodes).toEqual(['untouched'])
  })

  it('показывает блоки компонента в инспекторе компонентов', async () => {
    const { i18n } = await setup()

    const Component = defineComponent({
      name: 'AuthPanel',
      setup() {
        i18n.registerUsage('auth')
        return () => null
      },
    })
    const wrapper = mount(Component, {
      global: { plugins: [{ install: (app: any) => installI18n(app, i18n) }] },
    })

    const payload = {
      componentInstance: (wrapper.vm as any).$,
      instanceData: { state: [] as any[] },
    }
    hoisted.captured.on.component(payload)

    expect(payload.instanceData.state).toEqual([
      { type: 'fint-i18n', key: 'blocks', value: ['auth'], editable: false },
    ])

    // Компонент, ничего не просивший, полей не получает.
    const untracked = { componentInstance: {}, instanceData: { state: [] as any[] } }
    hoisted.captured.on.component(untracked)
    expect(untracked.instanceData.state).toEqual([])

    wrapper.unmount()
  })

  it('шлёт события ленты и просит расширение перечитать дерево', async () => {
    const { i18n } = await setup()

    await i18n.loadBlock('common')

    const types = hoisted.captured.events.map(entry => entry.event.title)
    expect(types).toContain('blockLoadStart')
    expect(types).toContain('blockLoadEnd')
    expect(hoisted.captured.events[0].layerId).toBe('fint-i18n')
    expect(hoisted.captured.treeSent).toBeGreaterThan(0)
  })

  it('помечает отказ как error в ленте', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { i18n } = await setup()

    i18n.addLoaders({ en: { bad: async () => { throw new Error('boom') } } })
    await expect(i18n.loadBlock('bad')).rejects.toThrow('boom')
    error.mockRestore()

    const failure = hoisted.captured.events.find(entry => entry.event.title === 'error')
    expect(failure.event.logType).toBe('error')
  })
})
