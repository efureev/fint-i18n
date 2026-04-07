# Справочник API

В данном разделе представлено подробное техническое описание всех функций, методов и интерфейсов библиотеки `@feugene/fint-i18n`.

---

## Глобальные функции

### `createFintI18n(options)`

Основная функция для инициализации библиотеки. Импортируется из `@feugene/fint-i18n/core`.

```typescript
function createFintI18n(options: FintI18nOptions): FintI18n;

type Locale = string;
type LocaleBlockLoader = () => Promise<any>;
type LocaleBlockLoaders = LocaleBlockLoader | LocaleBlockLoader[];
type LocaleLoaderCollection = Record<Locale, Record<string, LocaleBlockLoaders>>;
type LocaleLoaderSource = LocaleLoaderCollection | LocaleLoaderCollection[];

interface FintI18nOptions {
  locale: Locale;                                           // Начальный язык
  fallbackLocale?: Locale;                                  // Резервный язык
  loaders?: LocaleLoaderSource;                             // Одна или несколько коллекций loaders
  plugins?: FintI18nPlugin[];                               // Список плагинов
  globalInstall?: boolean;                                  // Глобальная регистрация $t (true по умолчанию)
}
```

**Параметры:**
- `options` (объект):
  - `locale` (`Locale`): Начальный язык приложения.
  - `fallbackLocale` (`Locale`, optional): Резервный язык. По умолчанию `'en'`.
  - `loaders` (`LocaleLoaderSource`, optional): Одна package-level коллекция loaders или массив таких коллекций.
  - `plugins` (array, optional): Массив плагинов для расширения функционала.

**Возвращает:** Экземпляр `FintI18n`.

#### Контракт loaders

```typescript
type LocaleBlockLoader = () => Promise<any>;
type LocaleBlockLoaders = LocaleBlockLoader | LocaleBlockLoader[];

type LocaleLoaderCollection = {
  [locale: Locale]: {
    [blockName: string]: LocaleBlockLoaders;
  };
};
```

- `LocaleLoaderCollection` удобно экспортировать из пакета как готовый i18n-артефакт.
- `LocaleLoaderSource` позволяет передать в `createFintI18n()` как одну collection, так и массив collections.
- Если у одного `blockName` несколько loaders, они выполняются последовательно и их результаты merge-ятся в порядке объявления.
- Если один и тот же `blockName` приходит из нескольких package collections, итоговый порядок loaders сохраняет порядок массива `loaders: [...]`.

---

## Композаблы (Vue 3)

### `useFintI18n()`

Обеспечивает доступ к текущему экземпляру i18n внутри компонентов Vue. Импортируется из `@feugene/fint-i18n/vue`.

```typescript
function useFintI18n(): FintI18n;
```

**Возвращает:** Экземпляр `FintI18n`, предоставляющий доступ к реактивной локали и методам перевода.

### `useI18nScope(blocks)`

Асинхронный композабл для управления областью видимости блоков перевода в компоненте. Импортируется из `@feugene/fint-i18n/vue`.

```typescript
async function useI18nScope(blocks: string | string[]): Promise<I18nScope>;

interface I18nScope {
  t: (key: string, params?: Record<string, any>) => string;
  locale: Ref<Locale>;
  setLocale: (l: Locale) => Promise<void>;
}
```

**Параметры:**
- `blocks` (string | string[]): Имя блока или массив имен блоков, необходимых компоненту.

**Особенности:**
- Автоматически загружает указанные блоки при монтировании компонента.
- Использует механизм подсчета ссылок (Reference Counting) для управления памятью.
- Должен использоваться с `await` в `<script setup>` (требует `Suspense` в родительском компоненте).

---

## Экземпляр `FintI18n` (Core API)

Методы, доступные в экземпляре класса `FintI18n`.

### `t(key, params, options)`

Основной метод для получения перевода.

```typescript
declare function t(key: string, params?: Record<string, any>): string;
```

- **`key`** (string): Полный путь к ключу (например, `common.welcome`).
- **`params`** (object, optional): Параметры для интерполяции. Поддерживает `Ref`.

### `setLocale(locale)`

Сменяет текущую локаль приложения.

```typescript
declare function setLocale(locale: Locale): Promise<void>;
```

- **`locale`** (`Locale`): Код новой локали.

### `loadBlock(blockName, locale?)`

Асинхронно загружает указанный блок сообщений.

```typescript
declare function loadBlock(blockName: string, locale?: Locale): Promise<void>;
```

- **`blockName`** (string): Имя блока для загрузки.
- **`locale`** (`Locale`, optional): Если не указано, загружает для текущей локали.

**Правила резолвинга loaders:**
- Сначала ищется точный `blockName`.
- Если точный block не найден и имя содержит точку, ищется ближайший parent block (`pages.articles.comments` → `pages.articles` → `pages`).
- Если для блока найден массив loaders, они выполняются последовательно.

### `mergeMessages(locale, blockName, messages)`

Вручную добавляет сообщения в хранилище.

```typescript
declare function mergeMessages(locale: Locale, blockName: string, messages: any): void;
```

- **`locale`** (`Locale`): Локаль.
- **`blockName`** (string): Имя блока.
- **`messages`** (object): Объект с переводами.

### `hooks.on(name, callback)`

Подписывается на хуки жизненного цикла i18n.

```typescript
declare function on<K extends keyof FintI18nHooks>(name: K, fn: FintI18nHooks[K]): () => void;
```

**Возвращает:** Функцию отписки.

---

## Директива `v-t`

Vue-директива для высокопроизводительного вывода переводов.

```typescript
type VTValue = string | { path: string, params?: Record<string, any> };
```

**Синтаксис:**
- `v-t="'block.key'"` — простой вывод.
- `v-t="{ path: 'block.key', params: { name: 'John' } }"` — с параметрами.

**Модификаторы:**
- `.once`: Рендерит перевод один раз. Игнорирует последующие изменения локали и параметров для экономии ресурсов.

---

## Глобальные свойства

При регистрации через `installI18n(app, i18n)` из `@feugene/fint-i18n/vue`, в шаблонах становятся доступны:

- **`$t`**: Глобальный аналог функции `t()`.
- **`$i18n`**: Доступ к экземпляру i18n.
