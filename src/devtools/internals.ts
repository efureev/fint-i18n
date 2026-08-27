import type { FintI18n, Locale } from '../core'
import type { InstanceOptions } from './types'

/**
 * Единственное место, читающее приватные поля `FintI18n`.
 *
 * Всё, что здесь берётся, публичным API не отдаётся вовсе, а платить за геттеры
 * в ядре пришлось бы каждому потребителю — байты класса не тришейкаются.
 * Coupling локализован в одном файле и закрыт контрактным тестом: переименование
 * поля роняет его, а не тихо гасит половину панели.
 *
 * Каждое чтение отдаёт `null`, если поля нет: devtools обязан пережить это, а не
 * упасть.
 */

function read<T>(instance: FintI18n, field: string, guard: (value: unknown) => boolean): T | null {
  const value = (instance as unknown as Record<string, unknown>)[field]
  return guard(value) ? (value as T) : null
}

const isObject = (value: unknown): boolean => !!value && typeof value === 'object'

/** Имена всех зарегистрированных блоков — включая ни разу не загруженные. */
export function readRegisteredBlocks(instance: FintI18n): string[] | null {
  const registry = read<{ getKnownBlockNames?: () => readonly string[] }>(
    instance,
    'loaderRegistry',
    value => isObject(value) && typeof (value as any).getKnownBlockNames === 'function',
  )

  return registry ? [...registry.getKnownBlockNames!()] : null
}

export function readOptions(instance: FintI18n): InstanceOptions | null {
  const raw = instance as unknown as Record<string, unknown>

  if (typeof raw.preloadFallback !== 'boolean' || typeof raw.unloadUnusedBlocks !== 'boolean') {
    return null
  }

  return {
    fallbackLocale: instance.fallbackLocale,
    preloadFallback: raw.preloadFallback,
    unloadUnusedBlocks: raw.unloadUnusedBlocks,
    retry: raw.retry ?? null,
  }
}

export function readPluginNames(instance: FintI18n): string[] | null {
  const plugins = read<{ name?: string }[]>(instance, 'installedPlugins', Array.isArray)

  return plugins ? plugins.map(plugin => plugin.name ?? 'unnamed') : null
}

export function readDisposed(instance: FintI18n): boolean {
  return (instance as unknown as Record<string, unknown>).disposed === true
}

/** Счётчики использований блоков — иначе видны только с момента подключения. */
export function readUsageCounters(instance: FintI18n): Record<string, number> | null {
  const counters = read<Map<string, number>>(
    instance,
    'blockUsageCounters',
    value => value instanceof Map,
  )

  if (!counters) return null

  const result: Record<string, number> = {}
  for (const [block, count] of counters) result[block] = count

  return result
}

/** Сколько ключей лежит в кэше компиляции, по локалям. */
export function readCompiledCounts(instance: FintI18n): Record<Locale, number> | null {
  const compiled = read<Record<string, Record<string, unknown>>>(instance, 'compiledMessages', isObject)

  if (!compiled) return null

  const result: Record<Locale, number> = {}
  for (const locale in compiled) result[locale] = Object.keys(compiled[locale]).length

  return result
}
