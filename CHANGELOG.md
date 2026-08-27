# Changelog

All notable changes to `@feugene/fint-i18n` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`@feugene/fint-i18n/devtools`** — a runtime debugging tool behind its own
  subpath: a state snapshot (blocks with their status, usage counters and load
  durations, missing keys, fallback hits, warnings, instance options), an event
  timeline with a ring buffer, and a `window.__FINT_I18N_DEVTOOLS__` bridge with
  `waitFor(block, locale?)` for the console and for e2e.

  The core knows nothing about it: everything is collected from the public API,
  from the hooks and from wrappers over instance methods, so nothing was added
  to `FintI18n` for it. It implements `FintI18nPlugin`, which means
  `createFintI18n({ plugins: [createDevtools()] })` wires it before the first
  load — and `dispose()` detaches it through `uninstall`.

  Zero bytes in production, and that is gated rather than promised:
  `scripts/check-devtools-isolation.mjs` walks the import graph of the built
  `dist` and fails if devtools code is reachable from any production entry. Wire
  it through a dynamic import behind a build condition — see
  [Devtools](./docs/en/devtools.md).

  `onTranslate` stays unsubscribed: it costs +17% per translation, and missing
  keys and fallbacks are already covered by their own hooks for free.
- **`mountDevtoolsOverlay(devtools, options?)`** — the panel inside the
  application, with tabs for locales, blocks, the dictionary, misses, the
  timeline and the caches, plus a one-click JSON export of snapshot and
  timeline. It needs neither a browser extension nor a CSS import, which makes
  it the only channel that works in an SSR application after hydration, on a
  phone and in Storybook.

  It runs in its own Vue application inside a Shadow DOM rather than in the
  host's tree: there it would appear in the host's own Vue Devtools and in its
  `useI18nScope` counters, and without a shadow root the host's styles would
  tear it apart. The body is loaded through a dynamic `import()`, so an
  application that only wants the snapshot in the console pays nothing for the
  UI.

  The showcase's hand-rolled debug panel is gone — the overlay replaced it, in
  both the static and the SSR playground.
- **`devtools.actions`** — write operations built entirely on the instance's
  public API: `setLocale`, `loadBlock`, `unloadBlock`, `reloadBlock`,
  `patchMessage`, `clearCompiled`, the two `Intl` cache resets, and
  `missingKeysPatch()`, which turns the collected misses into a dictionary stub
  ready to drop into the locale files. `reloadBlock` resolves the upward case
  itself: a block loaded through a parent loader is unloaded under the parent's
  name, which is the only name `unloadBlock` acts on.
- **`devtools.setMode('keys' | 'pseudo' | 'off')`** — `keys` answers "where did
  this string come from" by rendering keys instead of translations; `pseudo`
  answers two questions at once, showing which strings never went through `t()`
  (they stay unaccented) and what a translation ~30% longer does to the layout.
  The `onTranslate` subscriber exists only while a mode is on, since it costs
  about 17% per translation. A miss stays a miss: `t()` still returns the key
  and `onMissingKey` still fires.

- **`connectVueDevtools(app, devtools)`** — a plugin for the Vue Devtools
  extension: its own inspector (instance → locales → blocks → keys → misses,
  with values editable in place), a timeline layer fed from the same event
  stream, and a `fint-i18n › blocks` field in the component inspector showing
  which blocks a component asked for. That last one is the only thing the in-app
  panel cannot offer, and it is why the integration exists at all.

  `@vue/devtools-api` is an **optional** peer dependency loaded dynamically:
  without it the call warns with instructions and returns `false` while
  everything else keeps working. The integration uses the v6-compatible plugin
  API, which extensions 7 and 8 support officially — in v8 it is literally the
  plugin API, `DevToolsPluginAPI = DevToolsV6PluginAPI`.

- **`devtools.metrics`** — counters for `t()` calls with optional sampling, the
  top keys, block load durations and dictionary sizes. Collection is off by
  default and the overlay turns it on only while its `metrics` tab is open,
  because it holds a subscriber on `onTranslate` and that costs about 17% per
  translation — a price the panel states in its header rather than hiding.

  One number is deliberately missing: the compilation-cache hit ratio. It is not
  observable from outside, since `t()` does not report where a result came from.
  Two honest numbers stand in its place — how many keys are compiled and how
  many distinct keys were asked for.

### Changed

- **The compilation-cache version is now read on every `t()`, not only on a
  cache hit.** An effect whose last render fell on a cache miss tracked the
  dictionary but not the invalidation, so the next invalidation never reached
  it — visible as a page that switched into a devtools mode but would not
  switch back. The hot path is unchanged: a cache hit read the version before
  as well (bench 15.25–15.39 against 15.0–15.5 M ops/s), and a consumer of
  `core + t()` grew by 4 bytes.

## [0.8.0] — 2026-08-27

### Added

- **`onWarning`** — one channel for the configuration problems that used to
  reach the console and nowhere else: a block with no loader, a wildcard that
  matched nothing, a stored locale `PersistencePlugin` could not confirm,
  message functions in an SSR snapshot, a write to `locale.value`. The payload
  carries a `code`, so cases are told apart by machine rather than by parsing
  text; with no subscriber the same text still goes to `console.warn`.
  `warn(hooks, code, message, context?)` is exported so plugins can use the same
  channel under their own codes.

  `Intl` warnings — invalid locale tag, invalid formatting options, invalid date
  — and the incomplete-plural-forms warning stay console-only: their caches are
  module-level and cannot reach an instance.
- **`onFallback`** — the fallback locale produced the translation, meaning the
  current locale has no such key. This is the only signal for untranslated
  content that still renders: `onMissingKey` stays silent, because a translation
  was found.
- **`onRetry`** — a loader failed and another attempt follows. Only the final
  failure used to surface, so "loads on the second attempt" was
  indistinguishable from "loads at once".

### Changed

- **BREAKING: `beforeLoadBlock` receives `{ block, locale }` instead of the
  block name.** With `preloadFallback` one `loadBlock()` starts two loads of the
  same name, and the old payload made them indistinguishable — leaving no way to
  measure a load or to show which locale is loading.
- **`getKnownLocales()` and `getAvailableLocales()` now react to
  `addLoaders()`.** The loader registry is a plain object, so a locale
  registered at runtime never reached a `computed` built on those calls: a
  locale switcher would not show a micro-frontend's locale until something else
  touched the dictionary.
- `useI18nScopeSync` no longer logs the failure itself. The same failure now
  reaches `onError` along with the block name and the locale, and the console
  fallback lives there.

### Performance

- **`emitSync` no longer copies the subscriber array when there is exactly one
  subscriber** — the common case for the bridge, the hook logger and anything
  built on `onTranslate`, which is emitted on every `t()` call. A length
  snapshot gives the same guarantee the copy gave: a handler that subscribes or
  unsubscribes mid-emit cannot shift the walk. Measured on
  `bench/core.bench.ts`: `t()` with an `onTranslate` subscriber 13.4 → 14.5 M
  ops/s, about −5 ns per call. A benchmark case for that path was added, since
  it had none.

### Fixed

- **Overwriting a message now re-renders every component showing it.** The
  compilation cache is a plain object, so a component whose first render hit an
  already warm cache subscribed to nothing at all: invalidating the cache
  removed the stale value but had no effect to restart, and two components on
  one key could end up showing different text after `mergeMessages()`. The same
  applied to `unloadBlock()`, where a component kept displaying a message that
  was no longer in the store. Invalidation now also bumps a version that
  `t()` and `te()` read on the cache-hit path — and only when something was
  actually removed, so an ordinary first load of a block still re-renders
  nothing. Measured cost: +1.5 ns per `t()` call, about 2–3 %.
- **A block that fails to load reaches `onError` on every path.** `reportError`
  ran only from `loadUsedBlocks`, that is on a locale switch; a failure while a
  scope was mounting reached nothing but `console.error`. Applications with an
  `onError` subscriber will start receiving failures they were never told about
  — that is the fix, not a regression.

## [0.7.0] — 2026-08-21

### Added

- **`negotiateLocale(requested, available, fallback?)`** — picks a starting
  locale from what the user asks for. Each requested tag runs a full cascade
  before the next one gets a turn: exact match, base language (`ru-RU` → `ru`),
  then any region of the same language (`ru` → `ru-RU`). Request order beats
  exactness, so `['ru-RU', 'en']` against `['en', 'ru']` yields `ru`. Comparison
  is case-insensitive and the returned value keeps the spelling from
  `available`, because that spelling is a dictionary key.
- **`parseAcceptLanguage(header)`** — the server-side source of preferences,
  where `navigator.languages` does not exist. Sorts by `q`, keeps header order
  for equal weights, drops `*` and `q=0`.

  Both are free functions in `@feugene/fint-i18n/core` and tree-shake away for
  applications that pick their locale some other way.
  See [Locale negotiation](./docs/en/api.md#locale-negotiation).

### Changed

- **A regional locale now falls back to the loaders of its base language.**
  With `locale: 'ru-RU'` and loaders registered for `ru`, the `ru` dictionary is
  found instead of the block being reported missing. Previously `ru-RU` and `ru`
  were unrelated keys, and a regional locale without its own loaders resolved to
  nothing.

  This changes resolution behaviour for anyone whose locales carry a region.
  An exact match still wins, and the walk is one-way: a `ru` locale does not
  pick up loaders registered for `ru-RU`. Messages are stored under the locale
  that was **requested**, not the one the loader was registered for, so `Intl`
  keeps receiving the full tag and `en-GB` goes on formatting dates the British
  way. The cost is memory if an application genuinely uses both spellings at
  once: the dictionary is then held under each key.
  See [Regional subtags](./docs/en/blocks.md#regional-subtags).
- **`PersistencePlugin` matches the stored locale through `negotiateLocale()`**
  instead of string equality. A value saved as `ru-RU` while the application
  ships `ru` is now applied as `ru` rather than discarded — storage values
  usually come from the browser, so they usually carry a region. A tag of an
  unrelated language is still rejected.

## [0.6.0] — 2026-08-05

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
- **Command-line tooling for dictionaries**, shipped as `bin` entries so a
  consuming project can run them through `npx` without installing anything:

  `fint-i18n-check-messages <locales dir> [--source <dir>]` checks that the
  locales agree with each other, that every set of plural forms covers the
  categories its locale actually uses, and — given `--source` — that the keys in
  the code and the keys in the dictionaries are the same set. Code is read
  through the TypeScript AST and `@vue/compiler-sfc`, so a `t('…')` inside a
  comment or a string is not mistaken for a call; `v-t` and prefixed scopes are
  understood. Keys assembled at runtime are reported rather than guessed, which
  is why unused keys are a report by default and only fail under `--strict`.

  `fint-i18n-codemod-plurals <paths…>` migrates 0.4.0 `|` markup to 0.5.0 form
  objects. It converts only labelled branches, where intent is unambiguous, and
  hands everything else to a human — `"Name | Email"` and `"{n} file | {n} files"`
  are indistinguishable in the old syntax, and guessing between them is what made
  that syntax dangerous in the first place.

  The parsers are loaded on demand and are not dependencies of this package.
  See [Tooling for dictionaries](./docs/en/tooling.md).

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
