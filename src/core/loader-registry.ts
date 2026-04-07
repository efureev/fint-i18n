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

export class LocaleLoaderRegistry {
  private readonly loaders: NormalizedLocaleLoaderCollection

  constructor(source?: LocaleLoaderSource) {
    this.loaders = this.normalize(source)
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
}