/**
 * Aggregated list of every locale shipped by the playground.
 *
 * This module mirrors the `<package>/i18n/all` subpath convention from the
 * authoring guide: it pulls in every per-locale module on purpose and is
 * therefore intended for demos, tooling and e2e tests where bundle size is
 * not a concern.
 *
 * In production builds prefer per-locale imports from `./index.ts`:
 *
 * ```ts
 * import { en, ru } from './i18n/messages'
 * ```
 */
import { en } from './en'
import { ru } from './ru'

export const loaders = [en, ru]
export default loaders
