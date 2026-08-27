import { toRaw } from 'vue'
import { clearFormatterCache, clearPluralCache } from '../core'
import type { FintI18n, Locale, MessageSchema } from '../core'
import type { MissingKeyState } from './types'

export interface DevtoolsActions {
  setLocale: (locale: Locale) => Promise<void>
  loadBlock: (block: string, locale?: Locale) => Promise<void>
  unloadBlock: (block: string, locale?: Locale) => void
  /** Выгрузить и загрузить заново — лоадер отработает повторно. */
  reloadBlock: (block: string, locale?: Locale) => Promise<void>
  /** Правка перевода на лету: ключ в dot-нотации, как в `t()`. */
  patchMessage: (locale: Locale, key: string, value: string) => void
  /** Инвалидировать кэш компиляции; без аргумента — во всех локалях. */
  clearCompiled: (locale?: Locale) => void
  clearFormatterCache: () => void
  clearPluralCache: () => void
  /** Заготовка словаря из промахов — готовый JSON-патч по локалям. */
  missingKeysPatch: () => Record<Locale, MessageSchema>
}

const isObject = (value: unknown): boolean => !!value && typeof value === 'object' && !Array.isArray(value)

/**
 * Имя, под которым блок фактически помечен загруженным. При восходящем
 * резолвинге `pages.articles` грузится лоадером `pages`, и выгружать нужно
 * именно `pages` — иначе `unloadBlock` молча ничего не сделает.
 */
function loadedAs(instance: FintI18n, block: string, locale: Locale): string {
  const loaded = instance.getLoadedBlocks()[locale] ?? []
  if (loaded.includes(block)) return block

  const path = block.split('.')
  for (let i = path.length - 1; i >= 1; i--) {
    const parent = path.slice(0, i).join('.')
    if (loaded.includes(parent)) return parent
  }

  return block
}

/** Плоские ключи промахов → дерево словаря с пустыми значениями. */
export function buildMissingKeysPatch(missing: readonly MissingKeyState[]): Record<Locale, MessageSchema> {
  const patch: Record<Locale, MessageSchema> = {}

  for (const { key, locale } of missing) {
    const path = key.split('.')
    let node = (patch[locale] ??= {}) as Record<string, any>

    for (let i = 0; i < path.length - 1; i++) {
      if (!isObject(node[path[i]])) node[path[i]] = {}
      node = node[path[i]]
    }

    node[path[path.length - 1]] ??= ''
  }

  return patch
}

export function createActions(instance: FintI18n, missing: () => readonly MissingKeyState[]): DevtoolsActions {
  const clearCompiled = (locale?: Locale) => {
    const raw = toRaw(instance.messages) as Record<Locale, MessageSchema>

    for (const current in raw) {
      if (locale !== undefined && current !== locale) continue

      // `mergeMessages` начинает с `invalidateCompiled()`, а домерживание
      // пустого объекта данных не меняет — публичного пути к инвалидации
      // больше нет. Лист-примитив дописывается сам собой: подсунуть ему `{}`
      // значило бы затереть сообщение объектом.
      for (const block in raw[current]) {
        const value = raw[current][block]
        instance.mergeMessages(current, block, isObject(value) ? {} : value)
      }
    }
  }

  return {
    setLocale: locale => instance.setLocale(locale),
    loadBlock: (block, locale) => instance.loadBlock(block, locale),
    unloadBlock: (block, locale) => instance.unloadBlock(block, locale),

    async reloadBlock(block, locale) {
      const targetLocale = locale ?? instance.locale.value

      instance.unloadBlock(loadedAs(instance, block, targetLocale), targetLocale)
      await instance.loadBlock(block, targetLocale)
    },

    patchMessage(locale, key, value) {
      const dot = key.indexOf('.')

      // `mergeMessages` принимает имя блока и поддерево, а не ключ целиком:
      // передать ему `common.hello` значило бы заменить строку объектом.
      if (dot === -1) {
        instance.mergeMessages(locale, key, value)
        return
      }

      const rest = key.slice(dot + 1).split('.')
      const tree: Record<string, any> = {}
      let node = tree

      for (let i = 0; i < rest.length - 1; i++) {
        node[rest[i]] = {}
        node = node[rest[i]]
      }
      node[rest[rest.length - 1]] = value

      instance.mergeMessages(locale, key.slice(0, dot), tree)
    },

    clearCompiled,
    clearFormatterCache,
    clearPluralCache,
    missingKeysPatch: () => buildMissingKeysPatch(missing()),
  }
}
