import { inject, type InjectionKey } from 'vue'
import type { FintI18n } from '@/core'

export const FINT_I18N_KEY: InjectionKey<FintI18n> = Symbol.for('FintI18n') as InjectionKey<FintI18n>

export function useFintI18n(): FintI18n {
  const i18n = inject(FINT_I18N_KEY)
  if (!i18n) {
    throw new Error('[fint-i18n] Instance not found. Did you call installI18n(app, i18n)?')
  }
  return i18n
}
