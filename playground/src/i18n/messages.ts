export const loaders = {
  en: {
    common: () => import('./locales/en/common.json'),
    ui: () => import('./locales/en/ui.json'),
    auth: () => import('./locales/en/auth.json'),
    'page.articles': () => import('./locales/en/pages/articles.json'),
    page: () => import('./locales/en/pages.json'),
  },
  ru: {
    common: () => import('./locales/ru/common.json'),
    ui: () => import('./locales/ru/ui.json'),
    auth: () => import('./locales/ru/auth.json'),
    'page.articles': () => import('./locales/ru/pages/articles.json'),
    page: () => import('./locales/ru/pages.json'),
  },
}
