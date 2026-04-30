# Гайд для авторов локализационных пакетов

Этот документ описывает рекомендуемый формат экспорта переводов для
любого пакета, который поставляет локализационные ресурсы для
`@feugene/fint-i18n` (UI-кит, бизнес-модуль, плагин и т.п.).

Главный принцип — **один экспорт на одну локаль**. Это нужно не самому
`fint-i18n` (движок прекрасно работает с любой формой
`LocaleLoaderCollection`), а **сборщику приложения**: только так Vite /
Rollup / webpack могут выкинуть из бандла языки, которые потребитель не
использует.

## Почему важен per-locale экспорт

Если пакет экспортирует один «жирный» объект со всеми локалями:

```ts
// ❌ так делать не нужно
export const fooLocaleLoaders = {
  en: { common: () => import('./locales/en/common.json'), /* ... */ },
  ru: { common: () => import('./locales/ru/common.json'), /* ... */ },
  de: { /* ... */ },
  fr: { /* ... */ },
  // ...
}
```

то даже если приложение через `setLocale('en' | 'ru')` никогда не
обратится к `de` / `fr` / …, **все динамические `import()`-чанки этих
локалей всё равно достижимы из графа модулей** и попадут в `dist`. Это
раздувает манифест, prefetch-стратегии и SSR-артефакты.

Опции вроде `supportedLocales` в `createFintI18n` эту проблему **не
решают**: они работают в рантайме, а tree-shaking — статический.

## Рекомендуемая структура пакета

```text
my-package/
  src/
    i18n/
      locales/
        en/...json
        ru/...json
        de/...json
        ...
      en.ts          # экспорт `en` — только английские лоадеры
      ru.ts          # экспорт `ru` — только русские
      de.ts
      ...
      index.ts       # барелл с именованными реэкспортами
      all.ts         # (опционально) агрегированный экспорт для демо/тестов
```

### Файл локали

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

Файлы остальных локалей пишутся по той же схеме — отличается только
двухбуквенный ключ верхнего уровня и пути.

### Барелл `index.ts`

```ts
// src/i18n/index.ts
export { en } from './en'
export { ru } from './ru'
export { de } from './de'
// и т.д.
```

Именно `index.ts` обычно публикуется как `<package>/i18n` в `exports`
поле `package.json`. Если потребитель напишет:

```ts
import { en, ru } from 'my-package/i18n'
```

то модули `de.ts`, `fr.ts`, `…` **никогда не попадают в граф
зависимостей** и автоматически уходят при tree-shaking — независимо от
того, лежит там жирный JSON или большой набор `import()`.

### Опциональный `all.ts`

Иногда всё-таки нужен «жирный» экспорт со всеми локалями сразу — для
демо-страниц, e2e-тестов, инструментов локализации, скриптов аудита. Для
этого ровно один файл — `src/i18n/all.ts` — собирает все per-locale
модули в один массив:

```ts
// src/i18n/all.ts — для демо, инструментов, e2e-тестов
import { en } from './en'
import { ru } from './ru'
import { de } from './de'

export const all = [en, ru, de /* ... */]
export default all
```

#### Куда его размещать

- Файл лежит **рядом** с per-locale модулями, в той же папке `src/i18n/`,
  но **не реэкспортируется** из `index.ts`. Это критично: если `all`
  будет реэкспортирован из главного барелла, любой `import { en } from
  '<pkg>/i18n'` потянет в граф ещё и `ru`, `de`, … и весь смысл
  per-locale экспорта пропадёт.
- В сборке он публикуется как **отдельный подпуть** —
  `<package>/i18n/all`, а не из основного `<package>/i18n`.

#### Как экспонировать через `package.json`

В `exports` пакета добавляется отдельная запись для `./i18n/all`:

```jsonc
// package.json
{
  "name": "my-package",
  "sideEffects": false,
  "exports": {
    "./i18n": {
      "types": "./dist/i18n/index.d.ts",
      "import": "./dist/i18n/index.js"
    },
    "./i18n/all": {
      "types": "./dist/i18n/all.d.ts",
      "import": "./dist/i18n/all.js"
    }
  }
}
```

Ключевые моменты:

- `./i18n` и `./i18n/all` — **разные entry points** в `exports`. Импорт
  одного НЕ тянет другой.
- `"sideEffects": false` (или явный whitelist без `i18n/*`) обязателен —
  иначе сборщик будет считать побочными эффектами все per-locale модули
  и не сможет их отбросить.
- Для TypeScript добавляется парный `types` на каждый подпуть; иначе
  `import '<pkg>/i18n/all'` не получит типов в потребителе с
  `moduleResolution: bundler|node16|nodenext`.
- Для пользователей с `tsconfig.moduleResolution: node10` (старый
  алгоритм) дополнительно желательно прописать `typesVersions` —
  fallback на `dist/i18n/all.d.ts`.

#### Как использовать на стороне потребителя

```ts
// Production-сборка приложения — импортируем только нужные локали.
import { en, ru } from 'my-package/i18n'

// Storybook / e2e / playground — допустим разовый «жирный» импорт.
import all from 'my-package/i18n/all'

createFintI18n({
  locale: 'en',
  fallbackLocale: 'en',
  loaders: all, // == [en, ru, de, ...]
})
```

> [!WARNING]
> Никогда не импортируйте `<pkg>/i18n/all` в production-бандле
> приложения: это эквивалентно отказу от tree-shaking локалей. Используйте
> его только в окружениях, где размер сборки не важен.

## Контракт пакета

1. **Экспортируйте каждую локаль отдельным именованным экспортом** в
   `<package>/i18n` (имя экспорта = ISO-код локали: `en`, `ru`, `pt-BR`
   как `ptBR` или `'pt-BR'` через `as`-алиас на стороне импортёра).
2. **Не используйте default-экспорт «жирного» объекта** для всех локалей
   как основной способ потребления.
3. Тип экспорта — всегда `LocaleLoaderCollection` (одна верхне-уровневая
   локаль внутри объекта).
4. **Не предполагайте конкретный язык приложения**: пакет должен спокойно
   работать, если приложение импортирует только одну вашу локаль.
5. **Не делайте side-effects в файлах локалей** (`sideEffects: false` в
   `package.json` или явный whitelist).

## Использование на стороне приложения

```ts
import { createFintI18n } from '@feugene/fint-i18n/core'
import { en as appEn, ru as appRu } from './i18n/messages'
import { en as granularityEn, ru as granularityRu } from '@feugene/granularity/i18n'

const i18n = createFintI18n({
  locale: 'ru',
  fallbackLocale: 'en',
  // Пакеты-доноры подключаются ровно теми локалями, что нужны проекту.
  loaders: [appEn, appRu, granularityEn, granularityRu],
})
```

При совпадении блоков `fint-i18n` смерджит loaders слева направо —
поэтому переводы приложения, поставленные раньше пакета-донора, будут
переопределяться его значениями (а пришедшие позже — наоборот). Подробные
правила см. в [Defining Messages](./defining-messages.md).

## Чек-лист

- [ ] Каждая локаль — отдельный модуль (`en.ts`, `ru.ts`, …).
- [ ] `index.ts` реэкспортирует локали именованно, без агрегатов по
      умолчанию.
- [ ] В `package.json` указан корректный `exports` для подпути `i18n`
      (`./i18n`), а `sideEffects` не блокирует tree-shaking.
- [ ] Файлы локалей не делают побочных эффектов и не импортируют друг
      друга.
- [ ] Опциональный `all` экспортируется отдельным подпутём
      (`<package>/i18n/all`), а не из основного барелла.
