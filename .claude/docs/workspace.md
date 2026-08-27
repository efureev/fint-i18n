# Карта репозитория и команды

> **Читать когда:** нужна точная команда, непонятно, где что лежит, или нужен
> обзор публичного API без чтения всех исходников.

Пакетный менеджер — **Yarn 1.22 Classic**. Все команды из корня репозитория.

## Команды

```bash
# разработка
yarn playground          # = yarn dev; vite на :3000, открывать /fint-i18n/
yarn playground:build    # единственный гейт типов для playground
yarn playground:ssr      # SSR-витрина на :3100 (node-сервер + vite middleware)
yarn playground:ssr:build   # сборка client+server; гейт типов SSR-витрины
yarn playground:ssr:prod    # тот же сервер поверх собранного dist

# качество
yarn check:messages      # гейт CI: словари playground — паритет локалей,
                         # полнота форм CLDR, сверка ключей с кодом.
                         # Тот же скрипт на чужом проекте:
                         # node scripts/check-messages.mjs <локали> --source <код>
yarn codemod:plurals <пути> [--write] [--locale=ru] [--positional]
                         # словари с `|`-плюрализацией 0.4.0 → формы-объект;
                         # без --write только отчёт, размеченное конвертируется
                         # автоматически, остальное отдаётся человеку
yarn size                # сборка + гейт бюджета размера (size-budget.json)
yarn size:check          # только гейт, по уже собранному dist
yarn check:devtools      # гейт: код devtools не достижим ни из одного прод-entry
                         # (по графу импортов собранного dist)
yarn lint                # eslint (playground/**, docs/** игнорируются)
yarn lint:fix
yarn type-check          # vue-tsc --noEmit: src, bench, корневые конфиги
yarn test                # vitest watch, пакет
yarn test:run            # vitest run, пакет
yarn test:coverage       # пакет + playground
yarn test:coverage:package
yarn test:coverage:playground

# сборка и анализ
yarn build               # vite build + vue-tsc -p tsconfig.build.json (d.ts)
yarn build:analyze       # ANALYZE=true → analysis/stats.{html,json,md}
yarn bench               # → dist/analysis/bench-results.json

# публикуемая поверхность (dist в .gitignore — только --pack npm)
npx --yes publint --pack npm
npx --yes @arethetypeswrong/cli --pack
```

## Структура

```
src/
  index.ts              баррель всех трёх слоёв
  core/                 рантайм без компонентных API Vue
    instance.ts           FintI18n: t, loadBlock, setLocale, счётчики, merge
    loader-registry.ts    нормализация лоадеров, восходящий резолвинг, wildcard
    compiler.ts           JIT-компиляция шаблонов (без new Function)
    hooks.ts              HookManager + типы FintI18nHooks
    message-utils.ts      deepMerge, getMessageValue, mergeMessageValues
    translate-params.ts   нормализация параметров t()
    plural.ts             формы CLDR: selectPluralCategory, compilePluralForms
    format.ts             Intl-обёртки с кэшем: formatNumber/formatDate,
                          createFormatters
    ssr.ts                getSSRState (снимок) / hydrate (приём на клиенте)
    types.ts              публичные типы, MessageKeys/MessageKey
  vue/
    plugin.ts             installI18n, createFintI18nPlugin
    inject.ts             FINT_I18N_KEY (Symbol.for), useFintI18n
    scope.ts              useI18nScope (async) / useI18nScopeSync
    directive.ts          v-t + getSSRProps
    format.ts             useI18nFormat — форматтеры на текущей локали
    global-types.ts       opt-in аугментация $t/$i18n/v-t
  plugins/
    persistence.ts        локаль в Storage + синхронизация вкладок
    bridge.ts             двусторонний мост к vue-i18n
    hook-logger.ts        логирование всех хуков
  devtools/             отладка рантайма; dev-only, в проде ноль байт
    index.ts              createDevtools() — плагин, снимок, лента, detach
    state.ts              теневое состояние: блоки, промахи, фолбэки, предупреждения
    timeline.ts           кольцевой буфер событий
    internals.ts          единственное место, читающее приватные поля инстанса
    bridge.ts             window.__FINT_I18N_DEVTOOLS__ — консоль и e2e
bench/core.bench.ts     горячий путь: compileTemplate, t()
playground/             витрина (GitHub Pages), алиасы на src/**
playground-ssr/         SSR-витрина: renderToString → снимок → гидрация
  server.mjs              node-сервер без зависимостей, dev и --prod
  src/entry-server.ts     render(url) → { html, payload }
  src/entry-client.ts     hydrate() до mount
scripts/                инструменты; check-messages и codemod публикуются как bin
  check-messages.mjs      проверка словарей, парсеры (typescript,
                          @vue/compiler-sfc) грузятся динамически
  codemod-plural-forms.mjs  миграция плюрализации 0.4.0 → 0.5.0
  check-size.mjs          гейт бюджета размера, внутренний (не публикуется)
  check-devtools-isolation.mjs  гейт «devtools не достижим из прод-entry»
  consumer-size.mjs       размер у потребителя (`yarn size:consumer`)
  __tests__/              тесты скриптов; идут в ПАКЕТНОМ прогоне vitest
docs/{en,ru}/           11 зеркальных разделов
```

## Публичный API — шпаргалка

**Создание и установка**

- `createFintI18n<Schema>(options)` → `FintI18n<Schema>`
- опции: `locale`, `fallbackLocale`, `loaders`, `plugins`, `retry`,
  `preloadFallback`, `unloadUnusedBlocks`
- `installI18n(app, i18n, { directive?, globalInstall? })` — низкоуровневая
- `createFintI18nPlugin(i18n, options)` — конвенциональная обёртка для `app.use`

**Инстанс**

| Метод | Назначение |
| --- | --- |
| `t(key, params?, options?)` | перевод; при промахе возвращает сам ключ |
| `te(key, locale?)` | есть ли ключ — без фолбэка «вернуть сам ключ» |
| `tm(key, locale?)` | поддерево сообщений по префиксу |
| `locale` / `setLocale(l)` | чтение реактивно; писать — только через `setLocale` |
| `messages` | `readonly`-представление словарей |
| `loadBlock(name, locale?)` | поддерживает wildcard |
| `isBlockLoaded` / `markBlockLoaded` | второе — low-level, для SSR-гидрации |
| `unloadBlock(name, locale?)` | по имени **фактически загруженного** блока |
| `mergeMessages(locale, block, messages)` | единственный легальный путь мутации |
| `registerUsage` / `unregisterUsage` / `registerBlocks` | reference counting |
| `loadUsedBlocks(locale)` | догрузка всех используемых блоков |
| `addLoaders(source)` | рантайм-регистрация; сбрасывает кэш wildcard'ов |
| `getKnownLocales()` | локали **только** из зарегистрированных лоадеров |
| `getAvailableLocales()` | лоадеры + уже смерженные словари; валидировать внешний ввод нужно по нему |
| `getLoadedBlocks()` | `{ локаль: имена загруженных блоков }` |
| `fallbackLocale` | публичное **изменяемое поле** (не ref, не сеттер) |
| `hooks` | `HookManager`: `on` (возвращает отписку), `off`, `has`, `emit`, `emitSync` |
| `dispose()` | вызывает `uninstall` у плагинов |

**Vue-слой**

- `useFintI18n<Schema>()` — бросает, если `installI18n` не вызван
- `await useI18nScope(blocks, { prefix? })` — требует `<Suspense>` выше
- `useI18nScopeSync(blocks, options)` — без Suspense, отдаёт `ready: Ref<boolean>`
- `v-t="'key'"` / `v-t="{ path, params }"`, модификаторы `.once`, `.preserve`

**Плагины**

- `new PersistencePlugin({ key?, storage?, syncTabs? })`
- `new BridgePlugin({ i18n, priority?: 'fint' | 'vue-i18n' })`
- `new HookLoggerPlugin({ logger?, prefix? })`

**Devtools** (`@feugene/fint-i18n/devtools`, только dev)

- `createDevtools(i18n?, { name?, eventLimit?, bridge? })` → плагин со
  `snapshot()`, `events`, `subscribe()`, `clearEvents()`, `detach()`
- `window.__FINT_I18N_DEVTOOLS__`: `list()`, `snapshot(name?)`, `events(name?)`,
  `waitFor(block, locale?, options?)`

## Subpath-экспорты

| Subpath | Entry |
| --- | --- |
| `@feugene/fint-i18n` | `src/index.ts` |
| `@feugene/fint-i18n/core` | `src/core/index.ts` |
| `@feugene/fint-i18n/vue` | `src/vue/index.ts` |
| `@feugene/fint-i18n/vue/global-types` | `src/vue/global-types.ts` |
| `@feugene/fint-i18n/plugins` | `src/plugins/index.ts` |
| `@feugene/fint-i18n/devtools` | `src/devtools/index.ts` |

Добавление следующего — шесть точек синхронизации, см. «Жёсткие правила» в `CLAUDE.md`.
