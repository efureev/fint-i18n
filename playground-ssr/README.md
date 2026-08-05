# SSR playground

A Vue 3 server-rendered showcase for `@feugene/fint-i18n` 0.5.0. It exists to
demonstrate the one thing the [static playground](../playground) cannot: carrying
the state loaded on the server over to the browser.

```bash
yarn playground:ssr          # dev server on http://localhost:3100
yarn playground:ssr:build    # client + server bundles
yarn playground:ssr:prod     # the same server over the built output
```

Like the static playground, this app consumes the library **sources** through
aliases — no rebuild is needed after editing `src/**`.

## What it shows

| | |
| --- | --- |
| `getSSRState()` / `hydrate()` | the snapshot is embedded in the page and replayed before mounting |
| Proof it worked | a per-instance loader counter: **0 calls in the browser** after hydration |
| The contrast | `?hydrate=0` skips hydration — the same blocks are fetched again |
| A deferred block | a `defineAsyncComponent` section whose `promo` block is absent from the server render, the snapshot and the initial bundle — one click fetches both the chunk and the dictionary |
| CLDR pluralization | `?locale=ru` renders `5 товаров` on the server, `?locale=en` renders `5 items` |
| Plain pipes | `Имя \| Почта \| Роль` is rendered whole — nothing in a message string is special |
| `useI18nFormat()` | currency, percent and dates formatted per locale |
| Per-request instances | a fresh instance per request, released with `dispose()` after the snapshot |

Try these side by side:

- <http://localhost:3100/?locale=ru>
- <http://localhost:3100/?locale=ru&hydrate=0>
- <http://localhost:3100/?locale=en>

## Two ways to break hydration

Both are demonstrated correctly in the code, and both are easy to get wrong:

1. **Values known only after rendering** — the snapshot size and block list — are
   filled in `onMounted`, not during render. Rendering them on the server would
   make the client markup differ.
2. **Dates.** The timestamp travels in the payload rather than being read from
   `Date.now()` on both sides, and every `d()` call passes an explicit
   `timeZone`: the server's zone is not the browser's.

## The deferred section

`LazyBlockDemo.vue` keeps `LazyBlockPanel.vue` behind `v-if`, so the loader of
`defineAsyncComponent` never runs during the server render: the chunk stays out
of the response, the `promo` block is never loaded, and the snapshot carries only
`common`, `cart` and `stats`. The click fetches both — watch the counter turn
from `0` into `<locale>:promo`.

Two choices matter here:

- **`suspensible: false`.** The `<Suspense>` in `App.vue` is resolved by the time
  the click happens; an async dependency appearing under it would push it back
  into pending and flash the fallback over the whole page.
- **`useI18nScopeSync`, not `await useI18nScope`.** An async `setup()` needs a
  Suspense boundary, which is the same problem. The sync scope reports progress
  through `ready` / `error` instead.

## Layout

```
server.mjs            node:http + Vite middleware (dev) or built output (--prod)
index.html            placeholders for the markup and the payload
src/entry-server.ts   render(url) → { html, payload }; escapes `<` in the payload
src/entry-client.ts   hydrate() before mount
src/i18n/index.ts     per-request instance factory with the loader counter
src/components/LazyBlockDemo.vue    the toggle; the async chunk lives behind v-if
src/components/LazyBlockPanel.vue   the chunk itself, owner of the `promo` block
```

The full recipe and its contract are documented in
[docs/en/ssr.md](../docs/en/ssr.md).
