import type {
  Locale,
  LocaleBlockLoader,
  LocaleBlockLoaders,
  LocaleLoaderCollection,
  LocaleLoaderSource,
} from './types'

export interface ResolvedLocaleBlockLoaders {
  resolvedBlockName: string
  loaders: LocaleBlockLoader[]
}

type NormalizedLocaleLoaderCollection = Record<Locale, Record<string, LocaleBlockLoader[]>>

const PATTERN_DEEP_SUFFIX = '.**'
const PATTERN_SHALLOW_SUFFIX = '.*'

export function isBlockPattern(name: string): boolean {
  return name.endsWith(PATTERN_SHALLOW_SUFFIX) || name.endsWith(PATTERN_DEEP_SUFFIX)
}

export class LocaleLoaderRegistry {
  private readonly loaders: NormalizedLocaleLoaderCollection
  // Объединение всех имён блоков по всем локалям. Используется для O(N) развёртки
  // wildcard-паттернов без повторной итерации по каждой локали.
  private readonly knownBlockNames: string[]

  constructor(source?: LocaleLoaderSource) {
    this.loaders = this.normalize(source)
    this.knownBlockNames = this.collectKnownBlockNames(this.loaders)
  }

  public getKnownBlockNames(): readonly string[] {
    return this.knownBlockNames
  }

  /**
   * Развернуть wildcard-паттерн в список конкретных имён блоков.
   *
   * Поддерживаемые формы:
   *  - `prefix.*`  — все блоки, у которых после `prefix.` ровно один сегмент (без точек).
   *  - `prefix.**` — все блоки, начинающиеся с `prefix.` (любая глубина).
   *
   * Если паттерн некорректный или ничего не совпало — возвращается пустой массив.
   * Сам литерал родителя (`prefix`) в результат НЕ включается.
   */
  public expandPattern(pattern: string): string[] {
    const deep = pattern.endsWith(PATTERN_DEEP_SUFFIX)
    const shallow = !deep && pattern.endsWith(PATTERN_SHALLOW_SUFFIX)
    if (!deep && !shallow) return []

    const prefix = pattern.slice(0, -(deep ? PATTERN_DEEP_SUFFIX.length : PATTERN_SHALLOW_SUFFIX.length))
    if (!prefix) return []

    const needle = `${prefix}.`
    const needleLen = needle.length
    const result: string[] = []

    for (let i = 0; i < this.knownBlockNames.length; i++) {
      const name = this.knownBlockNames[i]
      if (name.length <= needleLen) continue
      // Быстрый префикс-чек без выделения подстроки.
      let matches = true
      for (let j = 0; j < needleLen; j++) {
        if (name.charCodeAt(j) !== needle.charCodeAt(j)) {
          matches = false
          break
        }
      }
      if (!matches) continue

      if (!deep) {
        // shallow `.*`: запрещаем точки в остатке имени.
        let hasDot = false
        for (let j = needleLen; j < name.length; j++) {
          if (name.charCodeAt(j) === 46 /* '.' */) {
            hasDot = true
            break
          }
        }
        if (hasDot) continue
      }

      result.push(name)
    }

    return result
  }

  public resolve(locale: Locale, blockName: string): ResolvedLocaleBlockLoaders | null {
    const localeLoaders = this.loaders[locale]
    if (!localeLoaders) return null

    if (localeLoaders[blockName]) {
      return {
        resolvedBlockName: blockName,
        loaders: localeLoaders[blockName],
      }
    }

    if (!blockName.includes('.')) {
      return null
    }

    const path = blockName.split('.')
    for (let i = path.length - 1; i >= 1; i--) {
      const parentBlockName = path.slice(0, i).join('.')
      const parentLoaders = localeLoaders[parentBlockName]

      if (parentLoaders) {
        return {
          resolvedBlockName: parentBlockName,
          loaders: parentLoaders,
        }
      }
    }

    return null
  }

  private normalize(source?: LocaleLoaderSource): NormalizedLocaleLoaderCollection {
    const normalized = Object.create(null) as NormalizedLocaleLoaderCollection
    if (!source) return normalized

    const collections = Array.isArray(source) ? source : [source]
    for (const collection of collections) {
      this.mergeCollection(normalized, collection)
    }

    return normalized
  }

  private mergeCollection(
    target: NormalizedLocaleLoaderCollection,
    collection: LocaleLoaderCollection,
  ): void {
    for (const locale in collection) {
      if (!target[locale]) {
        target[locale] = Object.create(null)
      }

      const localeEntries = collection[locale]
      for (const blockName in localeEntries) {
        const normalizedEntry = this.normalizeEntry(localeEntries[blockName])

        if (!target[locale][blockName]) {
          target[locale][blockName] = normalizedEntry
          continue
        }

        target[locale][blockName] = [
          ...target[locale][blockName],
          ...normalizedEntry,
        ]
      }
    }
  }

  private normalizeEntry(entry: LocaleBlockLoaders): LocaleBlockLoader[] {
    return Array.isArray(entry) ? entry : [entry]
  }

  private collectKnownBlockNames(loaders: NormalizedLocaleLoaderCollection): string[] {
    const set = new Set<string>()
    for (const locale in loaders) {
      const entries = loaders[locale]
      for (const blockName in entries) {
        set.add(blockName)
      }
    }
    return Array.from(set)
  }
}