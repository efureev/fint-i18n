import type { LocaleLoaderCollection } from '@feugene/fint-i18n/core'

/**
 * Russian locale loaders for the playground app.
 *
 * Exported separately from other locales so that consumers (and bundlers)
 * can import only the languages they actually need — see the
 * "Authoring localization packages" guide in the docs.
 */
export const ru: LocaleLoaderCollection = {
  ru: {
    common: () => import('../locales/ru/common.json'),
    ui: () => import('../locales/ru/ui.json'),
    auth: () => import('../locales/ru/auth.json'),
    'page.articles': () => import('../locales/ru/pages/articles.json'),
    page: () => import('../locales/ru/pages.json'),
    'widgets.alpha': () => import('../locales/ru/widgets/alpha.json'),
    'widgets.beta': () => import('../locales/ru/widgets/beta.json'),
    'widgets.gamma': () => import('../locales/ru/widgets/gamma.json'),
  },
}

export default ru
