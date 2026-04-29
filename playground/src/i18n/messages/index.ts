/**
 * Per-locale entry points for the playground.
 *
 * This file demonstrates the recommended layout for authoring localization
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
 */
export { en } from './en'
export { ru } from './ru'

import { en } from './en'
import { ru } from './ru'

/**
 * Convenience aggregate that includes every locale shipped by this package.
 * Prefer importing locales individually — this aggregate is provided only
 * for tooling, demos and tests where bundle size is not a concern.
 */
export const loaders = [en, ru]
