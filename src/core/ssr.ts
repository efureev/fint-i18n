import { toRaw } from 'vue'
import type { FintI18n } from './instance'
import type { Locale, MessageSchema } from './types'

/**
 * Снимок загруженного состояния для переноса с сервера на клиент.
 *
 * Локаль в снимок не входит намеренно: её выбирает приложение и передаёт
 * в `createFintI18n()` на обеих сторонах. Класть её сюда значило бы иметь
 * два источника правды об одном и том же.
 */
export interface FintI18nSSRState {
  /** Словари по локалям — ровно то, что успело загрузиться на сервере. */
  messages: Record<Locale, MessageSchema>
  /** Имена фактически загруженных блоков: клиент не станет грузить их повторно. */
  blocks: Record<Locale, string[]>
}

export interface SSRStateOptions {
  /** Ограничить снимок этими локалями. По умолчанию — все загруженные. */
  locales?: Locale[]
}

function collectFunctionPaths(value: unknown, path: string, into: string[]): void {
  if (typeof value === 'function') {
    into.push(path)
    return
  }

  if (!value || typeof value !== 'object') return

  for (const key in value) {
    collectFunctionPaths((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key, into)
  }
}

/**
 * Снять состояние на сервере — обычно перед отдачей HTML.
 *
 * Возвращается обычный объект, а не строка: у каждого фреймворка свой способ
 * доставки полезной нагрузки. Сериализуя его в HTML вручную, экранируйте
 * `<` — иначе перевод, содержащий `</script>`, закроет тег.
 */
export function getSSRState(i18n: FintI18n, options: SSRStateOptions = {}): FintI18nSSRState {
  // `messages` — это `readonly(reactive(...))`. Чтение через прокси стоит на
  // порядки дороже: 11.7 мс против 0.24 мс на 20k ключей. `toRaw` разворачивает
  // обёртки рекурсивно и отдаёт исходное дерево из обычных объектов.
  const raw = toRaw(i18n.messages) as Record<Locale, MessageSchema>
  const loaded = i18n.getLoadedBlocks()

  const wanted = options.locales ?? Object.keys(raw)
  const messages: Record<Locale, MessageSchema> = {}
  const blocks: Record<Locale, string[]> = {}

  for (const locale of wanted) {
    if (raw[locale]) messages[locale] = raw[locale]
    if (loaded[locale]) blocks[locale] = loaded[locale]
  }

  // Сообщения-функции переживут `JSON.stringify` только исчезновением, а блок
  // при этом останется помеченным загруженным — на клиенте ключ пропадёт молча.
  const functionPaths: string[] = []
  for (const locale in messages) {
    collectFunctionPaths(messages[locale], locale, functionPaths)
  }

  if (functionPaths.length > 0) {
    console.warn(
      `[fint-i18n] SSR state contains message functions, which JSON cannot carry: ${functionPaths.join(', ')}. `
      + 'Use plain strings in blocks that are hydrated, or exclude those locales from the snapshot.',
    )
  }

  return { messages, blocks }
}

/**
 * Применить снимок на клиенте — до монтирования приложения.
 *
 * Блоки помечаются загруженными, поэтому `useI18nScope` и `loadBlock()` для них
 * уже не сходят в сеть.
 */
export function hydrate(i18n: FintI18n, state: FintI18nSSRState): void {
  for (const locale in state.messages) {
    const tree = state.messages[locale]

    for (const blockName in tree) {
      i18n.mergeMessages(locale, blockName, tree[blockName] as MessageSchema)
    }
  }

  for (const locale in state.blocks) {
    for (const blockName of state.blocks[locale]) {
      i18n.markBlockLoaded(blockName, locale)
    }
  }
}
