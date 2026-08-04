import type { LocaleLoaderCollection } from '@feugene/fint-i18n/core'

/**
 * Spanish locale loaders for the playground.
 *
 * Exported separately from other locales so that consumers (and bundlers)
 * can import only the languages they actually need — see the
 * "Authoring localization packages" guide in the docs.
 */
export const es: LocaleLoaderCollection = {
  es: {
    common: () => import('../locales/es/common.json'),
    ui: () => import('../locales/es/ui.json'),
    auth: () => import('../locales/es/auth.json'),
    'page.articles': () => import('../locales/es/page/articles.json'),
    page: () => import('../locales/es/page.json'),
    'widgets.alpha': () => import('../locales/es/widgets/alpha.json'),
    'widgets.beta': () => import('../locales/es/widgets/beta.json'),
    'widgets.gamma': () => import('../locales/es/widgets/gamma.json'),
    fallback: () => import('../locales/es/fallback.json'),
    profile: () => import('../locales/es/profile.json'),
    metrics: () => import('../locales/es/metrics.json'),
    lab: () => import('../locales/es/lab.json'),
    // NB: `announce` is intentionally NOT registered here — it is added at
    // runtime via `addLoaders()` in the "Dynamic loaders" section.
  },
}

export default es
