# Changelog

All notable changes to `@feugene/fint-i18n` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] — Unreleased

### Added

- **`te(key, locale?)`** — whether a translation exists. The only honest way to
  ask: comparing `t(key)` with the key lies on a message whose value equals its
  own key, which happens in technical dictionaries of codes and identifiers.
  Resolution mirrors `t()`, including the fallback locale.
- **`tm(key, locale?)`** — the raw message subtree, `readonly`, for translations
  used as data: menus, table columns, lists. A leaf returns `undefined`; so does
  a set of plural forms, which is a leaf even though it is an object.
- **`getAvailableLocales()`** — every locale that can be switched to: the
  loaders' locales plus the ones whose messages are already merged. Distinct from
  `getKnownLocales()`, which only answers about loaders and returns `[]` for an
  application built on `mergeMessages()`. Reading it is reactive.
  `PersistencePlugin` now uses it instead of hand-rolling the same union.
- **Retrying a failed block load.** `createFintI18n({ retry: { attempts, backoff,
  timeout } })` repeats a loader that threw. Off by default — without the option
  behaviour is unchanged, a single attempt.

  Retries happen inside the block's promise, so concurrent `loadBlock()` calls
  keep sharing it and deduplication still holds. A loader is retried rather than
  the whole block: messages already merged by its siblings stay put. Only the
  final failure surfaces, and `dispose()` stops the loop.

  `timeout` bounds the wait, it does not cancel: a loader is a plain
  `() => Promise` with no abort channel, so an abandoned request may still
  finish in the background.
  See [Retrying a failed load](./docs/en/api.md#retrying-a-failed-load).

## [0.5.0] — 2026-08-04

Pluralization is reworked from the ground up. **Every message that contains a
`|` behaves differently than in 0.4.0** — see the migration notes below.

### Breaking

- **Plural forms are now a value shape, not string markup.** A set of forms is an
  object whose keys are all form keys — CLDR categories (`zero`, `one`, `two`,
  `few`, `many`, `other`) or exact values (`=0`, `=-1`, `=1.5`):

  ```json
  { "files": { "=0": "no files", "one": "{n} file", "other": "{n} files" } }
  ```

  The `|` syntax introduced in 0.4.0 is removed entirely, along with `||`
  escaping and positional forms. No character inside a message string is special
  any more, so `"Name | Email"` is plain text under every call.
  Run `yarn codemod:plurals <paths> --write` to migrate dictionaries.
- `compileTemplate(template, locale?)` → `compileTemplate(template)`. The
  compiler is pure interpolation again; plural rules live in `compilePluralForms`.
- Messages are compiled lazily, on first use. `mergeMessages` no longer
  precompiles a block, so a large block costs a merge rather than a compilation
  of every string in it.
- `d(null)` and `d(undefined)` return an empty string instead of throwing.
- **`dispose()` now releases everything**, not only plugins: all hook
  subscriptions, dictionaries, compilation caches and block bookkeeping. After
  it, `t()` returns keys. A load still in flight is discarded rather than
  repopulating the store.
- **`engines.node` raised from `>=20` to `>=22`.** Node 20 reached end of life in
  April 2026 and was never covered by CI, which tests 22 and 24. The declared
  range now matches what is actually verified.
- **`PersistencePlugin` no longer applies a stored locale it cannot vouch for.**
  The value must appear in `allowedLocales`, in the registered loaders, or in
  messages already merged. Applications that build dictionaries with
  `mergeMessages()` instead of loaders must now pass `allowedLocales`, otherwise
  the stored value is ignored with a warning.

### Added

- `compilePluralForms(forms, locale?)` and `isPluralForms(value)` in
  `@feugene/fint-i18n/core`.
- Types `PluralCategory`, `PluralFormKey`, `PluralForms`, `MessageSchemaConstraint`.
- `PersistenceOptions.allowedLocales` — an explicit allowlist for the locales the
  plugin may restore from storage.
- `HookManager.clear()` — drops every subscription at once.
- `useI18nScopeSync()` exposes `error: Ref<unknown>`.
- **SSR snapshot and hydration.** `getSSRState(i18n, options?)` captures what the
  server loaded, `hydrate(i18n, state)` replays it on the client so the browser
  does not fetch the same blocks again. Both are free functions in
  `@feugene/fint-i18n/core` and tree-shake away in applications that never render
  on the server. `FintI18n.getLoadedBlocks()` backs the snapshot.
  See [Server-Side Rendering](./docs/en/ssr.md).
- `scripts/codemod-plural-forms.mjs` (`yarn codemod:plurals`) — migrates
  dictionaries from the 0.4.0 `|` syntax. Labelled messages are converted
  automatically; anything ambiguous is reported for a human decision instead of
  being guessed at.
- Bundle size budget (`size-budget.json`, `yarn size`) and coverage thresholds,
  both enforced in CI.

### Fixed

- **Messages containing `|` were silently truncated.** In 0.4.0 any message with
  a pipe, rendered with an `n` or `count` parameter, lost all text but one
  branch: `"Page {n} of {total} | {total} results"` rendered as `"40 results"`.
  Plural intent is now expressed by the author, never inferred from content.
- **Parallel `loadBlock` of the same block ran the loader more than once.** Three
  components sharing a block caused three loads and three merges; the in-flight
  promise is now registered before the first `await`.
- **`d(null)` crashed the render** — `typeof null === 'object'` sent it down the
  "already a Date" path.
- **Invalid `Intl` options were reported as an invalid locale and still threw.**
  `n(42, { style: 'currency' })` without a currency code now formats without the
  bad options and names the real cause.
- **`addLoaders()` was a no-op for a child of an already-loaded parent.** A block
  with its own loader is no longer considered covered by a loaded ancestor, so
  loaders registered at runtime (micro-frontends) actually run.
- **A schema declared with `interface` did not compile.** The generic constraint
  no longer requires an index signature, and `MessageKeys` works on any object
  type.
- `bigint` counts always selected `other`.
- Documentation examples that did not work: `mergeMessages` was shown with a
  missing first argument, and typed keys were advertised as typo-checked when
  arbitrary strings are accepted by design. Doc examples are now executed by a test.
- **`useI18nScopeSync` stayed `ready: false` forever when a block failed to
  load.** Loading now settles in every outcome and the reason is exposed as
  `error`.
- **The formatter cache degenerated to zero hits** once the working set of
  locale/options pairs exceeded its ceiling: the whole cache was dropped on every
  insert. A random entry is evicted instead — neither a full reset nor FIFO helps
  here, both keep evicting exactly what is needed next.

### Performance

- Plural `t()`: **193 ns → 62 ns**. The chosen branch is memoised per count, so
  `Intl.PluralRules.select()` — 82% of the old cost — runs once per value rather
  than per render.
- `mergeMessages` no longer scales with dictionary size. Invalidating the
  compilation cache used to walk every compiled key of the locale; it now walks
  one root block. At 10 000 keys: **658 µs → 18 µs**.
- `mergeMessages` of a 5000-key block: **5.35 ms → 3.75 ms** (lazy compilation).
- Core bundle for `core` + `t()`: **4760 B → 4593 B** gzip.
- Non-plural `t()` is unchanged.

### Migration from 0.4.0

0.4.0 renders some existing dictionaries incorrectly and should be skipped.

1. `yarn codemod:plurals src/i18n/locales --write` (dry run first — it is the default).
2. Review everything the codemod reports as needing a decision; it deliberately
   does not guess whether an unlabelled `a | b` was a plural or plain text.
3. Strings that used `||` for a literal pipe now render both characters — decide
   what was meant and write the character literally.

## [0.4.0] — 2026-08-04

> **Deprecated.** Pluralization in this version silently truncates any message
> containing a `|` when it is rendered with an `n` or `count` parameter.
> Upgrade to 0.5.0.

### Added

- Pluralization through `Intl.PluralRules`, using a `|`-separated syntax with
  optional CLDR labels (removed again in 0.5.0).
- Number and date formatting over `Intl`: `formatNumber`, `formatDate`,
  `createFormatters`, `getNumberFormat`, `getDateTimeFormat` in
  `@feugene/fint-i18n/core`, and the `useI18nFormat()` composable in
  `@feugene/fint-i18n/vue`. Formatter instances are cached by locale and options.
- `defaultGlobalInstall` is exported so a custom `globalInstall` can extend the
  standard registration instead of replacing it.

## [0.3.0] — 2026-07-15

### Added

- `useI18nScopeSync()` — a scope that does not require `<Suspense>`, exposing a
  `ready` flag.
- `preloadFallback` and `unloadUnusedBlocks` options.
- `onError` hook; block load failures no longer cancel the remaining loads.
- `dispose()` and plugin `uninstall()` for tearing plugins down.
- Opt-in global type augmentation via `@feugene/fint-i18n/vue/global-types`.

### Changed

- Concurrent `setLocale()` calls apply only the last requested transition.
- Writing to `locale.value` is deprecated in favour of `setLocale()`.
- `exports` declares a `default` condition for every subpath; `publint` gates CI.
