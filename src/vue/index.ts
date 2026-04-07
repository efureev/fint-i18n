export * from './scope'
export * from './inject'
export * from './directive'
export * from './plugin'

import type { FintI18n } from '@/core'
import type { Directive } from 'vue'
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
