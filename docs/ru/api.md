# Справочник API

В данном разделе представлено подробное техническое описание всех функций, методов и интерфейсов библиотеки
`@feugene/fint-i18n`.

---

## Глобальные функции

### `createFintI18n(options)`

Основная функция для инициализации библиотеки. Импортируется из `@feugene/fint-i18n/core`.

```typescript
function createFintI18n<Schema extends MessageSchemaConstraint = any>(
    options: FintI18nOptions,
): FintI18n<Schema>;

type Locale = string;
type LocaleBlockLoader = () => Promise<{ default: MessageValue } | MessageValue>;
type LocaleBlockLoaders = LocaleBlockLoader | LocaleBlockLoader[];
type LocaleLoaderCollection = Record<Locale, Record<string, LocaleBlockLoaders>>;
type LocaleLoaderSource = LocaleLoaderCollection | LocaleLoaderCollection[];

interface FintI18nOptions {
    locale: Locale;                    // Начальный язык
    fallbackLocale?: Locale;           // Резервный язык (значение по умолчанию — ниже)
    loaders?: LocaleLoaderSource;      // Одна или несколько коллекций loaders
    plugins?: FintI18nPlugin[];        // Список плагинов
    preloadFallback?: boolean;         // Грузить блоки также для fallbackLocale (по умолчанию: false)
    unloadUnusedBlocks?: boolean;      // Выгружать блок, когда счётчик использований дошёл до 0 (по умолчанию: false)
    retry?: RetryOptions;              // Повторы при отказе загрузки (по умолчанию выключены)
}

interface RetryOptions {
    attempts?: number;                 // Всего попыток, включая первую (по умолчанию 3)
    backoff?: (attempt: number) => number; // Пауза в мс перед попыткой `n` (по умолчанию 100·2^(n−1))
    timeout?: number;                  // Потолок ожидания одной попытки, мс
}
```

**Параметры:**

- `options` (объект):
    - `locale` (`Locale`): Начальный язык приложения.
    - `fallbackLocale` (`Locale`, optional): Резервный язык. **По умолчанию `''` (пустая строка), то есть fallback
      выключен.** Если задан — `t()` повторяет поиск отсутствующего ключа в этой локали перед тем, как считать его
      missing.
    - `loaders` (`LocaleLoaderSource`, optional): Одна package-level коллекция loaders или массив таких коллекций.
    - `plugins` (`FintI18nPlugin[]`, optional): Массив плагинов для расширения функционала.
    - `preloadFallback` (`boolean`, optional, по умолчанию `false`): Если `true`, каждый `loadBlock()` дополнительно
      грузит тот же блок для `fallbackLocale`. Без этого fallback срабатывает только по уже загруженным сообщениям.
    - `unloadUnusedBlocks` (`boolean`, optional, по умолчанию `false`): Если `true`, блок выгружается из памяти
      (сообщения + кэш компиляции), когда счётчик его использований опускается до нуля (размонтирован последний
      компонент, запросивший блок через `useI18nScope`).
      См. [Блоки → Жизненный цикл и память](./blocks.md#жизненный-цикл-и-память).
    - `retry` (`RetryOptions`, optional): Повторять упавший лоадер. По умолчанию выключено — ровно одна попытка, как
      и до 0.6.0. См. [Повторы при отказе загрузки](#повторы-при-отказе-загрузки).

**Возвращает:** Экземпляр `FintI18n<Schema>`.

#### Типизированные ключи сообщений (`Schema`)

`createFintI18n<Schema>()` (и `useFintI18n<Schema>()`) принимают опциональный дженерик схемы сообщений. Если он задан,
`t()` автодополняет литеральные ключи, при этом по-прежнему принимая произвольные строки для динамически
конструируемых ключей:

```typescript
interface AppSchema {
    common: { welcome: string; user: { profile: string } };
    files: { one: string; other: string };
}

const i18n = createFintI18n<AppSchema>({locale: 'en'});

i18n.t('common.welcome')        // ✅ автодополнение
i18n.t('common.user.profile')   // ✅
i18n.t('files')                 // ✅ набор плюральных форм — лист
i18n.t(`common.${dynamic}`)     // ✅ по-прежнему допустимо (сводится к `string`)
```

Схема работает и как `interface`, и как `type`. Автодополнение предлагает
литеральные ключи, но произвольная строка остаётся допустимой, поэтому опечатка
**не** является ошибкой компиляции — `t()` принимает любую строку намеренно,
ради динамически конструируемых ключей.

Связанные экспортируемые типы:

```typescript
type MessagePrimitive = string | number | boolean;
type MessageFunction = (params?: Record<string, any>) => string;

interface MessageSchema {
    [key: string]: MessagePrimitive | MessageFunction | MessageSchema
}

type MessageValue = MessagePrimitive | MessageFunction | MessageSchema;

// Ограничение дженерика схемы: любой объектный тип, поэтому `interface` тоже подходит
type MessageSchemaConstraint = Record<string, any>;

// Все листовые ключи схемы в dot-нотации: { common: { welcome: string } } → 'common.welcome'
type MessageKeys<S>;
// Тип ключа, принимаемого t(): литеральные ключи схемы | (string & {})
type MessageKey<S>;
```

#### Контракт loaders

```typescript
type LocaleBlockLoader = () => Promise<{ default: MessageValue } | MessageValue>;
type LocaleBlockLoaders = LocaleBlockLoader | LocaleBlockLoader[];

type LocaleLoaderCollection = {
    [locale: Locale]: {
        [blockName: string]: LocaleBlockLoaders;
    };
};
```

- `LocaleLoaderCollection` удобно экспортировать из пакета как готовый i18n-артефакт.
- `LocaleLoaderSource` позволяет передать в `createFintI18n()` как одну collection, так и массив collections.
- Loader может вернуть либо сами сообщения, либо namespace-модуль с экспортом `default` (например,
  `() => import('./en.json')`) — `default` разворачивается автоматически.
- Если у одного `blockName` несколько loaders, они выполняются последовательно и их результаты merge-ятся в порядке
  объявления.
- Если один и тот же `blockName` приходит из нескольких package collections, итоговый порядок loaders сохраняет порядок
  массива `loaders: [...]`.

---

## Композаблы (Vue 3)

### `useFintI18n()`

Обеспечивает доступ к текущему экземпляру i18n внутри компонентов Vue. Импортируется из `@feugene/fint-i18n/vue`.

```typescript
function useFintI18n<Schema extends MessageSchemaConstraint = any>(): FintI18n<Schema>;
```

**Возвращает:** Экземпляр `FintI18n`, предоставляющий доступ к реактивной локали и методам перевода. Бросает исключение,
если для приложения не был вызван `installI18n()`.

### `useI18nScope(blocks, options?)`

Асинхронный композабл для управления областью видимости блоков перевода в компоненте. Импортируется из
`@feugene/fint-i18n/vue`.

```typescript
async function useI18nScope(
    blocks: string | string[],
    options?: UseI18nScopeOptions,
): Promise<I18nScope>;

interface UseI18nScopeOptions {
    /**
     * Префиксовать ключи именем блока: t('login') → t('auth.login').
     * Работает только с одиночным конкретным блоком (не паттерном).
     */
    prefix?: boolean;
}

interface I18nScope {
    t: (key: string, params?: Record<string, any>) => string;
    locale: ComputedRef<Locale>;
    setLocale: (l: Locale) => Promise<void>;
}
```

**Параметры:**

- `blocks` (`string | string[]`): Имя блока или массив имён блоков, необходимых компоненту. Поддерживаются
  wildcard-паттерны (`prefix.*`, `prefix.**`).
- `options.prefix` (`boolean`, optional): Если `true` и передан один конкретный блок, `scope.t('key')` автоматически
  префиксуется именем блока. Для нескольких блоков или паттерна игнорируется (с предупреждением в консоль).

**Особенности:**

- Автоматически загружает указанные блоки при инициализации компонента и регистрирует/снимает их использование (подсчёт
  ссылок) в течение жизненного цикла компонента.
- Должен использоваться с `await` в `<script setup>` (требует `Suspense` в родительском компоненте).

### `useI18nScopeSync(blocks, options?)`

Синхронный вариант `useI18nScope` — **не** требует `<Suspense>`. Блоки грузятся в фоне; флаг `ready` сигнализирует о
готовности. Импортируется из `@feugene/fint-i18n/vue`.

```typescript
function useI18nScopeSync(
    blocks: string | string[],
    options?: UseI18nScopeOptions,
): I18nScopeSync;

interface I18nScopeSync extends I18nScope {
    /** Становится `true`, когда загрузка завершилась — в любом исходе. */
    ready: Ref<boolean>;
    /** Причина отказа загрузки, иначе `null`. */
    error: Ref<unknown>;
}
```

Пока `ready` не станет `true`, `t()` возвращает ключи, которые разрешаются по мере прихода блоков (директива и `t()`
реактивны, поэтому UI обновится автоматически).

Отказавший блок не оставляет скоуп в вечной загрузке: `ready` становится `true` в любом случае, а причина попадает в
`error` (и дополнительно репортится в `console.error`). Спиннер гейтите по `ready`, запасной вариант — по `error`.

### `useI18nFormat()`

Форматтеры чисел и дат, привязанные к текущей локали. Импортируется из `@feugene/fint-i18n/vue`.

```typescript
function useI18nFormat(): I18nFormatters;

interface I18nFormatters {
    n: (value: number | bigint, options?: Intl.NumberFormatOptions) => string;
    d: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
}
```

Локаль читается в момент вызова, поэтому результат в шаблоне или `computed` пересчитывается после `setLocale()`. Набор
форматтеров общий на инстанс — вызов композабла в множестве компонентов не создаёт лишних объектов.
См. [Форматирование чисел и дат](#форматирование-чисел-и-дат).

---

## Экземпляр `FintI18n` (Core API)

Методы, доступные в экземпляре класса `FintI18n`.

### `locale`

```typescript
readonly
locale: WritableComputedRef<Locale>;
```

Реактивная текущая локаль. **Чтение** реактивно (`i18n.locale.value`).

> [!WARNING]
> Прямая запись (`i18n.locale.value = 'ru'`) **устарела**: она делегирует в `setLocale()` и выводит одноразовое
предупреждение. Используйте `setLocale()` напрямую — он к тому же дожидается загрузки используемых блоков перед
переключением.

### `messages`

```typescript
readonly
messages: Readonly<Record<Locale, MessageSchema>>;
```

Read-only представление загруженных словарей. Изменять — только через `mergeMessages()` / `loadBlock()`.

### `t(key, params, options)`

Основной метод для получения перевода.

```typescript
declare function t(
    key: MessageKey<Schema>,
    params?: Record<string, any>,
    options?: TranslateOptions,
): string;

interface TranslateOptions {
    /** Переопределяет `fallbackLocale` инстанса только для этого вызова. */
    fallbackLocale?: Locale;
}
```

- **`key`** (string): Полный путь к ключу (например, `common.welcome`).
- **`params`** (object, optional): Параметры для интерполяции. Поддерживает значения `Ref` (они разворачиваются).
- **`options`** (object, optional):
    - **`fallbackLocale`** (`Locale`): Резервная локаль для этого вызова, имеет приоритет над `fallbackLocale` уровня
      инстанса. Если ключ отсутствует в текущей локали, он ищется здесь.
- **Возвращает:** разрешённую строку либо сам `key`, если он не разрешился ни в текущей, ни в резервной локали
  (missing-key репортится один раз на пару `locale:key`).

### `setLocale(locale)`

Сменяет текущую локаль приложения. Перед переключением дожидается загрузки зарегистрированных, но ещё не загруженных
блоков для целевой локали — чтобы не показывать сырые ключи. Конкурентные вызовы схлопываются: применяется только
последняя запрошенная локаль.

```typescript
declare function setLocale(locale: Locale): Promise<void>;
```

- **`locale`** (`Locale`): Код новой локали.

### `loadBlock(blockName, locale?)`

Асинхронно загружает указанный блок сообщений.

```typescript
declare function loadBlock(blockName: string, locale?: Locale): Promise<void>;
```

- **`blockName`** (string): Имя блока для загрузки. Wildcard-паттерны (`prefix.*`, `prefix.**`) разворачиваются, и
  совпавшие блоки грузятся параллельно.
- **`locale`** (`Locale`, optional): Если не указано, загружает для текущей локали. При включённом `preloadFallback`
  блок также грузится для `fallbackLocale`.

**Правила резолвинга loaders:**

- Сначала ищется точный `blockName`.
- Если точный block не найден и имя содержит точку, ищется ближайший parent block (`pages.articles.comments` →
  `pages.articles` → `pages`).
- Если для блока найден массив loaders, они выполняются последовательно.

### `addLoaders(source)`

Регистрирует дополнительные лоадеры после создания инстанса (микрофронтенды, динамически подключаемые модули).
Сбрасывает кэш развёртки wildcard-паттернов.

```typescript
declare function addLoaders(source: LocaleLoaderSource): void;
```

> Паттерны, развёрнутые более ранним вызовом, пересчитываются при следующем использовании; но см. оговорку
> в [Блоки → Wildcard-регистрация](./blocks.md#wildcard-регистрация-prefix-и-prefix): развёртка паттерна опирается на
> лоадеры, известные на момент развёртки.

### `getKnownLocales()`

Возвращает локали, известные из зарегистрированных лоадеров.

```typescript
declare function getKnownLocales(): readonly Locale[];
```

### `mergeMessages(locale, blockName, messages)`

Вручную добавляет сообщения в хранилище (используется внутри `loadBlock`; полезно для SSR-гидрации или тестов).

```typescript
declare function mergeMessages(locale: Locale, blockName: string, messages: MessageValue): void;
```

- **`locale`** (`Locale`): Локаль.
- **`blockName`** (string): Имя блока (может быть с точками, например `pages.articles`).
- **`messages`** (object | string | function): Сообщения для merge в этот блок.

### `isBlockLoaded(blockName, locale?)`

Возвращает, загружен ли блок (или любой из его родителей) для указанной локали.

```typescript
declare function isBlockLoaded(blockName: string, locale?: Locale): boolean;
```

### `unloadBlock(blockName, locale?)`

Выгружает блок из памяти: удаляет поддерево сообщений, инвалидирует кэш компиляции и сбрасывает отметку о загрузке
(следующий `loadBlock` загрузит его заново).

```typescript
declare function unloadBlock(blockName: string, locale?: Locale): void;
```

> Если блок был загружен через родительский лоадер (например, `pages.articles` резолвится в `pages`), выгружать нужно по
> **имени загруженного (родительского) блока**.

### Подсчёт использований: `registerUsage` / `registerBlocks` / `unregisterUsage`

Подсчёт ссылок, который управляет ленивой загрузкой в `setLocale()` (через `loadUsedBlocks`) и опциональной выгрузкой
(`unloadUnusedBlocks`). `useI18nScope` вызывает их за вас; вне компонентов используйте напрямую.

```typescript
declare function registerUsage(blockName: string): void;    // +1 (поддерживает паттерны)
declare function registerBlocks(blockNames: string[]): void; // registerUsage для каждого
declare function unregisterUsage(blockName: string): void;   // -1 (поддерживает паттерны)
```

Wildcard-паттерны (`prefix.*`, `prefix.**`) разворачиваются в конкретные имена блоков через общий кэш, поэтому
`unregisterUsage` снимает счётчики ровно у тех child-блоков, которым их поднял `registerUsage`.

### `loadUsedBlocks(locale)`

Грузит все зарегистрированные и всё ещё используемые блоки, которые ещё не загружены для `locale`, циклом до сходимости
(блоки, зарегистрированные во время загрузки, догружаются следующей итерацией). Ошибка одного блока не отменяет загрузку
остальных — отказы репортятся через хук `onError`.

```typescript
declare function loadUsedBlocks(locale: Locale): Promise<void>;
```

### `markBlockLoaded(blockName, locale)`

Низкоуровневый метод: помечает блок как загруженный для локали (используется внутри после успешной загрузки). Вызывайте
напрямую только если внедряете сообщения через `mergeMessages()` и хотите, чтобы блок считался загруженным (например,
SSR-гидрация).

```typescript
declare function markBlockLoaded(blockName: string, locale: Locale): void;
```

### `dispose()`

Освобождает инстанс: снимает плагины, снимает **все** подписки на хуки, очищает словари, кэш компиляции и учёт блоков.
Вызывайте, когда per-request/SSR-инстанс больше не нужен.

После `dispose()` инстанс пуст, а не сломан: `t()` возвращает ключи, а загрузка, не успевшая завершиться, отбрасывается
и не воскрешает словарь. Повторный вызов безопасен.

```typescript
declare function dispose(): void;
```

### `hooks.on(name, callback)`

Подписывается на хуки жизненного цикла i18n.

```typescript
declare function on<K extends keyof FintI18nHooks>(name: K, fn: FintI18nHooks[K]): () => void;
```

**Возвращает:** Функцию отписки.

**Доступные хуки (`FintI18nHooks`):**

| Хук               | Payload                       | Когда                                                                          |
|-------------------|-------------------------------|--------------------------------------------------------------------------------|
| `afterInit`       | `void`                        | Эмитится синхронно в конце конструктора (успевают подписаться только плагины). |
| `onLocaleChange`  | `{ locale, previous }`        | После смены активной локали.                                                   |
| `beforeLoadBlock` | `string` (имя блока)          | Перед запуском loaders блока.                                                  |
| `afterLoadBlock`  | `{ block, locale, messages }` | После завершения загрузки блока.                                               |
| `onMissingKey`    | `{ key, locale }`             | Ключ не удалось разрешить (дедуп по `locale:key`).                             |
| `onTranslate`     | `{ key, params?, result }`    | На каждый вызов `t()`; обработчик может переписать `result`.                   |
| `onError`         | `{ error, block?, locale? }`  | Ошибки асинхронной загрузки блоков. Без подписчиков — `console.error`.         |

---

## Директива `v-t`

Vue-директива для высокопроизводительного вывода переводов. Регистрируется через `installI18n` (по умолчанию как `v-t`).

```typescript
type VTDirectiveValue = string | { path: string, params?: Record<string, any> };
```

**Синтаксис:**

- `v-t="'block.key'"` — простой вывод.
- `v-t="{ path: 'block.key', params: { name: 'John' } }"` — с параметрами.

**Реактивность (по умолчанию):**

- Текст элемента **реактивен**: перерисовывается при смене локали и при доподгрузке ленивых блоков (через per-element
  `watchEffect`). Это поведение по умолчанию — модификатор не нужен.

**Модификаторы:**

- `.once`: Рендерит перевод **один раз**, без реактивности. Последующие изменения локали/параметров/блоков
  игнорируются — используйте для статичных подписей, где реактивность не нужна.
- `.preserve`: Если ключ не разрешился (`t()` вернул сам ключ), сохраняет текущий текст элемента вместо перезаписи его
  сырым ключом. Полезно, чтобы не мигать сырыми ключами, пока блок ещё грузится.

```vue
<span v-t="'common.welcome'"/>          <!-- реактивно -->
<span v-t.once="'brand.name'"/>         <!-- рендерится один раз, без реактивности -->
<span v-t.preserve="'lazy.title'"/>     <!-- сохраняет текущий текст, пока ключ не разрешится -->
```

**SSR:**

- Директива реализует `getSSRProps`, поэтому при серверном рендеринге выводит переведённый текст в `textContent`.
  Убедитесь, что нужные блоки загружены до рендера на сервере (например, `await i18n.loadBlock(...)` /
  `loadUsedBlocks()`).

---

## Vue-плагин (`installI18n`)

Регистрирует экземпляр `FintI18n` в приложении Vue: провайдит его через `provide/inject`, опционально регистрирует
глобальные свойства (`$t`, `$i18n`) и директиву `v-t`. Импортируется из `@feugene/fint-i18n/vue`.

```typescript
import type {App} from 'vue'

type GlobalInstallFn = (app: App, i18n: FintI18n) => void

interface InstallI18nOptions {
    /**
     * Управляет регистрацией директивы `v-t`.
     * - `string` — зарегистрировать директиву под указанным именем (например, `'i18n'` → `v-i18n`).
     * - `true` или не задано — зарегистрировать под именем по умолчанию `'t'` (`v-t`).
     * - `false` — директива не регистрируется.
     */
    directive?: string | boolean

    /**
     * Управляет регистрацией глобальных свойств (`$t`, `$i18n`).
     * - функция — вызывается вместо стандартной регистрации; вы сами решаете,
     *   как и под какими именами выставлять свойства (или добавлять дополнительные хелперы);
     * - `true` — выполняется стандартная регистрация (`app.config.globalProperties.$t = i18n.t`,
     *   `app.config.globalProperties.$i18n = i18n`);
     * - `false` — ничего не регистрируется.
     * Если опция не передана — используется значение `true`.
     */
    globalInstall?: boolean | GlobalInstallFn
}

declare function installI18n(app: App, i18n: FintI18n, options?: InstallI18nOptions): void
```

**Поведение:**

- Всегда вызывает `app.provide(FINT_I18N_KEY, i18n)`, поэтому `useFintI18n()` и `useI18nScope()` работают независимо от
  `globalInstall`.
- Эффективное значение `globalInstall` вычисляется как `options.globalInstall ?? true`.
- Если передана функция, она полностью заменяет стандартную регистрацию — `$t` и `$i18n` автоматически выставлены не
  будут.

#### Примеры

Стандартная регистрация (эквивалент пропуска опции):

```typescript
installI18n(app, i18n) // регистрирует $t, $i18n и директиву v-t
```

Отключить глобальные свойства (когда используются только композаблы и/или директива `v-t`):

```typescript
installI18n(app, i18n, {globalInstall: false})
```

Кастомная регистрация — например, выставить под другими именами или добавить хелперы:

```typescript
import {installI18n} from '@feugene/fint-i18n/vue'

installI18n(app, i18n, {
    globalInstall: (app, i18n) => {
        app.config.globalProperties.$tr = i18n.t
        app.config.globalProperties.$i18n = i18n
        app.config.globalProperties.$locale = i18n.locale
    },
})
```

Изменить имя директивы или отключить её:

```typescript
installI18n(app, i18n, {directive: 'i18n'}) // v-i18n="..."
installI18n(app, i18n, {directive: false})  // не регистрировать директиву
```

### `createFintI18nPlugin(i18n, options?)`

Стандартная обёртка Vue-плагина поверх `installI18n` — для конвенционального `app.use()`. Импортируется из
`@feugene/fint-i18n/vue`.

```typescript
declare function createFintI18nPlugin(i18n: FintI18n, options?: InstallI18nOptions): Plugin;
```

```typescript
import {createFintI18n} from '@feugene/fint-i18n/core'
import {createFintI18nPlugin} from '@feugene/fint-i18n/vue'

const i18n = createFintI18n({locale: 'en'})
app.use(createFintI18nPlugin(i18n, {globalInstall: false}))
```

---

## Глобальные свойства

При регистрации через `installI18n(app, i18n)` из `@feugene/fint-i18n/vue` со включённым `globalInstall` (по умолчанию),
в шаблонах становятся доступны:

- **`$t`**: Глобальный аналог функции `t()`.
- **`$i18n`**: Доступ к экземпляру i18n.

> [!TIP]
> Если передан `globalInstall: false`, `$t`/`$i18n` не регистрируются. Используйте `useFintI18n()` / `useI18nScope()`
или передайте функцию-регистратор, чтобы выставить свойства под собственными именами.

### Опциональная глобальная аугментация типов

Регистрация `$t`, `$i18n` и `v-t` в рантайме сама по себе **не** включает их типизацию в шаблонах. Глобальная
TypeScript-аугментация (`ComponentCustomProperties.$t` / `$i18n` и типы директивы `v-t`) теперь **opt-in** —
импортируйте её один раз, например в entry-файле приложения или в `*.d.ts`:

```typescript
import '@feugene/fint-i18n/vue/global-types'
```

> [!IMPORTANT]
> Раньше эта аугментация применялась автоматически. Если вы полагались на типизацию `$t`/`$i18n`/`v-t` в шаблонах,
добавьте импорт выше после обновления.
См. [migration note в installation.md](./installation.md#migration-глобальная-аугментация-типов-теперь-opt-in).

---

## Интерполяция шаблонов

Сообщения компилируются в функции (без `new Function`, CSP-safe). Синтаксис плейсхолдеров:

- `{name}` — подстановка параметра. Имя может содержать буквы, цифры, `_`, `.` и `-`.
- Отсутствующий или `null`/`undefined` параметр оставляет плейсхолдер как есть.
- `{{` и `}}` — **экранирование**: выводятся как литеральные `{` и `}`.

```typescript
i18n.t('greeting', {name: 'Alex'}) // "Hello, {name}!" → "Hello, Alex!"
i18n.t('literal')                    // "Use {{name}} as a placeholder" → "Use {name} as a placeholder"
```

---

## Плюрализация

Формы множественного числа — это **форма значения**: объект, все ключи которого
являются ключами форм. `t()` выбирает форму по параметру `count` (или `n`) через
`Intl.PluralRules` — отдельного метода нет, специального синтаксиса внутри
строки тоже.

```typescript
i18n.mergeMessages('ru', 'cart', {
  items: {
    '=0':    'корзина пуста',
    'one':   '{count} товар',
    'few':   '{count} товара',
    'many':  '{count} товаров',
    'other': '{count} товара',
  },
})

i18n.t('cart.items', { count: 0 })  // "корзина пуста"
i18n.t('cart.items', { count: 1 })  // "1 товар"
i18n.t('cart.items', { count: 3 })  // "3 товара"
i18n.t('cart.items', { count: 11 }) // "11 товаров"
```

### Ключи форм

Ключ — это либо категория CLDR (`zero`, `one`, `two`, `few`, `many`, `other`),
либо точное значение `=N`, которое проверяется раньше категорий и принимает
отрицательные и дробные числа (`=0`, `=-1`, `=1.5`).

`other` обязателен: это форма, в которую может упасть любая локаль при любом
счётчике. Набор без неё продолжает работать, но предупреждает при компиляции.

```typescript
type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
type PluralFormKey = PluralCategory | `=${number}`;

type PluralForms =
  & { other: string }
  & Partial<Record<Exclude<PluralCategory, 'other'>, string>>
  & Partial<Record<`=${number}`, string>>;
```

Какие формы нужны локали: `en` использует `one` и `other`; `ru` — `one`, `few`,
`many` и `other`; `ja` — только `other`. Спросить рантайм можно через
`getPluralCategories(locale)`.

### Что является набором форм, а что нет

Объект считается набором форм, только если **все** его ключи — ключи форм.
Поэтому обычное пространство имён никогда не будет принято за формы, а ни один
символ в строке сообщения не имеет специального значения:

```typescript
{ one: '{n} файл', other: '{n} файла' }   // формы → t('files', { n: 2 })
{ save: 'Сохранить', cancel: 'Отмена' }   // пространство имён → t('actions.save')
'Name | Email'                            // обычный текст, всегда целиком
```

Для типа ключей набор форм — тоже лист: `t('files')` предлагается
автодополнением, `t('files.one')` — нет, хотя в рантайме по-прежнему
разрешается как обычный вложенный ключ.

### Счётчик

- Счётчик читается из `params.count`, при его отсутствии — из `params.n`.
- Числовые строки (`'3'`) и `bigint` (`3n`) приводятся к числу.
- Любой другой тип — и отсутствие счётчика — выбирают `other`.

### Правила какой локали применяются

Применяются правила **той локали, из которой пришло сообщение**, а не текущей.
Перевод, разрешённый через `fallbackLocale`, сохраняет правила fallback — текст
и его грамматика едут вместе.

Правила и карта веток резолвятся один раз, при первом обращении к сообщению;
дальше выбранная ветка запоминается по значению счётчика, поэтому повторный
вызов стоит поиска и вызова. Хелперы экспортируются из `@feugene/fint-i18n/core`:

```typescript
function isPluralForms(value: unknown): value is Record<string, string>;
function compilePluralForms(forms: Record<string, string>, locale?: Locale): MessageFunction;
function getPluralRules(locale?: Locale): Intl.PluralRules;
function getPluralCategories(locale?: Locale): PluralCategory[];
function selectPluralCategory(locale: Locale | undefined, count: number): PluralCategory;
function clearPluralCache(): void;
```

Без локали используются английские правила.

---

## Форматирование чисел и дат

Форматтеры — не методы инстанса: они лежат в отдельном модуле, поэтому приложение, которое ничего не форматирует, за них
не платит. Импортируются из `@feugene/fint-i18n/core`.

```typescript
function createFormatters(getLocale: () => Locale): I18nFormatters;

function formatNumber(locale: Locale, value: number | bigint, options?: Intl.NumberFormatOptions): string;

function formatDate(locale: Locale, value: Date | number | string, options?: Intl.DateTimeFormatOptions): string;

function getNumberFormat(locale: Locale, options?: Intl.NumberFormatOptions): Intl.NumberFormat;

function getDateTimeFormat(locale: Locale, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat;

function clearFormatterCache(): void;
```

```typescript
const {n, d} = createFormatters(() => i18n.locale.value)

n(1234567.891)                                    // "1 234 567,891" (ru)
n(42.5, {style: 'currency', currency: 'USD'})   // "$42.50" (en)
d(Date.now(), {dateStyle: 'long'})              // "4 августа 2026 г." (ru)
```

В компонентах используйте [`useI18nFormat()`](#usei18nformat) — та же пара, полученная из инжектированного инстанса.

### Кэширование

Создание `Intl`-форматтера и есть дорогая часть — примерно в 11 раз дороже самого форматирования. Инстансы кэшируются по
локали и опциям; `getNumberFormat`/`getDateTimeFormat` отдают закэшированный инстанс для `formatToParts` и подобного.

Кэш ограничен (64 записи на каждый вид) и при переполнении сбрасывается целиком, поэтому генерируемые опции не могут
растить его бесконечно.

### Краевые случаи

- `d()` принимает `Date`, timestamp или строку, разбираемую `new Date()`. `null` и `undefined` дают пустую строку
  (необязательное поле — не ошибка), прочее невалидное возвращается как есть с предупреждением. `d()` не бросает
  исключений — форматирование не должно ронять рендер.
- Невалидные опции `Intl` (например, стиль `currency` без кода валюты) репортятся и отбрасываются: значение
  форматируется без них, а не роняет рендер.
- Локаль, не являющаяся валидным BCP 47 тегом, откатывается на `en` с предупреждением. `Locale` в библиотеке —
  произвольный ключ, и плохой тег не должен ломать перевод.

---

## Снимок состояния для SSR и гидрация

Свободные функции, импортируются из `@feugene/fint-i18n/core`. Приложение,
которое не рендерится на сервере, не включает их в бандл.

```typescript
interface FintI18nSSRState {
  messages: Record<Locale, MessageSchema>;
  blocks: Record<Locale, string[]>;
}

function getSSRState(i18n: FintI18n, options?: { locales?: Locale[] }): FintI18nSSRState;
function hydrate(i18n: FintI18n, state: FintI18nSSRState): void;
```

- `getSSRState()` снимает то, что загрузил сервер: сообщения и имена уже
  полученных блоков. Параметр `locales` сужает нагрузку до реально отрисованной
  локали.
- `hydrate()` применяет снимок к клиентскому инстансу **до** монтирования и
  помечает блоки загруженными, поэтому ничего не запрашивается повторно.
- `getLoadedBlocks(): Record<Locale, string[]>` на инстансе питает снимок и
  может использоваться самостоятельно.

Полный рецепт вместе с контрактом и ограничениями — в разделе
[Серверный рендеринг (SSR)](./ssr.md).

---

## Повторы при отказе загрузки

Упавший лоадер оставляет блок незагруженным. Само по себе ничто не
перезапускается: `useI18nScope()` один раз отклоняется, `useI18nScopeSync()`
кладёт причину в `error` и останавливается. Одна моргнувшая сеть на старте
поэтому оставляет пользователя перед ключами, пока кто-нибудь не вызовет
`loadBlock()` заново.

`retry` заставляет библиотеку делать это самостоятельно:

```typescript
const i18n = createFintI18n({
  locale: 'en',
  loaders,
  retry: {
    attempts: 3,                          // всего, включая первую
    backoff: attempt => 100 * 2 ** attempt, // мс перед попыткой `attempt + 1`
    timeout: 5000,                        // потолок одной попытки
  },
})
```

Умолчания, если `retry` задан: три попытки и пауза 100 · 2^(n−1) мс
(100, 200, 400). Не задавать `retry` вовсе — поведение прежнее: одна попытка,
без таймаута.

### Что именно повторяется

- **Лоадер, а не блок.** Если у блока несколько лоадеров и упал второй, первый
  не переигрывается — его сообщения уже смержены.
- **Промис блока остаётся тем же.** Повторы происходят внутри него, поэтому
  конкурентные `loadBlock()` по-прежнему делят один промис, и лоадер не
  вызывается дважды параллельно.
- **Наружу выходит только итоговый отказ.** Промежуточные попытки не
  репортятся; отклонение несёт последнюю ошибку, `onError` срабатывает один раз.
- **`dispose()` прерывает цикл.** Инстанс, освобождённый между попытками,
  повторять не продолжает.

### Таймаут ничего не отменяет

Лоадер — это обычная `() => Promise`, прервать её нечем. `timeout` лишь
перестаёт *ждать*: попытка считается неудачной и начинается следующая, а
брошенный запрос может завершиться в фоне. Задавайте его, чтобы ограничить
ожидание, а не чтобы сэкономить соединение.
