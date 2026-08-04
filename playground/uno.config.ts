import {
  defineConfig,
  presetIcons,
  presetMini,
  presetTypography,
  presetWebFonts,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  /**
   * `presetMini` не содержит ни `text-transform`, ни анимаций — они живут в
   * `presetWind`. Отсутствие правила не ошибка сборки: класс просто не
   * попадает в CSS, поэтому `uppercase` во всех надзаголовках и `animate-spin`
   * у спиннера ничего не делали. Добираем точечно, вместо смены пресета.
   */
  rules: [
    ['uppercase', { 'text-transform': 'uppercase' }],
    ['normal-case', { 'text-transform': 'none' }],
    ['animate-spin', { animation: 'fint-spin 1s linear infinite' }],
  ],
  preflights: [
    { getCSS: () => '@keyframes fint-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}' },
  ],
  shortcuts: [
    ['btn', 'px-4 py-2 rounded inline-block bg-indigo-600 text-white cursor-pointer hover:bg-indigo-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
    ['icon-btn', 'inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-indigo-600'],
  ],
  presets: [
    presetMini(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
    presetTypography(),
    presetWebFonts({
      fonts: {
        sans: 'Inter',
        mono: 'DM Mono',
      },
    }),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
})
