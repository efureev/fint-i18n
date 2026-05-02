import type { App } from 'vue'
import type { FintI18n } from '@/core'
import { createVTDirective } from './directive'
import { FINT_I18N_KEY } from './inject'

export type GlobalInstallFn = (app: App, i18n: FintI18n) => void

export interface InstallI18nOptions {
  directive?: string | boolean
  /**
   * Управляет регистрацией глобальных свойств ($t, $i18n).
   * - функция: вызывается вместо стандартной регистрации;
   * - `true`: выполняется стандартная регистрация (по умолчанию, если у инстанса `globalInstall === true`);
   * - `false`: ничего не происходит.
   * Если опция не передана — используется значение `i18n.globalInstall`.
   */
  globalInstall?: boolean | GlobalInstallFn
}

function defaultGlobalInstall(app: App, i18n: FintI18n) {
  app.config.globalProperties.$t = i18n.t
  app.config.globalProperties.$i18n = i18n
}

export function installI18n(app: App, i18n: FintI18n, options: InstallI18nOptions = {}) {
  app.provide(FINT_I18N_KEY, i18n)

  const globalInstall = options.globalInstall ?? i18n.globalInstall

  if (typeof globalInstall === 'function') {
    globalInstall(app, i18n)
  }
  else if (globalInstall) {
    defaultGlobalInstall(app, i18n)
  }

  const directiveName = options.directive === false ? null : (typeof options.directive === 'string' ? options.directive : 't')

  if (directiveName) {
    app.directive(directiveName, createVTDirective(i18n))
  }
}
