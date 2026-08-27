# Git, CI и релиз

> **Читать когда:** собираешься коммитить, открывать PR, бампать версию,
> ставить тег, публиковать — или разбираешься, почему CI красный.

## Коммиты

**Не коммитить и не пушить без явной просьбы владельца.**

Формат сообщений — по фактической истории репозитория:
`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `bump version to X`.
Правки по роадмапу помечаются номером пункта из [`ANALYSIS.md`](../../ANALYSIS.md)
(нумерация там сквозная и при закрытии пункта не переиспользуется):
`feat(core): add te() and tm() (#4)`.

Один коммит — один логический пункт. Перед коммитом локально — весь набор,
который гоняет CI, иначе гейт всплывёт уже в красном прогоне:

```bash
yarn lint && yarn type-check && yarn check:messages \
  && yarn test:coverage && yarn build \
  && node scripts/check-size.mjs && node scripts/check-devtools-isolation.mjs \
  && yarn playground:build && yarn playground:ssr:build
```

Именно `test:coverage`, а не `test:run`: пороги покрытия — блокирующий гейт, и
он единственный, который проходит мимо обычного прогона. Зелёный `test:run` при
красном `test:coverage:package` — рабочее состояние, а не аномалия: новый слой с
покрытием ниже своего порога роняет CI, тестов не сломав. Пороги заданы
послойно (`vitest.config.ts`), и просевший слой назван в тексте ошибки.

Правка `package.json#exports` добавляет сюда ещё один шаг — он тоже
блокирующий, но сетевой, поэтому в общую цепочку не вписан:

```bash
npx --yes publint --pack npm
```

Ветка по умолчанию — `main`, `git user: fureev`.

## Что гоняет CI

`.github/workflows/ci.yml`, триггеры: push в `main`, теги `v*`, PR в `main`.

Job **`build-and-test`**, матрица Node **22 и 24** (совпадает с `engines: node >= 22`):

1. `yarn install --frozen-lockfile` — рассинхрон `yarn.lock` валит сборку сразу;
2. `yarn lint`;
3. `yarn type-check`;
4. `yarn check:messages` (**блокирующий**) — словари playground: паритет
   локалей, полнота форм CLDR, сверка ключей с кодом;
5. `yarn test:coverage:package` → junit + lcov в Codecov (флаг `package`);
6. `yarn test:coverage:playground` → Codecov (флаг `playground`);
7. сводка покрытия в `GITHUB_STEP_SUMMARY`;
8. `yarn build`;
9. `node scripts/check-size.mjs` — бюджет размера (**блокирующий**);
10. `node scripts/check-devtools-isolation.mjs` (**блокирующий**) — обходит граф
    импортов собранного `dist` и валит прогон, если код devtools достижим из
    любой прод-точки входа;
11. только на Node 24: `publint --pack npm` (**блокирующий**),
    `arethetypeswrong --pack` и `yarn bench` (**информационные**,
    `continue-on-error` — числа бенчей на общих раннерах слишком шумны для гейта);
12. `yarn playground:build`;
13. `yarn playground:ssr:build` (**блокирующий**) — единственный гейт типов
    SSR-витрины;
14. артефакты `dist` и `playground-dist` (только Node 24).

Шаги 4 и 13 в матрицу-исключения не вынесены: гоняются на обеих версиях Node
и валят прогон целиком.

Шаги 5 и 6 роняют прогон не только упавшим тестом, но и покрытием ниже порога —
это отдельный отказ с текстом `does not meet ... threshold`, и локально он ловится
только `yarn test:coverage`.

Job **`deploy-playground`** — push в `main`: `playground-dist` → GitHub Pages.

Job **`publish`** — только по тегу `v*`: сверяет тег с `package.json#version`
(**блокирующий шаг**, тег `v0.5.0` при версии `0.4.0` валит job), скачивает
`dist`-артефакт из `build-and-test` и публикует **его же**, не пересобирая:
`npm publish --provenance --access public --ignore-scripts` в npmjs, затем
`npm pkg set name=@efureev/fint-i18n` и повторная публикация в GitHub Packages.

**Очередь прогонов** сгруппирована по `workflow + ref`, прогоны PR отменяются
при новом пуше. Группа `pages` осталась только на `deploy-playground` — она
нужна Pages, а не всему репозиторию.

## Релиз — порядок действий

1. Убедиться, что `main` зелёный.
2. Поднять `version` в `package.json` (коммит вида `bump version to 0.3.1`).
3. Обновить документацию, если изменился публичный API (**en и ru**).
4. Тег `vX.Y.Z`, push тега — дальше публикация автоматическая.

Версия и тег обязаны совпадать — это проверяется шагом `Verify tag matches
package version`, который валит `publish` до любой публикации. Раньше
расхождение молча публиковало не ту версию.

## Требования к окружению CI

- `secrets.CODECOV_TOKEN` — покрытие и test-results;
- `secrets.NPM_TOKEN` — публикация в npmjs;
- `permissions: id-token: write` в job `publish` — обязательное условие
  `--provenance`. В форках без OIDC provenance-публикация не пройдёт;
- GitHub Pages включён на репозитории (`environment: github-pages`).

## Красный CI — с чего начинать

| Симптом | Причина |
| --- | --- |
| падение на install | `yarn.lock` не обновлён / правился не Yarn 1 Classic |
| `publint` ругается на exports | у нового subpath нет условия `default` |
| `arethetypeswrong` красный | ожидаемо, шаг информационный — см. `gotchas.md` |
| `playground:build` упал, а `type-check` прошёл | ошибка типов в `playground/**`: он вне `tsconfig#include` |
| `playground:ssr:build` упал, а `playground:build` прошёл | новый subpath не прописан в `playground-ssr/vite.config.ts` — у SSR-витрины своя карта алиасов |
| `check:messages` упал | ключ добавлен не во все словари (`en`/`ru`/`es`) или неполон набор форм CLDR. Локально ловится только этой же командой — `lint`/`type-check`/`test` его не видят |
| шаг `Test` красный, а тесты все прошли | покрытие слоя ниже его порога (`vitest.config.ts`). Локально ловится только `yarn test:coverage`; просевший слой назван в тексте ошибки |
| lint прошёл, а проблема в playground | `playground/**` в `ignores` ESLint |

Подробности по каждому — `.claude/docs/gotchas.md`.
