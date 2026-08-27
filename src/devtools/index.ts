import { getCurrentInstance } from 'vue'
import type { FintI18n, FintI18nHooks, Locale } from '../core'
import { createActions } from './actions'
import { isNameTaken, publishToBridge } from './bridge'
import { applyMode, type DevtoolsMode } from './modes'
import { createShadowState } from './state'
import { createTimeline } from './timeline'
import type { DevtoolsOptions, FintI18nDevtools, OverlayOptions } from './types'

export * from './types'
export { BRIDGE_KEY, type DevtoolsBridge } from './bridge'
export { buildMissingKeysPatch, type DevtoolsActions } from './actions'
export { type DevtoolsMode, pseudo } from './modes'

declare const __FINT_I18N_VERSION__: string

/**
 * Версия подставляется на сборке (`define` в `vite.config.ts`). Нужна, чтобы
 * различать две копии пакета в одном рантайме: ключ инъекции —
 * `Symbol.for('FintI18n')`, то есть глобальный, и такие копии его делят.
 */
const VERSION = typeof __FINT_I18N_VERSION__ === 'string' ? __FINT_I18N_VERSION__ : 'unknown'

/**
 * Панель внутри приложения — канал, не требующий ни расширения, ни чего-либо
 * ещё: работает в SSR-приложении после гидрации, на мобильном, в Storybook.
 *
 * Тело панели грузится динамическим `import()`, поэтому eager-часть subpath'а
 * остаётся маленькой, а приложение, которому нужен только снимок в консоли,
 * не платит за UI.
 *
 * ```ts
 * const devtools = createDevtools()
 * const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })
 *
 * const unmount = await mountDevtoolsOverlay(devtools)
 * ```
 *
 * Без `document` (сервер) возвращает функцию, которая ничего не делает.
 */
export async function mountDevtoolsOverlay(
  devtools: FintI18nDevtools,
  options: OverlayOptions = {},
): Promise<() => void> {
  const { mountOverlay } = await import('./overlay/mount')

  return mountOverlay(devtools, options)
}

/** Методы-стрелки, которые оборачиваются: событий на них хук-система не даёт. */
type WrappedMethod =
  | 'registerUsage'
  | 'unregisterUsage'
  | 'loadBlock'
  | 'unloadBlock'
  | 'mergeMessages'
  | 'addLoaders'
  | 'dispose'

function pickName(requested?: string): string {
  if (requested) return requested
  if (!isNameTaken('i18n')) return 'i18n'

  let index = 2
  while (isNameTaken(`i18n-${index}`)) index++

  return `i18n-${index}`
}

/** Компонент, из чьего `setup` пришёл вызов. `useI18nScope` регистрирует блок до первого `await`. */
function currentComponentName(): string | undefined {
  const instance = getCurrentInstance()
  if (!instance) return undefined

  const type = instance.type as { name?: string, __name?: string }

  return type.name ?? type.__name ?? 'anonymous'
}

/**
 * Инструмент отладки для рантайма i18n: теневое состояние, лента событий и мост
 * в `window` для консоли и e2e.
 *
 * Ядро о нём не знает — всё собирается из публичного API, хуков и обёрток над
 * методами инстанса. Подключать **только в dev** и только динамическим импортом,
 * иначе обещание «0 байт в проде» перестаёт быть правдой:
 *
 * ```ts
 * const plugins = import.meta.env.DEV
 *   ? [(await import('@feugene/fint-i18n/devtools')).createDevtools()]
 *   : []
 *
 * const i18n = createFintI18n({ locale: 'en', plugins })
 * ```
 *
 * Передавать инстанс аргументом тоже можно, но подключение через `plugins`
 * лучше: `install` тогда вызывается в конструкторе — до того, как `installI18n`
 * снимет копию `t` в `$t`, и до первых загрузок, а значит история полна.
 */
export function createDevtools(i18n?: FintI18n, options: DevtoolsOptions = {}): FintI18nDevtools {
  const timeline = createTimeline(options.eventLimit)
  const state = createShadowState()

  let target: FintI18n | null = null
  let unpublish: (() => void) | undefined
  let name = ''
  let mode: DevtoolsMode = 'off'
  let offMode: (() => void) | undefined
  const offHooks: (() => void)[] = []
  const originals = new Map<WrappedMethod, unknown>()

  const wrap = (instance: FintI18n, method: WrappedMethod, before: (...args: any[]) => void) => {
    const raw = instance as unknown as Record<string, (...args: any[]) => unknown>
    const original = raw[method]
    originals.set(method, original)

    raw[method] = (...args: any[]) => {
      before(...args)
      return original(...args)
    }
  }

  const on = <K extends keyof FintI18nHooks>(instance: FintI18n, hook: K, fn: FintI18nHooks[K]) => {
    offHooks.push(instance.hooks.on(hook, fn))
  }

  const detach = () => {
    if (!target) return

    const instance = target
    target = null

    unpublish?.()
    unpublish = undefined

    offMode?.()
    offMode = undefined
    mode = 'off'

    for (const off of offHooks) off()
    offHooks.length = 0

    // Возвращаем ровно свои обёртки: поверх могли поставить чужую, и затирать
    // её нельзя.
    const raw = instance as unknown as Record<string, unknown>
    for (const [method, original] of originals) {
      if (raw[method] !== original) raw[method] = original
    }
    originals.clear()
  }

  const devtools: FintI18nDevtools = {
    name: 'devtools',

    install(instance: FintI18n) {
      if (target) detach()
      target = instance
      name = pickName(options.name)

      on(instance, 'afterInit', () => { timeline.push('init') })

      on(instance, 'onLocaleChange', (payload) => {
        timeline.push('localeChange', payload)
      })

      on(instance, 'beforeLoadBlock', (payload) => {
        state.blockLoadStarted(payload.block, payload.locale)
        timeline.push('blockLoadStart', payload)
      })

      on(instance, 'afterLoadBlock', ({ block, locale }) => {
        state.blockLoadFinished(block, locale, block)
        timeline.push('blockLoadEnd', { block, locale })
      })

      on(instance, 'onError', ({ error, block, locale }) => {
        state.blockLoadFailed(block, locale, error)
        timeline.push('error', {
          block,
          locale,
          message: error instanceof Error ? error.message : String(error),
        })
      })

      on(instance, 'onRetry', ({ block, locale, attempt, error }) => {
        timeline.push('retry', {
          block,
          locale,
          attempt,
          message: error instanceof Error ? error.message : String(error),
        })
      })

      // Промахи и фолбэки дедуплицируются: `onMissingKey` приходит заново после
      // каждой загрузки блока, а `onFallback` — на каждый вызов `t()` для
      // непереведённого ключа. В ленту идёт только первое появление, счётчик —
      // в снимке.
      on(instance, 'onMissingKey', ({ key, locale }) => {
        if (state.missingKeySeen(key, locale)) timeline.push('missingKey', { key, locale })
      })

      on(instance, 'onFallback', ({ key, locale, fallbackLocale }) => {
        if (state.fallbackSeen(key, locale, fallbackLocale)) {
          timeline.push('fallback', { key, locale, fallbackLocale })
        }
      })

      on(instance, 'onWarning', ({ code, message, context }) => {
        if (state.warningSeen(code, message, context)) {
          timeline.push('warning', { code, message, context })
        }
      })

      wrap(instance, 'registerUsage', (block: string) => {
        const component = currentComponentName()
        state.usageChanged(block, 1)
        timeline.push('usage', { block, delta: 1, component })
      })

      wrap(instance, 'unregisterUsage', (block: string) => {
        state.usageChanged(block, -1)
        timeline.push('usage', { block, delta: -1 })
      })

      // Загрузку покажет хук; здесь важен сам факт запроса — он виден и тогда,
      // когда блок уже загружен и до лоадера дело не дойдёт.
      wrap(instance, 'loadBlock', (block: string, locale?: Locale) => {
        timeline.push('blockRequested', { block, locale: locale ?? instance.locale.value })
      })

      wrap(instance, 'unloadBlock', (block: string, locale?: Locale) => {
        const targetLocale = locale ?? instance.locale.value
        state.blockUnloaded(block, targetLocale)
        timeline.push('blockUnload', { block, locale: targetLocale })
      })

      wrap(instance, 'mergeMessages', (locale: Locale, block: string) => {
        timeline.push('messagesMerged', { locale, block })
      })

      wrap(instance, 'addLoaders', () => {
        timeline.push('loadersAdded')
      })

      wrap(instance, 'dispose', () => {
        timeline.push('dispose')
      })

      if (options.bridge !== false) {
        unpublish = publishToBridge(name, devtools, VERSION)
      }
    },

    uninstall() {
      detach()
    },

    detach,

    snapshot() {
      if (!target) {
        throw new Error('[fint-i18n] devtools is not attached to an instance')
      }

      return state.snapshot(target, VERSION, name)
    },

    get events() {
      return timeline.events
    },

    dictionary() {
      if (!target) throw new Error('[fint-i18n] devtools is not attached to an instance')

      return state.dictionary(target)
    },

    get actions() {
      if (!target) throw new Error('[fint-i18n] devtools is not attached to an instance')

      return createActions(target, () => state.snapshot(target!, VERSION, name).missingKeys)
    },

    get mode() {
      return mode
    },

    setMode(next: DevtoolsMode) {
      if (!target || next === mode) return

      offMode?.()
      offMode = undefined
      mode = next

      if (next !== 'off') {
        offMode = target.hooks.on('onTranslate', (data) => {
          // Промах остаётся промахом: `t()` и без нас вернёт сам ключ, а
          // подмена `undefined` увела бы вызов мимо `onMissingKey`.
          if (data.result === undefined) return data

          return { ...data, result: applyMode(next, data.key, data.result) }
        })
      }

      // Переключение режима не трогает ни словарь, ни данные — перерисовать
      // приложение нечем, кроме инвалидации кэша компиляции. Её версию `t()`
      // читает на попадании в кэш (ядро, роадмап #12), поэтому собственный
      // сигнал devtools не нужен.
      createActions(target, () => []).clearCompiled()

      timeline.push('mode', { mode: next })
    },

    subscribe: timeline.subscribe,
    clearEvents: timeline.clear,
  }

  if (i18n) devtools.install(i18n)

  return devtools
}
