import type { App } from 'vue'
import type { FintI18n } from '@/core'
import { createVTDirective } from './directive'
import { FINT_I18N_KEY } from './inject'

export function installI18n(app: App, i18n: FintI18n, options: { directive?: string | boolean } = {}) {
  app.provide(FINT_I18N_KEY, i18n)

  if (i18n.globalInstall) {
    app.config.globalProperties.$t = i18n.t
    app.config.globalProperties.$i18n = i18n
  }

  const directiveName = options.directive === false ? null : (typeof options.directive === 'string' ? options.directive : 't')

  if (directiveName) {
    app.directive(directiveName, createVTDirective(i18n))
  }
}
