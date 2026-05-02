import type { MessageFunction } from './compiler'
import type { FintI18n } from './instance'

export type Locale = string

export type LocaleBlockLoader = () => Promise<any>

export type LocaleBlockLoaders = LocaleBlockLoader | LocaleBlockLoader[]

export type LocaleLoaderCollection = Record<Locale, Record<string, LocaleBlockLoaders>>

export type LocaleLoaderSource = LocaleLoaderCollection | LocaleLoaderCollection[]

export interface FintI18nPlugin {
  name: string
  install: (instance: FintI18n) => void
}

export interface FintI18nOptions {
  locale: Locale
  fallbackLocale?: Locale
  loaders?: LocaleLoaderSource
  plugins?: FintI18nPlugin[]
}

export type MessagePrimitive = string | number | boolean

export interface MessageSchema {
  [key: string]: MessagePrimitive | MessageFunction | MessageSchema
}

export type MessageValue = MessagePrimitive | MessageFunction | MessageSchema

export interface TranslateOptions {
  fallbackLocale?: Locale
}