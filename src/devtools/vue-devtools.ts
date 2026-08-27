import type { App } from 'vue'
import type { Locale } from '../core'
import type { DictionaryEntry, FintI18nDevtools } from './types'

const PLUGIN_ID = 'org.feugene.fint-i18n'
const INSPECTOR_ID = 'fint-i18n'
const LAYER_ID = 'fint-i18n'
const LAYER_COLOR = 0x8AB4FF
/** Сколько ключей показывать под блоком: дерево расширения не рассчитано на тысячи узлов. */
const KEYS_PER_BLOCK = 50

const MISSING_PACKAGE = '[fint-i18n] Vue Devtools integration needs `@vue/devtools-api`. '
  + 'Install it as a dev dependency (`yarn add -D @vue/devtools-api`) or use the in-app overlay instead.'

type Node = { id: string, label: string, tags?: { label: string, textColor: number, backgroundColor: number }[], children?: Node[] }

const TAG_LOADED = { label: 'loaded', textColor: 0x0F1116, backgroundColor: 0x6EE7A0 }
const TAG_FAILED = { label: 'failed', textColor: 0xFFFFFF, backgroundColor: 0xF08A8A }
const TAG_MISS = { label: 'miss', textColor: 0xFFFFFF, backgroundColor: 0xF08A8A }

/**
 * Мост к расширению Vue Devtools.
 *
 * Единственное, чего не может дать панель из этапа 2, — связь с деревом
 * компонентов: «какие блоки просит вот этот компонент». Всё остальное здесь
 * дублирует оверлей, и это нормально: кто живёт в расширении, не должен уходить
 * из него ради i18n.
 *
 * `@vue/devtools-api` — необязательная peer-зависимость и грузится динамически.
 * Нет пакета — предупреждение с инструкцией и `false`, а не исключение: этапы
 * 1–3 работают без него полностью.
 */
export async function connectVueDevtools(app: App, devtools: FintI18nDevtools): Promise<boolean> {
  let setupDevtoolsPlugin: (descriptor: any, setup: (api: any) => void) => void

  try {
    ({ setupDevtoolsPlugin } = await import('@vue/devtools-api'))
  }
  catch {
    console.warn(MISSING_PACKAGE)
    return false
  }

  setupDevtoolsPlugin(
    {
      id: PLUGIN_ID,
      label: 'fint-i18n',
      packageName: '@feugene/fint-i18n',
      homepage: 'https://github.com/efureev/fint-i18n',
      app,
      componentStateTypes: ['fint-i18n'],
      // Флаг из v6-API. В v8 буферизация плагинов встроена, и он там не
      // используется вовсе (`enableEarlyProxy` — 0 вхождений в реализации
      // `@vue/devtools-kit`), но диапазон peer-зависимости шире v8, а вреда
      // от него нет.
      enableEarlyProxy: true,
    },
    (api) => {
      api.addInspector({
        id: INSPECTOR_ID,
        label: 'fint-i18n',
        icon: 'translate',
        treeFilterPlaceholder: 'Filter blocks and keys…',
      })

      api.addTimelineLayer({ id: LAYER_ID, label: 'fint-i18n', color: LAYER_COLOR })

      api.on.getInspectorTree((payload: any) => {
        if (payload.inspectorId !== INSPECTOR_ID) return

        payload.rootNodes = buildTree(devtools, payload.filter ?? '')
      })

      api.on.getInspectorState((payload: any) => {
        if (payload.inspectorId !== INSPECTOR_ID) return

        payload.state = buildState(devtools, payload.nodeId)
      })

      api.on.editInspectorState((payload: any) => {
        if (payload.inspectorId !== INSPECTOR_ID) return

        const parsed = parseKeyNode(payload.nodeId)
        if (!parsed) return

        devtools.actions.patchMessage(parsed.locale, parsed.key, String(payload.state.value))
        api.sendInspectorState(INSPECTOR_ID)
      })

      api.on.inspectComponent((payload: any) => {
        const tracked = devtools.componentBlocks(payload.componentInstance)
        if (!tracked) return

        payload.instanceData.state.push({
          type: 'fint-i18n',
          key: 'blocks',
          value: tracked.blocks,
          editable: false,
        })
      })

      devtools.subscribe((event) => {
        api.addTimelineEvent({
          layerId: LAYER_ID,
          event: {
            time: event.at,
            title: event.type,
            data: (event.payload ?? {}) as Record<string, unknown>,
            logType: event.type === 'error' ? 'error' : (event.type === 'warning' || event.type === 'retry' ? 'warning' : 'default'),
          },
        })

        // Дерево инспектора не обновляется само — расширение перезапрашивает
        // его только по этому сигналу.
        api.sendInspectorTree(INSPECTOR_ID)
        api.sendInspectorState(INSPECTOR_ID)
      })
    },
  )

  return true
}

function matches(value: string, filter: string): boolean {
  return !filter || value.toLowerCase().includes(filter.toLowerCase())
}

export function buildTree(devtools: FintI18nDevtools, filter: string): Node[] {
  const snapshot = devtools.snapshot()

  const locales: Node[] = snapshot.availableLocales
    .filter(locale => matches(locale, filter))
    .map(locale => ({
      id: `locale:${locale}`,
      label: locale,
      tags: locale === snapshot.locale ? [{ label: 'current', textColor: 0x0F1116, backgroundColor: 0x8AB4FF }] : [],
    }))

  // Ключи собираются один раз на всё дерево: словарь большой, а блоков много.
  const dictionary = devtools.dictionary()

  const blocks: Node[] = snapshot.blocks
    .filter(block => matches(`${block.block} ${block.locale}`, filter))
    .map(block => ({
      id: `block:${block.locale}:${block.block}`,
      label: `${block.block} · ${block.locale}`,
      tags: block.status === 'failed' ? [TAG_FAILED] : (block.status === 'loaded' ? [TAG_LOADED] : []),
      children: keysOf(dictionary, block.block, block.locale, filter),
    }))

  const misses: Node[] = snapshot.missingKeys
    .filter(miss => matches(miss.key, filter))
    .map(miss => ({
      id: `miss:${miss.locale}:${miss.key}`,
      label: `${miss.key} · ${miss.locale}`,
      tags: [TAG_MISS],
    }))

  return [
    { id: 'instance', label: snapshot.name, children: [] },
    { id: 'locales', label: `locales (${locales.length})`, children: locales },
    { id: 'blocks', label: `blocks (${blocks.length})`, children: blocks },
    { id: 'misses', label: `missing (${misses.length})`, children: misses },
  ]
}

/** Ключ принадлежит блоку, если это сам блок либо что-то под ним. */
function keysOf(dictionary: DictionaryEntry[], block: string, locale: Locale, filter: string): Node[] {
  const prefix = `${block}.`

  return dictionary
    .filter(entry => entry.key === block || entry.key.startsWith(prefix))
    .filter(entry => entry.values[locale] !== undefined)
    .filter(entry => matches(entry.key, filter))
    .slice(0, KEYS_PER_BLOCK)
    .map(entry => ({ id: `key:${locale}:${entry.key}`, label: entry.key.slice(prefix.length) || entry.key }))
}

function parseKeyNode(nodeId: string): { locale: Locale, key: string } | null {
  if (!nodeId.startsWith('key:')) return null

  const [locale, ...rest] = nodeId.slice('key:'.length).split(':')

  return { locale, key: rest.join(':') }
}

export function buildState(devtools: FintI18nDevtools, nodeId: string): Record<string, { key: string, value: unknown, editable?: boolean }[]> {
  const snapshot = devtools.snapshot()
  const field = (key: string, value: unknown) => ({ key, value })

  if (nodeId === 'instance') {
    return {
      instance: [
        field('version', snapshot.version),
        field('locale', snapshot.locale),
        field('fallbackLocale', snapshot.fallbackLocale || null),
        field('plugins', snapshot.plugins ?? 'unavailable'),
        field('options', snapshot.options ?? 'unavailable'),
        field('disposed', snapshot.disposed),
      ],
    }
  }

  if (nodeId.startsWith('locale:')) {
    const locale = nodeId.slice('locale:'.length)

    return {
      locale: [
        field('locale', locale),
        field('current', locale === snapshot.locale),
        field('blocks', snapshot.loadedBlocks[locale] ?? []),
        field('keys', snapshot.messages[locale] ?? {}),
        field('compiled', snapshot.compiled?.[locale] ?? 'unavailable'),
      ],
    }
  }

  if (nodeId.startsWith('block:')) {
    const [locale, ...rest] = nodeId.slice('block:'.length).split(':')
    const name = rest.join(':')
    const block = snapshot.blocks.find(entry => entry.locale === locale && entry.block === name)
    if (!block) return {}

    return {
      block: [
        field('block', block.block),
        field('locale', block.locale),
        field('status', block.status),
        field('loadedAs', block.resolvedAs ?? block.block),
        field('duration', block.duration ?? 'unknown'),
        field('uses', snapshot.usage[block.block] ?? 0),
        field('error', block.error ?? null),
      ],
    }
  }

  const keyNode = parseKeyNode(nodeId)
  if (keyNode) {
    const entry = devtools.dictionary().find(candidate => candidate.key === keyNode.key)
    if (!entry) return {}

    // `editable: false` у наборов форм и функций: строка заменила бы их целиком.
    return {
      message: Object.entries(entry.values).map(([locale, value]) => ({
        key: locale,
        value,
        editable: entry.editable,
      })),
    }
  }

  if (nodeId.startsWith('miss:')) {
    const [locale, ...rest] = nodeId.slice('miss:'.length).split(':')
    const key = rest.join(':')
    const miss = snapshot.missingKeys.find(entry => entry.locale === locale && entry.key === key)
    if (!miss) return {}

    return { missing: [field('key', miss.key), field('locale', miss.locale), field('seen', miss.count)] }
  }

  return {}
}
