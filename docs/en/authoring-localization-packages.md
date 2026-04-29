# Authoring Localization Packages

This document describes the recommended export shape for any package that
ships translations consumed by `@feugene/fint-i18n` (UI kit, business
module, plugin, etc.).

The core principle is **one export per locale**. This is not a
requirement of `fint-i18n` itself — the engine works with any valid
`LocaleLoaderCollection` — it is a requirement of the **consumer's
bundler**: only this layout lets Vite / Rollup / webpack tree-shake away
locales the consumer does not use.

## Why per-locale exports matter

If a package exports a single fat object containing every locale:

```ts
// ❌ avoid this shape
export const fooLocaleLoaders = {
  en: { common: () => import('./locales/en/common.json'), /* ... */ },
  ru: { common: () => import('./locales/ru/common.json'), /* ... */ },
  de: { /* ... */ },
  fr: { /* ... */ },
  // ...
}
```

then even if the application only ever calls `setLocale('en' | 'ru')`,
**every dynamic `import()` for `de` / `fr` / … is still reachable from
the module graph** and ends up in `dist`. The result is a bloated
manifest, larger prefetch maps and heavier SSR artifacts.

A runtime option such as `supportedLocales` on `createFintI18n` does
**not** solve this — runtime filtering happens after the bundler's
static analysis is over.

## Recommended package layout

```text
my-package/
  src/
    i18n/
      locales/
        en/...json
        ru/...json
        de/...json
        ...
      en.ts          # exports `en` — English loaders only
      ru.ts          # exports `ru` — Russian loaders only
      de.ts
      ...
      index.ts       # barrel with named re-exports
      all.ts         # (optional) aggregate for demos/tests
```

### Locale module

```ts
// src/i18n/en.ts
import type { LocaleLoaderCollection } from '@feugene/fint-i18n/core'

export const en: LocaleLoaderCollection = {
  en: {
    common: () => import('./locales/en/common.json'),
    forms:  () => import('./locales/en/forms.json'),
  },
}

export default en
```

The remaining locale files follow the same pattern — only the top-level
locale code and the import paths differ.

### `index.ts` barrel

```ts
// src/i18n/index.ts
export { en } from './en'
export { ru } from './ru'
export { de } from './de'
// ...
```

This barrel is what is typically published as `<package>/i18n` via the
`exports` field of `package.json`. When the consumer writes:

```ts
import { en, ru } from 'my-package/i18n'
```

modules `de.ts`, `fr.ts`, … **never enter the dependency graph** and are
removed by tree-shaking, regardless of how big the underlying JSON or
`import()` graph is.

### Optional `all.ts`

```ts
// src/i18n/all.ts — for demos, tooling, e2e tests
import { en } from './en'
import { ru } from './ru'
import { de } from './de'

export const all = [en, ru, de /* ... */]
export default all
```

This export **deliberately** pulls every locale in. Use it only where
tree-shaking is not a concern.

## Package contract

1. **Export every locale as a separate named export** from
   `<package>/i18n` (export name = ISO code: `en`, `ru`; for tags such as
   `pt-BR` use `ptBR` or alias on the consumer side via `as`).
2. **Do not make a fat default export** of all locales the primary
   consumption path.
3. The export type is always `LocaleLoaderCollection` containing a
   single top-level locale.
4. **Never assume which language the application uses**: the package must
   work even when only one locale is imported.
5. **Keep locale modules side-effect free** (`"sideEffects": false` in
   `package.json`, or an explicit whitelist).

## Consumer side

```ts
import { createFintI18n } from '@feugene/fint-i18n/core'
import { en as appEn, ru as appRu } from './i18n/messages'
import { en as granularityEn, ru as granularityRu } from '@feugene/granularity/i18n'

const i18n = createFintI18n({
  locale: 'ru',
  fallbackLocale: 'en',
  // Donor packages are wired in with exactly the locales the project ships.
  loaders: [appEn, appRu, granularityEn, granularityRu],
})
```

When blocks collide, `fint-i18n` merges their loaders left to right —
later entries override earlier ones. See [Defining
Messages](./defining-messages.md) for the full rule set.

## Checklist

- [ ] Each locale is its own module (`en.ts`, `ru.ts`, …).
- [ ] `index.ts` re-exports locales by name, without an aggregated
      default.
- [ ] `package.json` exposes `<package>/i18n` via the `exports` field and
      `sideEffects` does not block tree-shaking.
- [ ] Locale modules are side-effect free and do not import each other.
- [ ] The optional aggregate is exposed under a separate subpath
      (`<package>/i18n/all`), not from the main barrel.
