# Server-Side Rendering

The runtime is SSR-safe as it stands: an instance holds no global state, and
`installI18n(app, i18n)` scopes it to one Vue app, so parallel requests with
different locales cannot see each other's messages. What is needed on top is a
way to carry what the server loaded over to the client, so the browser does not
fetch the same blocks again.

Two free functions do that, both imported from `@feugene/fint-i18n/core`:
`getSSRState()` on the server and `hydrate()` on the client. Signatures and the
shape of the snapshot are in the
[API Reference](./api.md#ssr-snapshot-and-hydration).

They are ordinary functions, not instance methods, so an application that never
renders on the server does not bundle them at all.

## On the server

```typescript
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createFintI18n, getSSRState } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'

export async function render(url: string, locale: string) {
  // A fresh instance per request — never share one between requests.
  const i18n = createFintI18n({ locale, loaders })
  const app = createSSRApp(App)
  installI18n(app, i18n)

  const html = await renderToString(app)
  const state = getSSRState(i18n)

  return { html, state }
}
```

Blocks requested through `useI18nScope()` are awaited by `renderToString` via
`<Suspense>`, so by the time the snapshot is taken everything the page rendered
is already loaded.

## On the client

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

`hydrate()` must run **before** mounting. It merges the messages and marks the
blocks as loaded, so `useI18nScope()` and `loadBlock()` resolve immediately and
no request is made for what the server already sent.

## Contract and limits

- **The locale is not part of the snapshot.** It is application state: pass the
  same value to `createFintI18n()` on both sides. Carrying it twice would give
  two sources of truth for one fact.
- **Escape the payload.** `getSSRState()` returns an object; serialising it into
  the page is the application's job. Escape `<` — a translation containing
  `</script>` would otherwise close the tag. Frameworks such as Nuxt do this for you.
- **Message functions do not survive JSON.** `getSSRState()` warns and names the
  paths; use plain strings in blocks that are hydrated, or narrow the snapshot
  with `locales`.
- **Only what was loaded is carried.** Blocks the page never touched stay absent
  from the snapshot, and the client loads them on demand as usual.
- **Send one locale, not all of them.** With `preloadFallback` the server may
  hold two; `getSSRState(i18n, { locales: [locale] })` keeps the payload small.
