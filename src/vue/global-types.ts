/**
 * Opt-in глобальная аугментация типов Vue: `$t`, `$i18n` и директива `v-t`.
 *
 * Подключается явно — только если используется стандартная регистрация
 * (`installI18n` с `globalInstall: true` и директивой под именем `t`):
 *
 * ```ts
 * import '@feugene/fint-i18n/vue/global-types'
 * ```
 *
 * Если глобальные свойства отключены или директива переименована,
 * не импортируйте этот модуль — объявите собственный `declare module 'vue'`.
 */
import type { Directive } from 'vue'
import type { FintI18n } from '../core'
import type { VTDirectiveValue } from './directive'

declare module '@vue/runtime-core' {
  export interface GlobalDirectives {
    vT: Directive<HTMLElement, VTDirectiveValue>
  }
  export interface ComponentCustomProperties {
    $t: FintI18n['t']
    $i18n: FintI18n
  }
}

declare module 'vue' {
  export interface GlobalDirectives {
    vT: Directive<HTMLElement, VTDirectiveValue>
  }
  export interface ComponentCustomProperties {
    $t: FintI18n['t']
    $i18n: FintI18n
  }
}

export {}
