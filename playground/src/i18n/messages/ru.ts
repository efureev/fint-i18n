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
    'page.articles': () => import('../locales/ru/page/articles.json'),
    page: () => import('../locales/ru/page.json'),
    'widgets.alpha': () => import('../locales/ru/widgets/alpha.json'),
    'widgets.beta': () => import('../locales/ru/widgets/beta.json'),
    'widgets.gamma': () => import('../locales/ru/widgets/gamma.json'),
    fallback: () => import('../locales/ru/fallback.json'),
    profile: () => import('../locales/ru/profile.json'),
    metrics: () => import('../locales/ru/metrics.json'),
    lab: () => import('../locales/ru/lab.json'),
    // NB: `announce` is intentionally NOT registered here — it is added at
    // runtime via `addLoaders()` in the "Dynamic loaders" section.
  },
}

export default ru
