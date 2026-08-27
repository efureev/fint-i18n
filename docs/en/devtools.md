# Devtools

A runtime debugging tool: which blocks are loaded and who uses them, why a key
was not found, what happened between two locale switches.

The core knows nothing about it. All state is collected from the public API,
from hooks and from wrappers over instance methods, so the library itself
carries no bytes for devtools — and neither will your application, as long as
you wire it the way described below.

## What it is and what it is not

Devtools answers questions about a **running application**. Questions about
dictionaries as files — are the locales in sync, is the set of plural forms
complete, which key is no longer used — belong to
[`check-messages`](./tooling.md): a static check sees every dictionary at once,
the runtime sees only what has been loaded.

## Setup

The only thing that makes "zero bytes in production" true is a separate subpath
plus a dynamic import behind a build condition:

```typescript
import { createFintI18n } from '@feugene/fint-i18n/core'

const plugins = import.meta.env.DEV
  ? [(await import('@feugene/fint-i18n/devtools')).createDevtools()]
  : []

const i18n = createFintI18n({ locale: 'en', plugins })
```

A static `import` of `@feugene/fint-i18n/devtools` in a shared file defeats that
guarantee: the bundler sees it unconditionally and ships it.

Wiring through `plugins` is preferable to handing over a ready instance:
`install` then runs inside the constructor — before the first loads and before
`installI18n` copies `t` into `$t` — so the history is complete. The second way
works too, but everything that happened before attaching is lost:

```typescript
const devtools = createDevtools(i18n)
```

## API

### `createDevtools(i18n?, options?)`

```typescript
interface DevtoolsOptions {
  name?: string        // instance name in the bridge, 'i18n' by default
  eventLimit?: number  // timeline size, 200 by default
  bridge?: boolean     // false — do not publish into window
}
```

Returns an object implementing `FintI18nPlugin`, so `dispose()` on the instance
detaches it on its own, through `uninstall`.

### `snapshot()`

State at the moment of the call: current and fallback locale, known and
available locales, registered and loaded blocks, usage counters, load durations,
missing keys, fallback hits, warnings, instance options, the plugin list and the
number of compiled keys per locale.

The `version` field is not decoration: the injection key is
`Symbol.for('FintI18n')`, that is global, and two different versions of the
package in one runtime share it. Versions differing between two snapshots is the
diagnosis itself.

After `dispose()` the call throws: devtools does not retain a released instance.

### `events`, `subscribe(listener)`, `clearEvents()`

The event timeline, newest last. A ring buffer: old entries are evicted once
`eventLimit` is reached.

Missing keys and fallback hits are **deduplicated**: only the first appearance
of a locale-plus-key pair reaches the timeline, the count lives in the snapshot.
Otherwise a single untranslated key on an active page would fill the timeline by
itself: `onMissingKey` fires again after every block load, and `onFallback` on
every `t()` call.

### `detach()`

Removes the subscriptions and restores the original references of the wrapped
methods without touching the instance. Needed when the panel closes while the
application keeps running.

## The in-app panel

`mountDevtoolsOverlay(devtools, options?)` mounts the panel and returns an
unmount function. The panel body is loaded through a dynamic `import()`, so an
application that only needs the snapshot in the console pays nothing for the UI.

```typescript
const devtools = createDevtools()
const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })

const unmount = await mountDevtoolsOverlay(devtools, {
  position: 'bottom-right',  // and the three other corners
  hotkey: 'alt+i',           // false — do not install a handler at all
  collapsed: false,          // true — start as a badge
})
```

Tabs: **locales**, **blocks**, **dictionary**, **missing**, **events**,
**caches**. The `↓` button in the header exports the snapshot and the timeline
as one JSON — handy to attach to a bug report.

The panel lives in its own Vue application and in a Shadow DOM rather than in
the application's tree. There are two reasons and neither has another fix: in
the host tree it would show up in the host's own Vue Devtools and in its
`useI18nScope` counters, and without a shadow root the application's styles
would tear it apart. No CSS import is needed — the styles travel inside.

Without a `document` (the server) `mountDevtoolsOverlay` returns a function that
does nothing, so the call is safe in universal code. In an SSR application mount
the panel **after hydration** — before it the snapshot would show a state the
application does not have yet.

### The panel's position and size

The panel is dragged by its header (anywhere without buttons), resized by its
bottom-right corner, and remembers where you left it.

- **Dragging** — by the header. The panel is never let out of the window as a
  whole, not merely "keeping a corner visible": a panel half over the edge is
  as useless as one that flew away entirely.
- **Edge snapping** — automatic, on release. Closer than 24 px to an edge and
  the panel settles 16 px away from it. There is deliberately no magnet during
  the drag: it tugs the panel under the cursor and makes precise placement
  harder. While a release would snap, the panel's border lights up.
- **Size** — the bottom-right corner: it is marked with hatching, the gesture
  itself is native (`resize: both`). From 320×200 and never larger than the
  window.
- **Reset** — double-click the header: the panel returns to the corner from the
  options and to its original size, and the record is dropped.

The position is stored as **an edge plus an offset**, not as coordinates. Hence
the main property: when a window edge moves, the panel travels with it — one
pinned to the right edge stays pinned on a narrow screen too. For the same
reason the record carries over between screens of different sizes.

On restore both position and size are put through a clamp against the current
window. Without it a record made on a large monitor would leave the panel off
screen, with no way to reach it.

```typescript
await mountDevtoolsOverlay(devtools, {
  storage: sessionStorage,  // localStorage by default
})

await mountDevtoolsOverlay(devtools, { storage: false })  // remember nothing
```

The storage key is `fint-i18n-devtools:layout`. A corrupt or incomplete record
is neither applied nor kept: the panel must not trip over it on every open.

## Actions and modes

`devtools.actions` — write operations, all through the instance's public API:

| Action | What it does |
| :--- | :--- |
| `setLocale(locale)` | switch the locale |
| `loadBlock(block, locale?)` | load a block |
| `unloadBlock(block, locale?)` | drop it from memory |
| `reloadBlock(block, locale?)` | unload and load again — the loader runs once more |
| `patchMessage(locale, key, value)` | edit a translation live; the key is dotted, as in `t()` |
| `clearCompiled(locale?)` | invalidate the compilation cache |
| `clearFormatterCache()` / `clearPluralCache()` | drop the `Intl` caches |
| `missingKeysPatch()` | a dictionary stub built from the misses — a ready JSON patch per locale |

`reloadBlock` deals with upward resolution itself: if `pages.articles` was
loaded by the `pages` loader, `pages` is what gets unloaded — otherwise the
second load would do nothing.

`patchMessage` goes through `mergeMessages`, so an edit re-renders **everything**
showing that message, including components that got it from the compilation
cache.

### The `t()` output mode

```typescript
devtools.setMode('keys')    // t() returns the key
devtools.setMode('pseudo')  // [Ĥéļļö, Åļéx!·····]
devtools.setMode('off')     // back to normal, byte for byte
```

**`keys`** answers "where did this string come from": the screen shows keys, and
finding the right one in the dictionary takes no guessing.

**`pseudo`** answers two questions at once: which string never went through
`t()` — it stays unaccented — and what a translation longer than English does to
the layout. Strings grow by roughly 30%, the way German and Finnish do.

The `onTranslate` subscriber lives exactly as long as the mode is on: every
translation costs about 17% more with it. A miss stays a miss — `t()` still
returns the key and `onMissingKey` still fires.

Switching a mode re-renders the whole page: it changes no dictionary, so
devtools invalidates the compilation cache, whose version `t()` reads on every
call. The one thing this does not reach is a component showing a key that does
not exist: its last render never touched the cache.

## The Vue Devtools extension

`connectVueDevtools(app, devtools)` registers a plugin with the extension: its
own inspector, a timeline layer and a field in the component inspector.

```typescript
const app = createApp(App)
app.use(createFintI18nPlugin(i18n))

const devtools = createDevtools(i18n)
await connectVueDevtools(app, devtools)
```

The inspector repeats the panel — locales, blocks, keys, misses — and that is
deliberate: whoever lives in the extension should not have to leave it for i18n.
A key's value is editable right there, as it is in the panel; a set of plural
forms and a message function stay read-only.

The one thing the panel cannot offer is a **link to the component tree**. In the
Components tab a component gains a `fint-i18n › blocks` field: the blocks it
asked for through `useI18nScope`. That knowledge is collected in the wrapper
around `registerUsage` — the scope calls it synchronously, before the first
`await`, so the component context is still there.

### An optional dependency

`@vue/devtools-api` is declared an `optional` peer dependency and loaded
dynamically. Without the package you get a warning with instructions and
`false`; the panel, the snapshot, the timeline and the `window` bridge keep
working in full.

```bash
yarn add -D @vue/devtools-api
```

The integration uses the v6-compatible plugin API — the same one Pinia and Vue
Router are built on. Extensions 7 and 8 support it officially: "Since v7.3.0, we
are fully compatible with the v6 plugin API". Note that in extension 7+ plugin
timelines live in the plugin's own menu rather than in a shared Timeline tab.

## Metrics

Counters for `t()` calls, the top keys, load durations and dictionary sizes.
Collection is **off by default**: it holds a subscriber on `onTranslate` — the
one hook emitted on every translation — and that costs about 17% per call.

```typescript
devtools.metrics.enable({ sampling: 10 })  // count every tenth call
devtools.metrics.snapshot()
devtools.metrics.reset()
devtools.metrics.disable()
```

In the **metrics** tab collection starts when the tab opens and stops the moment
you switch away or close the panel. While the tab is open the panel states that
cost right in the header — otherwise it is forgotten until the first performance
measurement.

`sampling: N` counts every Nth call and multiplies the result back in the
snapshot: `calls` is an estimate, `counted` is what was actually tallied. It
trades accuracy for the cost of the subscription, which is a fair trade on a hot
page with thousands of calls.

What the metrics do not and will not have: the **compilation-cache hit ratio**.
It is not observable from the outside — `t()` does not report where the result
came from. In its place there are two honest numbers side by side: how many keys
are compiled and how many distinct keys were asked for.

## The loader simulator

The failure paths — `ready`/`error` in `useI18nScopeSync`, retries, how
`preloadFallback` behaves — are otherwise only reachable from unit tests: in a
live application a loader cannot be made to fail.

```typescript
devtools.simulator.start({
  delay: 400,         // delay before the loader answers, ms
  failureRate: 1,     // share of failures, 0..1
  failAttempts: 2,    // fail the first two attempts, then let it through
  blocks: ['auth'],   // every registered block by default
})

devtools.simulator.stop()
```

The **blocks** tab has the same three fields and a button. While a simulation is
running the panel says so plainly — a minute later it otherwise looks like a
real breakage.

The simulator substitutes nothing. It registers an **additional** loader for
each block through the public `addLoaders()`: an empty object merges into
nothing, while the failure and the delay travel the real path — through retries,
`onError` and the scope's `ready`/`error`. That is also why the messages survive:
stop the simulation, load the block, and everything is as it was.

Two limits worth knowing up front:

- **`failAttempts` shows only on an instance created with the `retry` option.**
  Without it the first failure is final, and there are no retries to watch.
- **A registered loader cannot be removed through the public API**, so a stopped
  simulation makes it inert rather than dropping it: one extra call returning an
  empty object per block load, for the lifetime of the instance.

## Writing to the dictionaries on disk

This closes the loop: a miss or an edit made in the panel reaches the dictionary
on disk instead of staying in the tab's memory. It needs the dev-server plugin —
a separate subpath, wired into the build config:

```typescript
// vite.config.ts
import { fintI18nDevtools } from '@feugene/fint-i18n/vite'

export default defineConfig({
  plugins: [
    vue(),
    fintI18nDevtools({ locales: 'src/i18n/locales' }),
  ],
})
```

The locales directory is the same one
[`fint-i18n-check-messages`](./tooling.md) understands: `<locale>/<block>.json`
(nested folders become dots in the block name) or a flat `<locale>.json`.

The plugin declares `apply: 'serve'`: the endpoint writes files, and in a
production build it does not exist in any form.

The panel probes for the plugin when it opens. If it is there, a `disk` chip
lights up in the header and from then on:

- **an edit in the `dictionary` tab** goes both into memory and into the file;
- the `missing` tab gains a **write stub to dictionaries** button — the missing
  keys are created as empty strings, ready for a translator.

The stub **never overwrites an existing value**. That matters more than it
sounds: a key lands in the missing list also when it does exist in the file and
the block simply was not loaded at the time. Without that guard, "create what is
missing" would erase translations.

Dictionary formatting is preserved — two spaces and a trailing newline, like
every other file.

The client is available directly too:

```typescript
if (await devtools.devServer.probe()) {
  await devtools.devServer.write({ ru: { common: { hello: 'Привет' } } }, { overwrite: true })
}
```

## The window bridge

On attach devtools publishes itself into `window.__FINT_I18N_DEVTOOLS__` — this
is where the console and e2e tests reach it. Instances are held through
`WeakRef`, so the bridge retains nothing; on the server (no `window`) it does
nothing at all.

```typescript
__FINT_I18N_DEVTOOLS__.list()              // names of live instances
__FINT_I18N_DEVTOOLS__.snapshot()          // the first one, or by name
__FINT_I18N_DEVTOOLS__.events()
await __FINT_I18N_DEVTOOLS__.waitFor('auth', 'ru')
```

`waitFor(block, locale?, { name?, timeout? })` is what the bridge is for in
tests: wait for a block to load rather than for text on screen. An
already-loaded block resolves immediately; the promise rejects once `timeout`
(5000 ms by default) has passed.

## What devtools cannot see

Worth saying plainly: a tool trusted beyond what it can do is worse than no tool.

- **`t()` calls are not counted.** Subscribing to `onTranslate` costs +17% per
  translation, so there is no such subscription by default. Missing keys and
  fallbacks come from their own hooks and cost nothing.
- **`Intl` warnings and incomplete plural-form sets never reach the snapshot.**
  Their caches are module-level and cannot reach an instance, so they do not go
  through `onWarning` — only to the console.
- **The usage counter only grows from `useI18nScope`.** A component that merely
  calls `t('common.x')` registers no block and does not appear in the counter.
- **History before attaching is lost** when devtools is handed a ready instance
  instead of going through `plugins`.
