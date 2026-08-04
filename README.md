# @feugene/fint-i18n

[![codecov](https://codecov.io/gh/efureev/fint-i18n/branch/main/graph/badge.svg)](https://codecov.io/gh/efureev/fint-i18n)
[![npm version](https://badge.fury.io/js/@feugene%2Ffint-i18n.svg)](https://badge.fury.io/js/@feugene%2Ffint-i18n)
[![bundle size](https://badgen.net/bundlephobia/minzip/@feugene/fint-i18n)](https://bundlephobia.com/package/@feugene/fint-i18n)
[![dependency count](https://badgen.net/bundlephobia/dependency-count/@feugene/fint-i18n)](https://bundlephobia.com/package/@feugene/fint-i18n)

[Русская версия (Russian version)](./README.ru.md)

Localization for Vue 3 that loads only the dictionary the current screen needs — in **5.2 KB** with **zero
dependencies**.

## By the numbers

**Size** — `yarn size:consumer`: each row is a separate bundle over the published
`dist`, gzip -9, `vue` external.

| What you import                            | Cost       |
|--------------------------------------------|------------|
| `createFintI18n` + `t()`                   | **5.2 KB** |
| + Vue layer: plugin, `useI18nScope`, `v-t` | **5.9 KB** |
| + `n()` / `d()` formatting                 | **6.3 KB** |
| + SSR snapshot and `PersistencePlugin`     | **7.0 KB** |

**Speed** — `yarn bench`, Apple M5 Pro, Node 26:

| Operation                                                           | Time                           |
|---------------------------------------------------------------------|--------------------------------|
| 5 000 translations, warm cache                                      | **0.21 ms** (≈ 23 M calls/sec) |
| First pass over 5 000 keys: instance + merge + compile each message | **2.3 ms**                     |
| One `t()` with two placeholders                                     | **64 ns**                      |
| `n()` with a cached formatter vs. constructing `Intl.NumberFormat`  | **0.29 µs** vs. 6.8 µs         |

Size is a CI gate: [`size-budget.json`](./size-budget.json) fails the build when a byte creeps in, and every budget that
moved carries its justification in the file. The benchmarks run in CI too, but only for information — shared runners are
too noisy to gate on.

## Why this one

- **Lazy blocks, not one big file.** A screen loads its own dictionary. A block with no loader resolves up to its
  parent, `widgets.*` expands into all its children, and a reference counter can free a block when the last component
  using it unmounts.
- **CSP-safe compilation.** Templates compile to functions with no `new Function` and no
  `eval`, so it runs under a strict `Content-Security-Policy` where compiler-based libraries do not.
- **No special characters in a message.** Plurals are the *shape of the value* — an object of CLDR forms — not markup
  inside the string. A `|` in your text stays a `|`, and nothing silently splits a translation in half.
- **Tree-shaking per locale.** Locales are separate exports, so only the languages you list reach the bundle.
  `sideEffects: false` throughout.
- **Typed keys without losing dynamic ones.** A schema generic gives autocompletion and typo-checking for literal keys
  while `t()` still accepts strings you build at runtime.

## Install

```bash
npm i @feugene/fint-i18n     # yarn add / pnpm add
```

Vue 3.5+, ESM only. `vue` is the single peer dependency; there are no others.

## In a minute

```typescript
import {createApp} from 'vue'
import {createFintI18n} from '@feugene/fint-i18n/core'
import {installI18n} from '@feugene/fint-i18n/vue'
import {en, ru} from './i18n/messages'

const i18n = createFintI18n({
    locale: 'en',
    fallbackLocale: 'en',
    // Only the locales listed here end up in the build.
    loaders: [en, ru],
})

const app = createApp(App)
installI18n(app, i18n)
app.mount('#app')
```

```vue

<script setup>
  import {useFintI18n, useI18nScope} from '@feugene/fint-i18n/vue'

  // The blocks this component needs — loaded on mount, unloaded when it goes away.
  await useI18nScope(['common', 'auth'])

  const {t, locale, setLocale} = useFintI18n()
</script>

<template>
  <p>{{ t('common.welcome', { name: 'User' }) }}</p>
  <span v-t="'auth.login'"/>
  <button @click="setLocale(locale === 'en' ? 'ru' : 'en')">
    {{ t('common.switch') }}
  </button>
</template>
```

`loaders` takes one collection or an array of them, so several packages can each ship their own locales —
see [Defining messages](./docs/en/defining-messages.md) for the merge order and conflict rules.

## What's in the box

|                       |                                                                                                     |
|-----------------------|-----------------------------------------------------------------------------------------------------|
| **Translation**       | `t()`, `$t`, the `v-t` directive with `.once` / `.preserve`, per-call fallback locale               |
| **Blocks**            | lazy loading, upward resolution, `prefix.*` wildcards, reference counting, `retry` on a failed load |
| **Pluralization**     | CLDR categories via `Intl.PluralRules`, rules resolved once at compile time                         |
| **Numbers and dates** | `n()` / `d()` over `Intl` with formatter caching, in a separate module                              |
| **SSR**               | a state snapshot on the server, hydration on the client, no refetch                                 |
| **Introspection**     | `te()` — does a translation exist; `tm()` — a whole subtree as data                                 |
| **Extension**         | 7 hooks, plugins with `install`/`uninstall`, `dispose()` releasing everything                       |
| **Interop**           | bridge to `vue-i18n` for a gradual migration                                                        |
| **Tooling**           | CLI checks that locales agree with each other and with the code                                     |

Everything is opt-in: what you do not import, you do not pay for.

## Documentation

- 📦 **[Installation](./docs/en/installation.md)** — setup and options
- 📂 **[Defining messages](./docs/en/defining-messages.md)** — JSON formats, loaders, merging
- 🚀 **[Usage](./docs/en/usage.md)** — `t()`, `$t`, `v-t`, scopes
- 🧱 **[Translation blocks](./docs/en/blocks.md)** — resolution, wildcards, memory
- 📘 **[API reference](./docs/en/api.md)** — every method, composable and type
- 🔌 **[Plugins](./docs/en/plugins.md)** — the hook system and built-in plugins
- 🖥️ **[Server-side rendering](./docs/en/ssr.md)** — snapshot and hydration
- 🧰 **[Dictionary tooling](./docs/en/tooling.md)** — CI checks and the plural codemod
- 🌐 **[Authoring localization packages](./docs/en/authoring-localization-packages.md)** — per-locale export contract
- ⚡ **[Benchmarks and bundle analysis](./docs/en/bundle-analysis.md)** — how the numbers above are measured

Every feature has a live section in the [playground](./playground); SSR has
[its own app](./playground-ssr).

## License

[MIT](./LICENSE)
