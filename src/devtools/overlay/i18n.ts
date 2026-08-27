import { createFintI18n, negotiateLocale } from '../../core'
import type { Locale } from '../../core'

/** Локали, на которые панель переведена. Остальные падают в английский. */
const PANEL_LOCALES: Locale[] = ['en', 'ru']

/** Имя блока панели. Своё, а не `ui`: чтобы при чтении кода его не путали с
 *  одноимённым блоком приложения — инстансы разные, но глаз цепляется. */
const BLOCK = 'panel'

export interface PanelI18n {
  /** Ключи пишутся без имени блока: `tabs.blocks`, а не `ui.tabs.blocks`. */
  t: (key: string, params?: Record<string, any>) => string
  /** Подтянуть локаль под локаль приложения. Чужая — английский. */
  follow: (locale: Locale) => void
  dispose: () => void
}

const pick = (locale?: Locale): Locale => (locale ? negotiateLocale([locale], PANEL_LOCALES, 'en')! : 'en')

/**
 * Переводы самой панели живут на **отдельном** инстансе, а не на инстансе
 * приложения, и это не перестраховка.
 *
 * Общий инстанс означал бы, что панель попадает в собственные наблюдения: свой
 * блок в таблице блоков, свои ключи в словаре и в топе метрик. Хуже того, в
 * режимах `keys` и `pseudo` панель перевела бы сама себя — вкладки стали бы
 * `tabs.blocks` или `[ƀļöçķš]`, и инструмент диагностики сломался бы ровно
 * тогда, когда он нужен.
 *
 * Заодно это второй инстанс в том же рантайме — то, что библиотека и обещает.
 */
export async function createPanelI18n(preferred?: Locale): Promise<PanelI18n> {
  const i18n = createFintI18n({
    locale: pick(preferred),
    fallbackLocale: 'en',
    loaders: {
      en: { [BLOCK]: () => import('./locales/en') },
      ru: { [BLOCK]: () => import('./locales/ru') },
    },
  })

  // Регистрация использования нужна не для счётчиков, а чтобы `setLocale()`
  // догрузил блок сам — иначе смена языка показала бы голые ключи.
  i18n.registerUsage(BLOCK)
  await i18n.loadBlock(BLOCK)

  return {
    // Сообщения мержатся под именем блока, поэтому префикс добавляется здесь —
    // ровно как это делает `useI18nScope({ prefix: true })`.
    t: (key, params) => i18n.t(`${BLOCK}.${key}`, params),

    follow(locale) {
      const next = pick(locale)

      if (next !== i18n.locale.value) void i18n.setLocale(next)
    },

    dispose: i18n.dispose,
  }
}
