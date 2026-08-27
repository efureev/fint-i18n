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
