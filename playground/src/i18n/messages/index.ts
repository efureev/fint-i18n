/**
 * Per-locale entry points for the playground.
 *
 * This barrel demonstrates the recommended layout for authoring localization
 * packages: each locale lives in its own module and is imported on demand,
 * so bundlers can tree-shake unused languages out of the final build.
 *
 * Usage from the consumer side:
 *
 * ```ts
 * import { en, ru } from './i18n/messages'
 *
 * createFintI18n({
 *   locale: 'en',
 *   fallbackLocale: 'en',
 *   loaders: [en, ru],
 * })
 * ```
 *
 * The fat aggregate that pulls every locale lives in `./all.ts` and must be
 * imported explicitly (`./i18n/messages/all`) — never re-exported from this
 * file, otherwise per-locale tree-shaking would be defeated.
 */
export { en } from './en'
export { ru } from './ru'
