import { computed, onUnmounted, ref, type ComputedRef, type Ref } from 'vue'
import type { Locale } from '../core'
import { isBlockPattern } from '../core/loader-registry'
import { useFintI18n } from './inject'

export interface UseI18nScopeOptions {
  /**
   * Префиксовать ключи именем блока: `t('login')` → `t('auth.login')`.
   * Работает только с одиночным конкретным блоком (не паттерном).
   */
  prefix?: boolean
}

export interface I18nScope {
  t: (key: string, params?: Record<string, any>) => string
  locale: ComputedRef<Locale>
  setLocale: (l: Locale) => Promise<void>
}

export interface I18nScopeSync extends I18nScope {
  /**
   * Становится `true`, когда загрузка блоков завершилась — **в любом исходе**.
   * Отказ хотя бы одного блока не оставляет скоуп в вечной загрузке, признак
   * отказа смотрите в `error`.
   */
  ready: Ref<boolean>
  /** Причина отказа загрузки, иначе `null`. */
  error: Ref<unknown>
}

function setupScope(blocks: string | string[], options: UseI18nScopeOptions) {
  const i18n = useFintI18n()
  const normalizedBlocks = Array.isArray(blocks) ? blocks : [blocks]

  onUnmounted(() => {
    normalizedBlocks.forEach(block => i18n.unregisterUsage(block))
  })

  const loads = normalizedBlocks.map((block) => {
    i18n.registerUsage(block)
    return i18n.loadBlock(block)
  })

  let prefix = ''
  if (options.prefix) {
    if (normalizedBlocks.length === 1 && !isBlockPattern(normalizedBlocks[0])) {
      prefix = `${normalizedBlocks[0]}.`
    }
    else {
      console.warn('[fint-i18n] `prefix` option is ignored: it requires a single concrete block name')
    }
  }

  const scope: I18nScope = {
    t: (key: string, params?: Record<string, any>) => i18n.t(prefix + key, params),
    locale: computed(() => i18n.locale.value),
    setLocale: (l: Locale) => i18n.setLocale(l),
  }

  return { loads, scope }
}

/**
 * Асинхронный скоуп блоков: дожидается загрузки.
 * Требует `await` в `<script setup>` (т.е. `<Suspense>` выше по дереву).
 */
export async function useI18nScope(blocks: string | string[], options: UseI18nScopeOptions = {}): Promise<I18nScope> {
  const { loads, scope } = setupScope(blocks, options)
  await Promise.all(loads)
  return scope
}

/**
 * Синхронный вариант useI18nScope — не требует Suspense.
 * Блоки загружаются в фоне; `ready` сигнализирует о готовности.
 */
export function useI18nScopeSync(blocks: string | string[], options: UseI18nScopeOptions = {}): I18nScopeSync {
  const { loads, scope } = setupScope(blocks, options)
  const ready = ref(false)
  const error = ref<unknown>(null)

  // `allSettled` не отклоняется, поэтому обработчик отказов не нужен.
  void Promise.allSettled(loads).then((results) => {
    const failed = results.find(result => result.status === 'rejected')

    if (failed) {
      error.value = failed.reason
      console.error('[fint-i18n] Failed to load scope blocks:', failed.reason)
    }

    ready.value = true
  })

  return { ...scope, ready, error }
}
