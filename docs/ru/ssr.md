# Серверный рендеринг (SSR)

Рантайм и так пригоден для SSR: инстанс не держит глобального состояния, а
`installI18n(app, i18n)` привязывает его к одному Vue-приложению, поэтому
параллельные запросы с разными локалями не видят сообщений друг друга. Не
хватало одного — способа перенести на клиент то, что загрузил сервер, чтобы
браузер не запрашивал те же блоки заново.

Этим занимаются две свободные функции из `@feugene/fint-i18n/core`:
`getSSRState()` на сервере и `hydrate()` на клиенте. Сигнатуры и форма снимка —
в [Справочнике API](./api.md#снимок-состояния-для-ssr-и-гидрация).

Это именно функции, а не методы инстанса, поэтому приложение, которое не
рендерится на сервере, не включает их в бандл вовсе.

## На сервере

```typescript
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createFintI18n, getSSRState } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'

export async function render(url: string, locale: string) {
  // Свежий инстанс на каждый запрос — переиспользовать один нельзя.
  const i18n = createFintI18n({ locale, loaders })
  const app = createSSRApp(App)
  installI18n(app, i18n)

  const html = await renderToString(app)
  const state = getSSRState(i18n)

  return { html, state }
}
```

Блоки, запрошенные через `useI18nScope()`, дожидаются `renderToString` благодаря
`<Suspense>`, поэтому к моменту снятия снимка загружено всё, что отрисовала страница.

## На клиенте

```typescript
import { createSSRApp } from 'vue'
import { createFintI18n, hydrate } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'

const i18n = createFintI18n({ locale: window.__LOCALE__, loaders })
hydrate(i18n, window.__I18N_STATE__)

const app = createSSRApp(App)
installI18n(app, i18n)
app.mount('#app')
```

`hydrate()` обязан отработать **до** монтирования. Он мерджит сообщения и
помечает блоки загруженными, поэтому `useI18nScope()` и `loadBlock()`
разрешаются мгновенно и ни одного запроса за уже присланным не уходит.

## Контракт и ограничения

- **Локали в снимке нет.** Это состояние приложения: передайте одно и то же
  значение в `createFintI18n()` на обеих сторонах. Класть её в снимок значило бы
  завести два источника правды об одном факте.
- **Экранируйте полезную нагрузку.** `getSSRState()` возвращает объект;
  сериализация в страницу — дело приложения. Экранируйте `<`, иначе перевод,
  содержащий `</script>`, закроет тег. Nuxt и подобные делают это за вас.
- **Сообщения-функции не переживают JSON.** `getSSRState()` предупреждает и
  называет пути; в гидрируемых блоках используйте обычные строки либо сузьте
  снимок через `locales`.
- **Переносится только загруженное.** Блоки, которых страница не касалась, в
  снимок не попадают, и клиент грузит их по требованию как обычно.
- **Отправляйте одну локаль, а не все.** При `preloadFallback` на сервере их
  может оказаться две; `getSSRState(i18n, { locales: [locale] })` держит нагрузку
  небольшой.
