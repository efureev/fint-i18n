import type { LocaleLoaderCollection } from '@feugene/fint-i18n/core'

/**
 * English locale loaders for the playground app.
 *
 * Exported separately from other locales so that consumers (and bundlers)
 * can import only the languages they actually need — see the
 * "Authoring localization packages" guide in the docs.
 */
export const en: LocaleLoaderCollection = {
  en: {
    common: () => import('../locales/en/common.json'),
    ui: () => import('../locales/en/ui.json'),
    auth: () => import('../locales/en/auth.json'),
    'page.articles': () => import('../locales/en/pages/articles.json'),
    page: () => import('../locales/en/pages.json'),
    'widgets.alpha': () => import('../locales/en/widgets/alpha.json'),
    'widgets.beta': () => import('../locales/en/widgets/beta.json'),
    'widgets.gamma': () => import('../locales/en/widgets/gamma.json'),
    fallback: () => import('../locales/en/fallback.json'),
    profile: () => import('../locales/en/profile.json'),
    metrics: () => import('../locales/en/metrics.json'),
    lab: () => import('../locales/en/lab.json'),
    // NB: `announce` is intentionally NOT registered here — it is added at
    // runtime via `addLoaders()` in the "Dynamic loaders" section.
  },
}

export default en
