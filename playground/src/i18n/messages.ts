export const loaders = {
  en: {
    common: () => import('./locales/en/common.json'),
    ui: () => import('./locales/en/ui.json'),
    auth: () => import('./locales/en/auth.json'),
    'page.articles': () => import('./locales/en/pages/articles.json'),
    page: () => import('./locales/en/pages.json'),
    'widgets.alpha': () => import('./locales/en/widgets/alpha.json'),
    'widgets.beta': () => import('./locales/en/widgets/beta.json'),
    'widgets.gamma': () => import('./locales/en/widgets/gamma.json'),
  },
  ru: {
    common: () => import('./locales/ru/common.json'),
    ui: () => import('./locales/ru/ui.json'),
    auth: () => import('./locales/ru/auth.json'),
    'page.articles': () => import('./locales/ru/pages/articles.json'),
    page: () => import('./locales/ru/pages.json'),
    'widgets.alpha': () => import('./locales/ru/widgets/alpha.json'),
    'widgets.beta': () => import('./locales/ru/widgets/beta.json'),
    'widgets.gamma': () => import('./locales/ru/widgets/gamma.json'),
  },
}
